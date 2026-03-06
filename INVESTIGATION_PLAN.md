# Investigation & Fix Plan: Charges Mismatch & Monthly Max DD Display Issues

## Issue 1: Charges Mismatch Between Analysis Tab and Dashboard

### Current Behavior
- **Dashboard Overview** (MetricsCards): Shows `Total Charges = pnlSummary.charges.total - pnlSummary.charges.dpCharges`
- **Analytics Tab** (Monthly breakdown table): Shows per-month charges allocated proportionally
- **Discrepancy**: Sum of monthly charges ≠ Total Charges displayed on dashboard

### Root Cause Analysis
1. **Calculation in MetricsCards.tsx (line 63):**
   ```typescript
   const totalChargesExclDP = pnlSummary.charges.total - pnlSummary.charges.dpCharges
   ```

2. **Calculation in calculateMonthlyBreakdown (line 428, 503-505):**
   ```typescript
   const totalChargesAlloc = pnlSummary.charges.total - pnlSummary.charges.dpCharges
   const charges = totalTrades > 0
     ? (tradeCount / totalTrades) * totalChargesAlloc
     : 0
   ```

### Problem Identified
**Rounding Error in Proportional Allocation:**
- Monthly charges are calculated as: `(monthTrades / totalTrades) * totalChargesAlloc`
- Each month is rounded independently using `.toFixed(2)` for display
- **Example:** If total = 100, and 3 months have 33%, 33%, 34% of trades:
  - Month 1: 100 * 0.33 = 33.00
  - Month 2: 100 * 0.33 = 33.00
  - Month 3: 100 * 0.34 = 34.00
  - Sum = 100.00 ✅ (works by chance)

- But with real fractional percentages, rounding can cause drift

**Secondary Issue:**
- User imported two separate months with different charge percentages
- Monthly allocation uses simple (tradeCount/totalTrades) weighting
- This assumes charges scale linearly with trade count, but they may not
- **Real charges may correlate with trading volume (Rs.) not trade count**

### Why Analysis Tab Shows "Correct"
- Each month's charges are calculated **from the original PnL file data**
- PnL file contains realized P&L breakdown per symbol/month
- Monthly charges should be calculated from actual close-date attribution
- Currently: We're **allocating total charges**, not reading actual per-month charges from PnL

---

## Issue 2: Monthly Max Drawdown Shows Mixed Percentage & Amount Values

### Current Behavior
- Some months display as: `−52.5%` (percentage)
- Other months display as: `Rs. 2,450` (absolute INR)
- Inconsistent formatting makes it confusing which value type you're looking at

### Root Cause Analysis

1. **MaxDrawdownMode not set consistently in calculateMonthlyBreakdown:**
   ```typescript
   // Line 533-535
   const monthDDResult = computeHWMDrawdown(monthCumulative, initialCapital)
   const monthMaxDrawdown = monthDDResult.value
   const monthMaxDrawdownMode = monthDDResult.mode  // <-- This may be undefined
   ```

2. **In computeHWMDrawdown (line 110-155):**
   - Mode is set to `'percentage'` only when `peak > 0` (line 147-151)
   - When peak never goes positive (pure-loss month), mode is **never set**
   - Returns `{ value: ..., peakDate: ..., troughDate: ..., status: ... }` **without mode field**

3. **TypeScript doesn't catch this:**
   - DrawdownMetric.mode is optional in type definition: `mode?: 'percentage' | 'absolute'`
   - undefined mode causes display to fall back to percentage formatting (line 257)
   - But the value might actually be in absolute INR

### Problem Details
```typescript
// Line 257 in DashboardPage.tsx
{m.maxDrawdownMode === 'absolute'
  ? `Rs. ${Math.abs(m.maxDrawdown).toLocaleString('en-IN')}`
  : `${m.maxDrawdown.toFixed(1)}%`}
```
- When `m.maxDrawdownMode` is `undefined`, it displays as percentage (wrong for absolute values)
- For a month with -2,450 INR loss showing as "−2450.0%" looks absurd

---

## Proposed Solutions

### Fix 1: Charges Mismatch (Better Accuracy)

**Option A: Read Actual Monthly Charges from Symbol P&L**
- Currently: Allocate total charges proportionally by trade count
- Proposed: Calculate charges per month from actual SymbolPnL close dates
- Benefits:
  - Reflects actual charge incurrence from brokers
  - No rounding errors (charges are atomic)
  - More accurate per-month profit/loss reporting
- Implementation:
  - Modify calculateMonthlyBreakdown to sum charges per month from closeMonth attribution
  - Total = sum of monthly charges (verifiable)

**Option B: Fix Rounding Accumulation** (Simpler, less accurate)
- Keep current allocation approach
- Fix rounding by:
  1. Calculate all monthly charges (with full precision, no rounding)
  2. On the last month, inject remainder: `lastMonthCharges += totalChargesAlloc - sumOfOtherMonths`
  3. Display only the final rounded value
- Benefits: Simpler, backward compatible, no data structure changes
- Drawbacks: Last month absorbs rounding errors

**Recommendation:** Option A (read from SymbolPnL) is more accurate and aligns with how P&L is attributed

---

### Fix 2: Monthly Max Drawdown Mode Consistency

**Root Fix: Ensure mode is always set in computeHWMDrawdown**
1. When `peak > 0`: Set mode to `'percentage'`
2. When `peak === 0 && hasCapital`: Set mode to `'percentage'` (capital is set but no trading occurred)
3. When `peak === 0 && !hasCapital && minValue < 0`: Set mode to `'absolute'`
4. When no trades/data: Set status to `'no_data'` and leave mode undefined

2. **Add runtime validation in calculateMonthlyBreakdown:**
   - After calling `computeHWMDrawdown`, check if mode is set
   - If undefined and mode is needed: **log warning and infer from context**
   - Provide sensible default: Prefer percentage if capital is set, else absolute

3. **Update display logic to be more robust:**
   - Null-coalesce: `(m.maxDrawdownMode ?? (initialCapital ? 'percentage' : 'absolute'))`
   - Add assertion: never show percentage for values > −100 when no capital is set

**Recommendation:** Fix mode assignment in computeHWMDrawdown + add validation + improve display logic

---

## Implementation Priority

1. **HIGH:** Fix #2 (Mode consistency) — quick win, prevents user confusion
2. **MEDIUM:** Fix #1 (Charges accuracy) — better reporting, requires careful testing

---

## Verification Steps

### After Fix #1 (Charges):
- [ ] Sum of monthly charges in Analytics tab = Total Charges in Dashboard
- [ ] Each month's charge amount is non-negative
- [ ] Total charges matches PnL file's charges breakdown
- [ ] No rounding discrepancies > 0.01 INR

### After Fix #2 (Max DD Mode):
- [ ] Every month shows either percentage (e.g., −45.2%) OR amount (e.g., Rs. 5,432)
- [ ] Percentage values always >= −100%
- [ ] Absolute values never formatted with % symbol
- [ ] When capital is set: all months show percentages (if peak > 0)
- [ ] When capital is null: all months show absolute values (if peak never > 0)
- [ ] No undefined mode values in any month
