"""
Underwritten Risk Engine
========================
Pure factor-exposure-based risk model for concentrated long-only equity portfolios.

No covariance matrices from subjective scores.
No negative risk contributions.
Risk = factor exposure × crowding × importance.

Constants (tune here):
  EXPOSURE_EXPONENT (p) = 1.25   — how aggressively exposure drives load
  CROWDING_PENALTY (λ)  = 0.35   — how much crowding amplifies load
  STATUS_THRESHOLD       = 0.03   — abs diff for over/under contributing label
"""

import numpy as np

# ──────────────────────────────────────────────
# Tunable constants — change here, nowhere else
# ──────────────────────────────────────────────
EXPOSURE_EXPONENT = 1.25    # p
CROWDING_PENALTY = 0.35     # λ
STATUS_THRESHOLD = 0.015    # 1.5 percentage-point threshold (in decimal)


def normalize_vol_to_exposure(raw_vols):
    """
    Convert raw annualized vols → 0-1 exposure via z-score → clip → rescale.
    raw_vols: dict {ticker: float}
    Returns: dict {ticker: float in [0,1]}
    """
    vals = np.array(list(raw_vols.values()))
    tickers = list(raw_vols.keys())

    if len(vals) == 0:
        return {}

    mu = np.mean(vals)
    std = np.std(vals, ddof=0)

    if std < 1e-12:
        return {t: 0.0 for t in tickers}

    z = (vals - mu) / std
    z_clipped = np.clip(z, -2.0, 2.0)

    # Rescale [-2, 2] → [0, 1]
    exposure = (z_clipped + 2.0) / 4.0

    return {t: float(exposure[i]) for i, t in enumerate(tickers)}


