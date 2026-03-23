#!/usr/bin/env python3
"""
Calculate a daily $100-rebased performance index for Maroon Fund.

Method:
- Carry forward the latest known position snapshot until the next snapshot date.
- NAV = sum(shares * yfinance_close) + cash, every day.
- Normalize both the fund and S&P 500 to 100 on the first trading day.
"""

import numpy as np
import pandas as pd
import yfinance as yf

POSITIONS_PATH = "calculating_nav/portfolio_positions_wide_by_date.csv"
OUTPUT_PATH = "calculating_nav/maroon_fund_nav.csv"
START_DATE = "2025-08-04"
END_DATE = "2026-03-21"  # yfinance end date is exclusive


def load_positions():
    pos = pd.read_csv(POSITIONS_PATH)
    pos["date"] = pd.to_datetime(pos["date"])

    exclude = {"date", "usd_cash", "estimated_nav_from_source"}
    ticker_cols = [c for c in pos.columns if c not in exclude]
    for col in ticker_cols:
        pos[col] = pos[col].fillna(0).astype(float)

    held = [ticker for ticker in ticker_cols if pos[ticker].sum() > 0]
    equity_tickers = [ticker for ticker in held if ticker != "GRAB"]
    return pos, equity_tickers


def main():
    pos, equity_tickers = load_positions()

    yf_map = {"BRK.B": "BRK-B", "FI": "FISV"}
    yf_symbols = [yf_map.get(ticker, ticker) for ticker in equity_tickers]

    print(f"Downloading prices for {len(yf_symbols)} tickers: {yf_symbols}")
    raw = yf.download(yf_symbols, start=START_DATE, end=END_DATE, auto_adjust=False, progress=False)
    close = raw["Close"].ffill()  # forward-fill gaps from multi-ticker alignment
    trading_days = close.index
    print(f"{len(trading_days)} trading days: {trading_days[0].date()} -> {trading_days[-1].date()}")

    # GRAB warrants — interpolate from known snapshot values (~$5-9 total, negligible)
    grab_known = {
        pd.Timestamp("2025-12-02"): 0.3465,
        pd.Timestamp("2026-01-20"): 0.2605,
        pd.Timestamp("2026-02-17"): 0.1706,
    }
    grab_series = pd.Series(grab_known, dtype=float)
    grab_series = grab_series.reindex(trading_days).interpolate(method="linear")
    grab_series = grab_series.ffill().bfill().fillna(0)

    # Calculate NAV each day: sum(shares * yfinance_close) + cash
    results = []

    for day in trading_days:
        valid = pos[pos["date"] <= day]
        if valid.empty:
            continue
        snap = valid.iloc[-1]

        nav = float(snap["usd_cash"])

        for ticker in equity_tickers:
            shares = float(snap[ticker])
            if shares == 0:
                continue
            yf_symbol = yf_map.get(ticker, ticker)
            price = float(close.loc[day, yf_symbol])
            if not np.isnan(price):
                nav += shares * price

        grab_shares = float(snap.get("GRAB", 0))
        if grab_shares > 0:
            grab_price = float(grab_series.loc[day])
            if not np.isnan(grab_price):
                nav += grab_shares * grab_price

        nav = round(nav, 2)
        results.append({"date": day, "nav": nav})

    df = pd.DataFrame(results)
    starting_nav = float(df.iloc[0]["nav"])
    df["fund_index"] = (df["nav"] / starting_nav * 100).round(2)

    print("Downloading S&P 500 data...")
    spx_raw = yf.download("^GSPC", start=START_DATE, end=END_DATE, auto_adjust=False, progress=False)
    spx_close = spx_raw["Close"].squeeze()
    spx_start = float(spx_close.iloc[0])
    df["sp500_index"] = df["date"].apply(
        lambda day: round(float(spx_close.loc[day]) / spx_start * 100, 2)
        if day in spx_close.index
        else np.nan
    )

    output = df.copy()
    output["date"] = output["date"].dt.strftime("%Y-%m-%d")
    output[["date", "fund_index", "sp500_index"]].to_csv(OUTPUT_PATH, index=False)

    print(f"\nSaved {len(output)} rows to {OUTPUT_PATH}")
    print(f"Starting total NAV: ${starting_nav:,.2f} -> normalized to fund_index=100.00")
    print(f"Fund index range: ${output['fund_index'].min():.2f} - ${output['fund_index'].max():.2f}")
    print(f"S&P 500 range:    ${output['sp500_index'].min():.2f} - ${output['sp500_index'].max():.2f}")

    final_fund = float(output.iloc[-1]["fund_index"])
    final_sp = float(output.iloc[-1]["sp500_index"])
    print(f"\nFinal (3/20/26): Fund={final_fund:.2f}  S&P500={final_sp:.2f}")
    print(f"Fund return: {final_fund - 100:+.2f}%   S&P return: {final_sp - 100:+.2f}%")

    # Compare against known estimated NAVs on snapshot dates
    print("\n── Snapshot comparison (yfinance close vs source estimates) ──")
    for _, row in pos.iterrows():
        d = row["date"].strftime("%Y-%m-%d")
        expected = row["estimated_nav_from_source"]
        match = output[output["date"] == d]
        if not match.empty:
            calc = df.loc[df["date"] == pd.Timestamp(d), "nav"].iloc[0]
            diff_pct = (calc - expected) / expected * 100
            print(f"  {d}: calculated=${calc:,.2f}  source=${expected:,.2f}  diff={diff_pct:+.2f}%")

    print("\nFirst 10 rows:")
    print(output[["date", "fund_index", "sp500_index"]].head(10).to_string(index=False))
    print("\nLast 10 rows:")
    print(output[["date", "fund_index", "sp500_index"]].tail(10).to_string(index=False))


if __name__ == "__main__":
    main()
