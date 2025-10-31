# UI Testing Documentation

This document describes the UI testing infrastructure for the Die With Zero financial planner.

## Overview

To prevent UI bugs as the implementation evolves, all critical UI calculation functions have been:
1. **Isolated** into a dedicated module ([ui-functions.ts](src/ui-functions.ts))
2. **Well-documented** with JSDoc comments explaining inputs, outputs, and behavior
3. **Comprehensively tested** with 42 unit tests covering all edge cases

## UI Functions

The following critical UI functions are now isolated and tested:

### 1. `calculateProjection(params, options?)`
**Purpose**: Calculates the year-by-year financial projection that populates the table rows.

**Tested scenarios**:
- ✅ Correct number of rows generated
- ✅ Year 0 starting values (assets, income, expenses, savings)
- ✅ Income growth over time (compounding)
- ✅ Tax rate changes by year range
- ✅ Savings distribution to liquid assets (proportional)
- ✅ Asset appreciation rates
- ✅ Negative savings (liquidation)
- ✅ Asset transactions (percentage and fixed amount)
- ✅ Net worth change tracking
- ✅ Zero income from a specific year (retirement simulation)

**Example**:
```typescript
const projection = calculateProjection(params);
console.log(projection[0].totalNetWorth); // Starting net worth
console.log(projection[5].savings); // Savings in year 5
```

### 2. `calculateDieWithZeroAnalysis(params)`
**Purpose**: Calculates the "Die With Zero" analysis shown in the analysis cards.

**Tested scenarios**:
- ✅ Final net worth if you stop working now
- ✅ Optimal retirement year to reach target
- ✅ Optimal final worth
- ✅ Required annual savings to reach target
- ✅ Zero target handling
- ✅ Unreachable target handling
- ✅ Shortfall calculation
- ✅ "On track" scenario

**Example**:
```typescript
const analysis = calculateDieWithZeroAnalysis(params);
console.log(`Retire at year ${analysis.optimalYear}`);
console.log(`You need ${analysis.requiredAnnualSavings}/year more`);
```

### 3. `calculateEstimatedNetIncome(income, taxRangeItem)`
**Purpose**: Calculates the estimated net income shown in the tax range configuration tooltip.

**Tested scenarios**:
- ✅ Net income calculation for different tax rates (0%, 20%, 40%, 100%)
- ✅ Different income types (fixed, range, manual)
- ✅ Income growth over time

**Example**:
```typescript
const netIncome = calculateEstimatedNetIncome(
  params.income,
  { from: 10, rate: 0.40 } // Year 10 with 40% tax
);
console.log(`Net income: €${netIncome}`);
```

### 4. `calculateAssetValueAtYear(params, assetName, year)`
**Purpose**: Calculates the asset value at the end of a specific year, shown in the transaction tooltip.

**Tested scenarios**:
- ✅ Asset value calculation for different assets
- ✅ Value after income/expenses/appreciation
- ✅ Value BEFORE transactions (for transaction planning)
- ✅ Expense losses (liquidation)
- ✅ Incoming transfers
- ✅ Year out of range handling
- ✅ Non-existent asset handling

**Example**:
```typescript
const cryptoValue = calculateAssetValueAtYear(params, 'Crypto', 5);
console.log(`Crypto value at year 5: €${cryptoValue}`);
```

## Running Tests

### Run all tests
```bash
bun test
```

### Run tests in watch mode
```bash
bun test --watch
```

### Run specific test file
```bash
bun test src/ui-functions.test.ts
```

## Test Output

All 46 tests currently pass:
- **19 tests** for `calculateProjection`
- **7 tests** for `calculateDieWithZeroAnalysis`
- **6 tests** for `calculateEstimatedNetIncome`
- **7 tests** for `calculateAssetValueAtYear`
- **7 integration tests** to ensure all functions work together

## Test Coverage

The tests use **actual financial plan data** from [config.ts](src/config.ts) to ensure realistic scenarios:
- 40 year projection
- Range income: €100k (years 0-4), €150k (years 5-14), €0 (years 15+, retirement)
- Fixed expenses with 1% inflation (€50k starting)
- Tax rates: 25% (years 0-9), 40% (years 10+)
- 3 assets: ETFs (€200k, 5% return), Crypto (€50k, 10% return), Bonds (€0, 2% return)
- 3 strategic transactions:
  - Year 5: 50% Crypto → ETFs
  - Year 10: 100% Crypto → Bonds
  - Year 15: 100% ETFs → Bonds

### Edge Cases Tested

1. **Income changes over time**: Tests verify range-based income changes (€100k → €150k → €0 at retirement).

2. **Tax rate changes**: Tests verify different tax rates apply correctly at different year ranges.

3. **Asset liquidation**: When expenses exceed income (after year 15), liquid assets are proportionally liquidated to cover the shortfall.

4. **Multiple transactions across years**: All three transactions (years 5, 10, 15) are tested to ensure proper asset transfers.

5. **Transaction timing**: All transactions use the SAME pre-transaction asset values to avoid order-dependent behavior.

6. **Floating point precision**: Tests use `toBeCloseTo()` for numerical comparisons to handle JavaScript floating point arithmetic.

7. **Zero income scenarios**: Tests verify behavior when income drops to zero (retirement simulation).

## Integration with Main Application

The [main.ts](src/main.ts) file has been refactored to use these UI functions:

**Before**:
```typescript
computed: {
  projection(): ProjectionRow[] {
    return this._projectBase({ /* ... */ }); // 200+ lines inline
  }
}
```

**After**:
```typescript
computed: {
  projection(): ProjectionRow[] {
    return calculateProjection(this.params); // Clean, tested function
  }
}
```

This ensures:
- ✅ The UI logic is **tested** and **documented**
- ✅ Changes to calculations are **verified** by tests
- ✅ The main component stays **focused** on UI concerns
- ✅ Functions can be **reused** elsewhere if needed

## Adding New Tests

When adding new UI features or modifying calculations:

1. **Add the function** to [ui-functions.ts](src/ui-functions.ts) with JSDoc documentation
2. **Write tests** in [ui-functions.test.ts](src/ui-functions.test.ts)
3. **Update this document** with the new function
4. **Run tests** to ensure everything passes

### Test Template

```typescript
describe('myNewFunction', () => {
  test('should handle basic case', () => {
    const result = myNewFunction(EXAMPLE_DATA);
    expect(result).toBe(expectedValue);
  });

  test('should handle edge case', () => {
    // Test edge cases like zero, negative, empty, etc.
  });
});
```

## Expected Behaviors (Not Bugs)

During testing implementation, the following behaviors were observed and are **working as designed**:

1. **Negative net worth in late years**: With zero income (retirement at year 15), expenses continue but income stops, leading to asset depletion. This is **by design** for the "die with zero" philosophy.

2. **Asset values can go negative**: When liquidating for expenses exceeds available assets, values can temporarily go negative. This indicates the plan is unsustainable and user needs to adjust parameters.

3. **All assets convert to Bonds by year 15**: The strategic transactions gradually move all assets into Bonds, which then get liquidated to fund retirement expenses.

## Continuous Integration

You can add these tests to your CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: cd web && bun install
      - run: cd web && bun test
```

## Maintenance

- **Run tests after any changes** to calculation logic
- **Update tests** when intentionally changing behavior
- **Add tests** for new features before implementing them (TDD)
- **Review test coverage** periodically to identify gaps

---

**Last Updated**: 2025-10-31
**Test Framework**: Bun Test Runner
**Total Tests**: 46
**Pass Rate**: 100%
**Test Data**: Based on actual financial plan (financial-plan-2025-10-31.json)
