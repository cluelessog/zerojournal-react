# Plan: Fix Dashboard Overview Total Charges Display

## Problem Statement

**Issue:** Dashboard Overview shows incorrect "Total Charges" value that doesn't match the Analysis Tab.

**Evidence:**
- Dashboard Overview displays: `pnlSummary.charges.total - pnlSummary.charges.dpCharges` (recalculated)
- Analysis Tab displays: Monthly charges aggregated from `monthlyBreakdown` (proportionally allocated)
- These two sources are calculated differently → values don't match

**User Confirmation:** Analysis Tab monthly charges are **correct**. Dashboard Overview total is **wrong**.

---

## Root Cause

### Current Implementation

**1. Dashboard Overview (MetricsCards.tsx line 11-12):**
```typescript
const totalChargesExclDP = pnlSummary.charges.total - pnlSummary.charges.dpCharges
// Displayed as: Total Charges = Rs. X,XXX
```

**2. Analysis Tab Monthly Breakdown (analytics.ts line 428, 503-505):**
```typescript
const totalChargesAlloc = pnlSummary.charges.total - pnlSummary.charges.dpCharges
const monthlyCharges = (tradeCount / totalTrades) * totalChargesAlloc  // per month
```

**3. Comparison:**
- Dashboard: Takes `total - dpCharges` directly from `pnlSummary`
- Analysis Tab: Allocates `total - dpCharges` across months proportionally
- **They should be the same, but:**
  - Rounding errors in monthly allocation
  - Potential mismatch if monthly breakdown calculation differs

### Why This is Wrong

Dashboard Overview total charges should equal the **sum of all monthly charges** shown in the Analysis Tab. Currently:
- Dashboard shows value A
- Sum of Analysis Tab months = value B
- A ≠ B → User sees inconsistent data

---

## Solution

### Change 1: Pass monthlyBreakdown to MetricsCards

**File:** `src/components/dashboard/MetricsCards.tsx`

**Current signature:**
```typescript
export function MetricsCards({
  analytics,
  pnlSummary
}: MetricsCardsProps)
```

**Updated signature:**
```typescript
export function MetricsCards({
  analytics,
  pnlSummary,
  monthlyBreakdown  // ADD THIS
}: MetricsCardsProps)
```

**Update MetricsCardsProps interface:**
```typescript
interface MetricsCardsProps {
  analytics: TradeAnalytics | null
  pnlSummary: PnLSummary | null
  monthlyBreakdown?: MonthlyMetric[]  // ADD THIS
}
```

### Change 2: Calculate Total Charges from Monthly Breakdown

**File:** `src/components/dashboard/MetricsCards.tsx` line ~11

**Before:**
```typescript
const totalChargesExclDP = pnlSummary.charges.total - pnlSummary.charges.dpCharges
```

**After:**
```typescript
// Calculate total charges from monthly breakdown (source of truth for correct values)
const totalChargesExclDP = monthlyBreakdown && monthlyBreakdown.length > 0
  ? monthlyBreakdown.reduce((sum, m) => sum + m.charges, 0)
  : pnlSummary?.charges?.total && pnlSummary?.charges?.dpCharges
    ? pnlSummary.charges.total - pnlSummary.charges.dpCharges
    : 0
```

**Rationale:**
- Primary: Use sum of monthly charges (already correctly calculated)
- Fallback: Use pnlSummary calculation if monthlyBreakdown unavailable
- Result: Dashboard total = Analysis Tab sum ✅

### Change 3: Pass monthlyBreakdown from DashboardPage

**File:** `src/pages/DashboardPage.tsx` line ~76

**Before:**
```typescript
<MetricsCards analytics={analytics} pnlSummary={pnlSummary} />
```

**After:**
```typescript
<MetricsCards
  analytics={analytics}
  pnlSummary={pnlSummary}
  monthlyBreakdown={analytics?.monthlyBreakdown}
/>
```

---

## Expected Outcomes

### Before Fix
```
Dashboard Overview:        Total Charges = Rs. 20,817.67
Analysis Tab Sum:          Month 1 + Month 2 + ... = Rs. 20,816.45
User Confusion:            Values don't match ❌
```

### After Fix
```
Dashboard Overview:        Total Charges = Rs. 20,816.45
Analysis Tab Sum:          Month 1 + Month 2 + ... = Rs. 20,816.45
Consistency:               Values match ✅
```

---

## Related Issue: Monthly Max Drawdown Mixed Values

**This issue remains separate and should be addressed after this fix.**

The mixed percentage/absolute values in monthly Max DD are caused by `maxDrawdownMode` not being set consistently in `computeHWMDrawdown` when `peak === 0`.

**Proposed separate fix:**
1. Ensure `mode` is always set in `computeHWMDrawdown`
2. Add validation in `calculateMonthlyBreakdown`
3. Update display logic with fallback

---

## Implementation Checklist

- [ ] Update `MetricsCardsProps` interface to include `monthlyBreakdown`
- [ ] Update `MetricsCards` component signature
- [ ] Modify total charges calculation to use `monthlyBreakdown.reduce()`
- [ ] Update call site in `DashboardPage.tsx` to pass `monthlyBreakdown`
- [ ] Verify Dashboard Overview total matches Analysis Tab sum
- [ ] Test with multiple import scenarios
- [ ] No regression in other metrics

---

## Files to Modify

1. `src/components/dashboard/MetricsCards.tsx` (2 changes)
2. `src/pages/DashboardPage.tsx` (1 change)

**Total changes:** 3 locations, ~15 lines modified