def compute_underwritten_risk(valid_tickers, weight_map, factor_names,
                              importance_weights, exposure_matrix, asset_ann_vols):
    """
    Main underwritten risk computation.

    Args:
        valid_tickers: list of ticker strings
        weight_map: dict {ticker: portfolio_weight} summing to ~1
        factor_names: list of factor name strings, e.g. ['Volatility', 'Regulatory', ...]
        importance_weights: dict {factor_name: float}
        exposure_matrix: np.array (n_assets × n_factors) of raw 0-1 exposures
        asset_ann_vols: dict {ticker: annualized_vol}

    Returns: dict with all underwritten risk outputs
    """
    n_assets = len(valid_tickers)
    n_factors = len(factor_names)
    w = np.array([weight_map.get(t, 0) for t in valid_tickers])
    a = np.array([importance_weights.get(f, 0.5) for f in factor_names])
    X = exposure_matrix  # (n_assets, n_factors)

    # ── 2A. Portfolio factor exposure ──
    # E_k = Σ_i (w_i · x_ik)
    E = np.zeros(n_factors)
    for k in range(n_factors):
        E[k] = float(np.sum(w * X[:, k]))

    # ── 2B. Factor concentration / crowding ──
    HHI = np.zeros(n_factors)
    C = np.zeros(n_factors)
    N_eff = np.zeros(n_factors)

    for k in range(n_factors):
        if E[k] > 1e-12:
            # s_ik = (w_i · x_ik) / E_k  — each stock's share of that factor
            s = (w * X[:, k]) / E[k]
            HHI[k] = float(np.sum(s ** 2))
        else:
            HHI[k] = 0.0

        # Effective number of names
        N_eff[k] = 1.0 / HHI[k] if HHI[k] > 1e-12 else 0.0

        # Normalized crowding score
        n_k = int(np.sum(X[:, k] > 0))
        if n_k <= 1:
            C[k] = 1.0
        else:
            C[k] = (HHI[k] - 1.0 / n_k) / (1.0 - 1.0 / n_k)
        C[k] = float(np.clip(C[k], 0.0, 1.0))

    # ── 2C. Factor load ──
    # L_k = a_k · (E_k ^ p) · (1 + λ · C_k)
    L = np.zeros(n_factors)
    for k in range(n_factors):
        L[k] = a[k] * (E[k] ** EXPOSURE_EXPONENT) * (1.0 + CROWDING_PENALTY * C[k])

    # ── 2D. Total underwritten portfolio risk ──
    UR_total = float(np.sum(L))

    # ── 3. Stock contribution to underwritten risk ──
    # RC_ik = L_k · (w_i · x_ik / E_k)   if E_k > 0
    RC_matrix = np.zeros((n_assets, n_factors))
    for k in range(n_factors):
        if E[k] > 1e-12:
            RC_matrix[:, k] = L[k] * (w * X[:, k]) / E[k]

    # Stock total contribution
    RC = RC_matrix.sum(axis=1)  # RC_i = Σ_k RC_ik
    RC_total = float(np.sum(RC))

    # Percent of total
    if RC_total > 1e-12:
        PctRC = RC / RC_total
    else:
        PctRC = np.zeros(n_assets)

    # Excess vs weight
    ExcessVsWeight = PctRC - w

    # Status labels
    labels = []
    for i in range(n_assets):
        if ExcessVsWeight[i] > STATUS_THRESHOLD:
            labels.append("over contributing")
        elif ExcessVsWeight[i] < -STATUS_THRESHOLD:
            labels.append("under contributing")
        else:
            labels.append("in line")

    # Per-stock composite factor score (descriptive)
    # Score_i = Σ_k (a_k · x_ik) / Σ_k a_k
    a_sum = float(np.sum(a))
    scores = np.zeros(n_assets)
    if a_sum > 0:
        scores = (X @ a) / a_sum

    # ── Effective risk contributors ──
    pct_rc_sq_sum = float(np.sum(PctRC ** 2))
    eff_contributors = 1.0 / pct_rc_sq_sum if pct_rc_sq_sum > 1e-12 else 0.0

    # Top 5 underwritten risk share
    sorted_pct = np.sort(PctRC)[::-1]
    top5_pct = float(np.sum(sorted_pct[:min(5, len(sorted_pct))]))

    # Highest factor load
    max_load_idx = int(np.argmax(L))
    highest_load_factor = factor_names[max_load_idx]
    highest_load_value = float(L[max_load_idx])

    # Most crowded factor
    max_crowd_idx = int(np.argmax(C))
    most_crowded_factor = factor_names[max_crowd_idx]
    most_crowded_value = float(C[max_crowd_idx])

    # ── Build per-stock attribution list ──
    attribution = []
    for i, t in enumerate(valid_tickers):
        # Per-factor contribution breakdown for this stock
        factor_contribs = {}
        for k, f in enumerate(factor_names):
            factor_contribs[f] = round(float(RC_matrix[i, k]), 6)

        factor_exposures = {}
        for k, f in enumerate(factor_names):
            factor_exposures[f] = round(float(X[i, k]), 4)

        attribution.append({
            "ticker": t,
            "weight": round(float(w[i]) * 100, 2),
            "standaloneVol": round(asset_ann_vols.get(t, 0) * 100, 2),
            "underwrittenContrib": round(float(RC[i]), 6),
            "pctOfRisk": round(float(PctRC[i]) * 100, 2),
            "excessVsWeight": round(float(ExcessVsWeight[i]) * 100, 2),
            "compositeScore": round(float(scores[i]), 4),
            "riskLabel": labels[i],
            "factorExposures": factor_exposures,
            "factorContribs": factor_contribs,
        })

    attribution.sort(key=lambda x: x["pctOfRisk"], reverse=True)

    # ── Factor load breakdown ──
    factor_breakdown = []
    for k, f in enumerate(factor_names):
        factor_breakdown.append({
            "factor": f,
            "exposure": round(float(E[k]), 4),
            "crowding": round(float(C[k]), 4),
            "effectiveNames": round(float(N_eff[k]), 2),
            "load": round(float(L[k]), 6),
            "importance": round(float(a[k]), 2),
        })
    factor_breakdown.sort(key=lambda x: x["load"], reverse=True)

    return {
        "stocks": attribution,
        "factorBreakdown": factor_breakdown,
        "summary": {
            "underwrittenRisk": round(UR_total, 4),
            "highestLoadFactor": highest_load_factor,
            "highestLoadValue": round(highest_load_value, 4),
            "mostCrowdedFactor": most_crowded_factor,
            "mostCrowdedValue": round(most_crowded_value, 4),
            "top5RiskPct": round(top5_pct * 100, 2),
            "effectiveContributors": round(eff_contributors, 2),
        },
        "portfolioFactorProfile": {f: round(float(E[k]), 4) for k, f in enumerate(factor_names)},
    }


def compute_factor_overlap(valid_tickers, factor_names, importance_weights, exposure_matrix):
    """
    Descriptive only — pairwise factor profile overlap via weighted cosine similarity of z-scores.
    Not used for risk contribution.
    """
    n_assets = len(valid_tickers)
    n_factors = len(factor_names)
    a = np.array([importance_weights.get(f, 0.5) for f in factor_names])

    # Z-score each column
    Z = np.zeros_like(exposure_matrix)
    for k in range(n_factors):
        col = exposure_matrix[:, k]
        mu = np.mean(col)
        std = np.std(col, ddof=0)
        if std > 1e-12:
            Z[:, k] = (col - mu) / std
        else:
            Z[:, k] = 0.0
    Z = np.clip(Z, -2.5, 2.5)

    # Weighted cosine similarity
    Zw = Z * np.sqrt(a)
    norms = np.sqrt(np.sum(Zw ** 2, axis=1))
    norms[norms < 1e-12] = 1.0

    similarity = (Zw @ Zw.T) / np.outer(norms, norms)
    np.fill_diagonal(similarity, 1.0)
    similarity = np.clip(similarity, -1, 1)
    similarity = (similarity + similarity.T) / 2

    return {
        "tickers": valid_tickers,
        "matrix": similarity.tolist(),
    }
