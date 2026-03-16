"""Fetch price data and run the underwritten risk engine."""
import json
import sys
import numpy as np
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from risk_engine import normalize_vol_to_exposure, compute_underwritten_risk, compute_factor_overlap


def fetch_risk(holdings, factor_config=None, lookback_days=252):
    tickers = [h["ticker"] for h in holdings]
    if len(tickers) < 1:
        return {"error": "Need at least 1 position"}

    if factor_config is None:
        factor_config = {"factors": [], "importanceWeights": {"Volatility": 0.9}, "exposures": {}}

    manual_factors = factor_config.get("factors", [])
    importance_weights = factor_config.get("importanceWeights", {"Volatility": 0.9})
    manual_exposures = factor_config.get("exposures", {})
    all_factors = ["Volatility"] + manual_factors

    end = datetime.now()
    start = end - timedelta(days=lookback_days + 60)

    # ── Download historical prices ──
    prices = {}
    for t in tickers:
        try:
            hist = yf.download(t, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"),
                               progress=False, auto_adjust=False)
            if not hist.empty:
                if isinstance(hist.columns, pd.MultiIndex):
                    hist.columns = [c[0] for c in hist.columns]
                prices[t] = hist["Close"].dropna()
        except Exception:
            pass

    valid_tickers = [t for t in tickers if t in prices and len(prices[t]) >= 60]
    if not valid_tickers:
        return {"error": "Insufficient price history", "metrics": None}

    # ── Returns ──
    returns_df = pd.DataFrame({t: prices[t].pct_change().dropna() for t in valid_tickers})
    returns_df = returns_df.dropna()
    returns_df = returns_df.tail(lookback_days)

    # ── Portfolio weights ──
    total_value = 0
    weight_map = {}
    for h in holdings:
        if h["ticker"] in valid_tickers:
            val = h["shares"] * h.get("price", h["cost_basis"])
            weight_map[h["ticker"]] = val
            total_value += val

    if total_value > 0:
        for t in weight_map:
            weight_map[t] /= total_value
    else:
        eq = 1.0 / len(valid_tickers)
        weight_map = {t: eq for t in valid_tickers}

    weight_arr = np.array([weight_map.get(t, 0) for t in valid_tickers])

    # ── Portfolio daily returns for observed metrics ──
    port_returns = returns_df[valid_tickers].values @ weight_arr

    # Observed portfolio vol (annualized)
    obs_vol = float(np.std(port_returns) * np.sqrt(252)) if len(port_returns) > 1 else None

    # Max drawdown
    cum = np.cumprod(1 + port_returns)
    peak = np.maximum.accumulate(cum)
    drawdown = (cum - peak) / peak
    max_dd = float(np.min(drawdown)) if len(drawdown) > 0 else None

    # VaR 95%
    var_95_pct = float(np.percentile(port_returns, 5)) if len(port_returns) > 20 else None

    # ── Implied portfolio correlation ──
    # Weight-weighted average of pairwise return correlations
    portfolio_corr = None
    if len(valid_tickers) >= 2:
        corr = returns_df[valid_tickers].corr()
        asset_stds = returns_df[valid_tickers].std()
        cross_scale = 0.0
        cross_corr = 0.0
        for i in range(len(valid_tickers)):
            for j in range(i + 1, len(valid_tickers)):
                ti, tj = valid_tickers[i], valid_tickers[j]
                scale = weight_map.get(ti, 0) * weight_map.get(tj, 0) * asset_stds[ti] * asset_stds[tj]
                cross_scale += scale
                cross_corr += scale * corr.loc[ti, tj]
        if cross_scale > 0:
            portfolio_corr = float(cross_corr / cross_scale)

    # ── Realized vol per stock ──
    asset_ann_vols = {}
    for t in valid_tickers:
        daily_ret = returns_df[t].values
        asset_ann_vols[t] = float(np.std(daily_ret) * np.sqrt(252))

    # ── Volatility exposure via z-score → clip → rescale ──
    vol_exposures = normalize_vol_to_exposure(asset_ann_vols)

    # ── Build exposure matrix ──
    n_assets = len(valid_tickers)
    n_factors = len(all_factors)
    exposure_matrix = np.zeros((n_assets, n_factors))

    for i, t in enumerate(valid_tickers):
        exposure_matrix[i, 0] = vol_exposures.get(t, 0.0)
        t_exp = manual_exposures.get(t, {})
        for j, f in enumerate(manual_factors):
            exposure_matrix[i, j + 1] = t_exp.get(f, 0.0)

    # ── Run underwritten risk engine ──
    ur_result = compute_underwritten_risk(
        valid_tickers, weight_map, all_factors,
        importance_weights, exposure_matrix, asset_ann_vols
    )

    # ── Factor profile overlap (descriptive only) ──
    overlap = compute_factor_overlap(
        valid_tickers, all_factors, importance_weights, exposure_matrix
    )

    return {
        "metrics": {
            "observedVol": round(obs_vol * 100, 2) if obs_vol else None,
            "maxDrawdown": round(max_dd * 100, 2) if max_dd else None,
            "var95Pct": round(var_95_pct * 100, 2) if var_95_pct else None,
            "portfolioCorrelation": round(portfolio_corr, 4) if portfolio_corr is not None else None,
            "daysUsed": len(port_returns),
        },
        "riskAttribution": {
            "stocks": ur_result["stocks"],
            "summary": ur_result["summary"],
            "factorBreakdown": ur_result["factorBreakdown"],
        },
        "portfolioFactorProfile": ur_result["portfolioFactorProfile"],
        "allFactors": all_factors,
        "overlap": overlap,
    }


if __name__ == "__main__":
    holdings = json.loads(sys.argv[1])
    factor_config = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
    print(json.dumps(fetch_risk(holdings, factor_config)))
