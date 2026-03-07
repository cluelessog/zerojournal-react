# Metrics Methodology

This document explains the calculation methodology for key trading metrics in zeroJournal v2.

## Sharpe Ratio

### Formula

```
Sharpe = (mean(R) - Rf) / std(R) × √252
```

Where:
- `R` = daily percentage returns (realized P&L / daily invested capital)
- `Rf` = annualized risk-free rate (default: 2%, converted to daily: 2% / 252)
- `std(R)` = sample standard deviation of daily returns (N-1 denominator)
- `√252` = annualization factor (252 trading days per year)

### Calculation Process

1. **Daily Invested Capital**: For each trading day, sum `price × quantity` for all BUY trades
2. **Daily Percentage Returns**: For each day with invested capital > 0, compute `daily_pnl / daily_invested_capital`
3. **Skip Sell-Only Days**: Days with no buy trades (and thus no invested capital) are excluded from the returns series
4. **Sharpe Calculation**: Apply the formula above to the percentage returns array

### Edge Cases

- **Fewer than 2 returns**: Sharpe = 0 (insufficient data)
- **Zero standard deviation**: Sharpe = 0 (no volatility to measure)
- **No buy trades**: Sharpe = 0 (no capital deployed)

### Example

```
Day 1: Buy 100 @ INR 500 (capital = 50,000), sell @ INR 502
  Daily P&L = 200
  Daily return = 200 / 50,000 = 0.004 (0.4%)

Day 2: Identical
  Daily return = 0.004

Sharpe = ((0.004 - 0.02/252) / std(0.004, 0.004)) × √252
       ≈ 7.99 (very high, since volatility is near zero)
```

### Industry Standards

- **Reference**: Sharpe, W. (1994). "The Sharpe Ratio". Journal of Portfolio Management.
- **Academic**: Taught in CFA curriculum as the standard risk-adjusted return metric
- **Professional Use**: Implemented in Tradervue, Edgewonk, and professional trading journals

## Maximum Drawdown

### Formula

```
Drawdown(t) = (V(t) - Peak(t)) / Peak(t) × 100%
```

Where:
- `V(t)` = cumulative portfolio value at time t
- `Peak(t)` = maximum cumulative value before time t

### Calculation Process

1. Build cumulative P&L series from `SymbolPnL.realizedPnL` distributed across sell dates proportionally by sell quantity (per-trade attribution)
2. Track the running maximum (high-water mark) as you walk through time
3. At each point, compute the percentage decline from that peak
4. Return the worst (most negative) drawdown value

### Maximum Drawdown per Month

Same algorithm, but applied to each calendar month independently:
- Extract closed positions whose close month is this month
- Build cumulative P&L from `SymbolPnL.realizedPnL` within the month (per-trade attribution, filtered to month dates)
- Apply the high-water-mark algorithm with month-start equity (capital + prior months' cumulative P&L) as baseline
- Return the month's maximum drawdown

### Edge Cases

- **Month never goes positive**: drawdown = 0 (no peak established)
- **Single trade month**: drawdown = 0 (single point, no peak)
- **All losses**: drawdown approaches -100%

### Data Sources

- **Overall drawdown** (`TradeAnalytics.maxDrawdown`): Uses `SymbolPnL.realizedPnL` distributed across sell dates proportionally by sell quantity (per-trade attribution)
- **Monthly drawdown** (`MonthlyMetric.maxDrawdown`): Same per-trade attribution, filtered to the month's dates, with month-start equity as baseline
- **Monthly P&L** (`MonthlyMetric.netPnL`): Uses `SymbolPnL.realizedPnL` from the PnL file

Note: These data sources may diverge for multi-day positions (e.g., position opened in Month A, closed in Month B). This is expected and acceptable.

### Industry Standards

- **Definition**: Standard definition per Investopedia, CFA curriculum
- **Professional Use**: Core metric in risk management across all trading domains

## Win Rate

### Formula

```
Win% = (winning trades / total trades) × 100%
```

Where:
- Winning trade = realized P&L > 0
- Losing trade = realized P&L < 0
- Breakeven trade = realized P&L === 0 (counted separately)

## Gross P&L vs Net P&L

- **Gross P&L**: Total realized P&L from all closed positions
- **Charges**: Fees, commissions, slippage allocated to the period
- **Net P&L**: Gross P&L - Charges

---

**Version**: 1.0
**Last Updated**: 2026-03-04
**Author**: zeroJournal Development Team
