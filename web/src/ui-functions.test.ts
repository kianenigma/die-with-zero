/**
 * UI Functions Test Suite
 *
 * Comprehensive tests for all UI functions using the example data.
 * These tests ensure that the UI calculations remain correct as the
 * implementation evolves.
 *
 * Updated to use actual financial plan data (financial-plan-2025-10-31.json)
 */

import { describe, test, expect } from 'bun:test';
import {
	calculateProjection,
	calculateDieWithZeroAnalysis,
	calculateEstimatedNetIncome,
	calculateAssetValueAtYear
} from './ui-functions';
import { EXAMPLE_DATA } from './config';
import type { FinancialParams } from './types';

describe('calculateProjection', () => {
	test('should generate correct number of rows', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		expect(projection.length).toBe(EXAMPLE_DATA.years);
	});

	test('should calculate year 0 correctly (starting point)', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		expect(year0.year).toBe(0);
		// 200k ETFs + 50k Crypto + 0 Bonds = 250k
		expect(year0.totalNetWorth).toBe(250000);
	});

	test('should calculate gross income correctly for year 0', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Range income: year 0 has 100,000
		expect(year0.grossIncome).toBe(100000);
	});

	test('should calculate tax correctly for year 0', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Tax range: year 0 has 25% rate (0.25)
		expect(year0.tax).toBe(25);
	});

	test('should calculate net income correctly for year 0', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Net income = gross * (1 - tax rate) = 100000 * (1 - 0.25) = 75000
		expect(year0.netIncome).toBe(75000);
	});

	test('should calculate expenses correctly for year 0', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Fixed expense: 50,000 starting
		expect(year0.expenses).toBe(50000);
	});

	test('should calculate savings correctly for year 0', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Savings = net income - expenses = 75000 - 50000 = 25000
		expect(year0.savings).toBe(25000);
	});

	test('should distribute savings proportionally to liquid assets', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Year 0 starting: ETFs = 200k, Crypto = 50k, Bonds = 0, total liquid = 250k
		// Savings = 25k
		// ETFs proportion: 200k/250k = 4/5, gets 25k * 4/5 = 20k
		// Crypto proportion: 50k/250k = 1/5, gets 25k * 1/5 = 5k

		expect(year0.assetSavingsContributions?.ETFs).toBeCloseTo(20000, 0);
		expect(year0.assetSavingsContributions?.Crypto).toBeCloseTo(5000, 0);
		expect(year0.assetSavingsContributions?.Bonds).toBe(0); // Has 0 value, gets 0
	});

	test('should apply appreciation rates correctly', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// ETFs: start with 200k, add 20k savings = 220k, then 5% appreciation = 11k
		// Crypto: start with 50k, add 5k savings = 55k, then 10% appreciation = 5.5k
		// Bonds: 0, no appreciation

		expect(year0.assetAppreciation?.ETFs).toBeCloseTo(11000, 0);
		expect(year0.assetAppreciation?.Crypto).toBeCloseTo(5500, 0);
		expect(year0.assetAppreciation?.Bonds).toBe(0);
	});

	test('should calculate year 1 starting values correctly', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year1 = projection[1];

		// Year 0: ETFs start at 200k, add 20k savings, add 11k appreciation = 231k
		// Year 0: Crypto start at 50k, add 5k savings, add 5.5k appreciation = 60.5k
		// Total = 291.5k

		expect(year1.assets?.ETFs).toBeCloseTo(231000, 0);
		expect(year1.assets?.Crypto).toBeCloseTo(60500, 0);
		expect(year1.totalNetWorth).toBeCloseTo(291500, 0);
	});

	test('should handle income changes in range', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// Income range: 0-4 = 100k, 5-14 = 150k, 15+ = 0
		expect(projection[0].grossIncome).toBe(100000);
		expect(projection[4].grossIncome).toBe(100000);
		expect(projection[5].grossIncome).toBe(150000);
		expect(projection[14].grossIncome).toBe(150000);
		expect(projection[15].grossIncome).toBe(0);
		expect(projection[20].grossIncome).toBe(0);
	});

	test('should apply different tax rates based on year ranges', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// Tax range: 0-9 = 25%, 10+ = 40%
		expect(projection[0].tax).toBe(25);
		expect(projection[9].tax).toBe(25);
		expect(projection[10].tax).toBe(40);
		expect(projection[20].tax).toBe(40);
	});

	test('should handle zero income from a specific year', () => {
		const projection = calculateProjection(EXAMPLE_DATA, { zeroIncomeFromYear: 5 });

		// Years 0-4 should have income
		expect(projection[0].grossIncome).toBeGreaterThan(0);
		expect(projection[4].grossIncome).toBeGreaterThan(0);

		// Years 5+ should have zero income
		expect(projection[5].grossIncome).toBe(0);
		expect(projection[10].grossIncome).toBe(0);
	});

	test('should handle negative savings (liquidation) after income stops', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// After year 15, income is 0 but expenses continue
		// However, at year 15, all ETFs were transferred to Bonds
		// Bonds are liquid now (in new data), so they'll be liquidated
		const year16 = projection[16];

		// Net income = 0 * 0.6 = 0
		// Expenses = 50000 * (1.01)^16 ≈ 58,656
		// Savings = negative (liquidation needed)

		expect(year16.netIncome).toBe(0);
		expect(year16.savings).toBeLessThan(0);
		// At year 16, Bonds (which has all the money) will be liquidated
		expect(year16.assetExpenseLosses?.Bonds).toBeGreaterThan(0);
	});

	test('should track net worth change correctly', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year0 = projection[0];

		// Year 0: start 250k, end ~286.5k, change ~36.5k
		const expectedChange = projection[1].totalNetWorth - projection[0].totalNetWorth;
		expect(year0.netWorthChange).toBeCloseTo(expectedChange, 0);
	});

	test('should handle transactions at year 5 correctly', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year5 = projection[5];

		// Transaction: 50% of Crypto to ETFs
		expect(year5.assetOutgoingTransfers?.Crypto).toBeGreaterThan(0);
		expect(year5.assetIncomingTransfers?.ETFs).toBeGreaterThan(0);
		expect(year5.assetOutgoingTransfers?.Crypto).toBeCloseTo(
			year5.assetIncomingTransfers?.ETFs || 0,
			0
		);
	});

	test('should handle transactions at year 10 correctly', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year10 = projection[10];

		// Transaction: 100% of remaining Crypto to Bonds
		expect(year10.assetOutgoingTransfers?.Crypto).toBeGreaterThan(0);
		expect(year10.assetIncomingTransfers?.Bonds).toBeGreaterThan(0);
	});

	test('should handle transactions at year 15 correctly', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year15 = projection[15];

		// Transaction: 100% of ETFs to Bonds
		expect(year15.assetOutgoingTransfers?.ETFs).toBeGreaterThan(0);
		expect(year15.assetIncomingTransfers?.Bonds).toBeGreaterThan(0);
	});

	test('last year should have no changes', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const lastYear = projection[projection.length - 1];

		// Last year should have netWorthChange of 0
		expect(lastYear.netWorthChange).toBe(0);
	});
});

describe('calculateDieWithZeroAnalysis', () => {
	test('should calculate stop now correctly', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		// If stop working immediately, net worth will decline (no income, still expenses)
		expect(typeof analysis.stopNow).toBe('number');
		expect(analysis.stopNow).toBeLessThan(analysis.currentFinalWorth); // Less than if you keep working
	});

	test('should find optimal retirement year', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		// With target of 0, should find a year that reaches it
		expect(analysis.optimalYear).not.toBeNull();
		expect(analysis.optimalYear).toBeGreaterThanOrEqual(0);
		expect(analysis.optimalYear).toBeLessThanOrEqual(EXAMPLE_DATA.years);
	});

	test('should calculate optimal final worth', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		// Should return a number
		expect(typeof analysis.optimalFinalWorth).toBe('number');
	});

	test('should calculate required annual savings', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		// Should return null or a number
		expect(
			analysis.requiredAnnualSavings === null ||
			typeof analysis.requiredAnnualSavings === 'number'
		).toBe(true);
	});

	test('should handle zero target correctly', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		expect(analysis.target).toBe(0); // Target is 0 in new data
		expect(analysis.optimalYear).not.toBeNull();
	});

	test('should handle unreachable target', () => {
		const params: FinancialParams = {
			...EXAMPLE_DATA,
			targetFinalNetWorth: 100000000 // 100M - likely unreachable
		};

		const analysis = calculateDieWithZeroAnalysis(params);

		// Should still return an optimal year (closest approach)
		expect(analysis.optimalYear).not.toBeNull();
		expect(analysis.optimalFinalWorth).toBeLessThan(analysis.target);
	});

	test('should calculate shortfall correctly', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		const shortfall = analysis.target - analysis.currentFinalWorth;

		if (analysis.requiredAnnualSavings !== null) {
			const expectedAnnualSavings = shortfall / EXAMPLE_DATA.years;
			expect(analysis.requiredAnnualSavings).toBeCloseTo(expectedAnnualSavings, 0);
		}
	});
});

describe('calculateEstimatedNetIncome', () => {
	test('should calculate net income for year 0 with 25% tax', () => {
		const netIncome = calculateEstimatedNetIncome(
			EXAMPLE_DATA.income,
			{ from: 0, rate: 0.25 }
		);

		// Gross income at year 0 = 100,000
		// Net income = 100,000 * (1 - 0.25) = 75,000
		expect(netIncome).toBe(75000);
	});

	test('should calculate net income for year 5 with 25% tax', () => {
		const netIncome = calculateEstimatedNetIncome(
			EXAMPLE_DATA.income,
			{ from: 5, rate: 0.25 }
		);

		// Gross income at year 5 = 150,000 (range change)
		// Net income = 150,000 * (1 - 0.25) = 112,500
		expect(netIncome).toBe(112500);
	});

	test('should calculate net income for year 10 with 40% tax', () => {
		const netIncome = calculateEstimatedNetIncome(
			EXAMPLE_DATA.income,
			{ from: 10, rate: 0.40 }
		);

		// Gross income at year 10 = 150,000
		// Net income = 150,000 * (1 - 0.40) = 90,000
		expect(netIncome).toBe(90000);
	});

	test('should calculate net income for year 15 with any tax (income is 0)', () => {
		const netIncome = calculateEstimatedNetIncome(
			EXAMPLE_DATA.income,
			{ from: 15, rate: 0.40 }
		);

		// Gross income at year 15 = 0 (range change to 0)
		// Net income = 0 * (1 - 0.40) = 0
		expect(netIncome).toBe(0);
	});

	test('should handle different income types - fixed', () => {
		const params: FinancialParams = {
			...EXAMPLE_DATA,
			income: {
				type: 'fixed',
				years: 40,
				payload: {
					start: 80000,
					growth: 0.03
				}
			}
		};

		const netIncome0 = calculateEstimatedNetIncome(
			params.income,
			{ from: 0, rate: 0.25 }
		);

		expect(netIncome0).toBe(60000); // 80k * 0.75
	});

	test('should handle different income types - manual', () => {
		const manualIncome = new Array(40).fill(75000);
		manualIncome[5] = 90000;

		const params: FinancialParams = {
			...EXAMPLE_DATA,
			income: {
				type: 'manual',
				years: 40,
				payload: manualIncome
			}
		};

		const netIncome5 = calculateEstimatedNetIncome(
			params.income,
			{ from: 5, rate: 0.30 }
		);

		expect(netIncome5).toBeCloseTo(63000, 0); // 90k * 0.7
	});
});

describe('calculateAssetValueAtYear', () => {
	test('should calculate ETFs value at year 0', () => {
		const value = calculateAssetValueAtYear(EXAMPLE_DATA, 'ETFs', 0);

		// Year 0 starting: 200k
		// + savings contribution: 20k
		// + appreciation: 11k
		// = 231k
		expect(value).toBeCloseTo(231000, 0);
	});

	test('should calculate Crypto value at year 0', () => {
		const value = calculateAssetValueAtYear(EXAMPLE_DATA, 'Crypto', 0);

		// Year 0 starting: 50k
		// + savings contribution: 5k
		// + appreciation: 5.5k
		// = 60.5k
		expect(value).toBeCloseTo(60500, 0);
	});

	test('should return 0 for year beyond projection', () => {
		const value = calculateAssetValueAtYear(EXAMPLE_DATA, 'ETFs', 100);
		expect(value).toBe(0);
	});

	test('should return 0 for non-existent asset', () => {
		const value = calculateAssetValueAtYear(EXAMPLE_DATA, 'NonExistent', 0);
		expect(value).toBe(0);
	});

	test('should calculate value before transaction at year 5', () => {
		// Year 5 has a transaction: 50% of Crypto to ETFs
		const cryptoValue = calculateAssetValueAtYear(EXAMPLE_DATA, 'Crypto', 5);

		// Should show value BEFORE the transfer
		expect(cryptoValue).toBeGreaterThan(0);
	});

	test('should handle assets after income stops', () => {
		// After year 15, income is 0 but expenses continue
		const value = calculateAssetValueAtYear(EXAMPLE_DATA, 'Bonds', 16);

		// Bonds should have value from previous transactions
		expect(typeof value).toBe('number');
	});

	test('should correctly sum all gains and losses', () => {
		const projection = calculateProjection(EXAMPLE_DATA);
		const year1 = projection[1];

		const etfsValue = calculateAssetValueAtYear(EXAMPLE_DATA, 'ETFs', 1);

		const expectedValue = (year1.assets?.ETFs || 0) +
			(year1.assetAppreciation?.ETFs || 0) +
			(year1.assetSavingsContributions?.ETFs || 0) +
			(year1.assetIncomingTransfers?.ETFs || 0) -
			(year1.assetExpenseLosses?.ETFs || 0);

		expect(etfsValue).toBeCloseTo(expectedValue, 0);
	});
});

describe('Integration tests with actual financial plan', () => {
	test('entire projection should be consistent', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// All rows should have valid data
		projection.forEach((row, index) => {
			expect(row.year).toBe(index);
			expect(typeof row.totalNetWorth).toBe('number');
			expect(row.grossIncome).toBeGreaterThanOrEqual(0);
			expect(row.tax).toBeGreaterThanOrEqual(0);
			expect(row.netIncome).toBeGreaterThanOrEqual(0);
			expect(row.expenses).toBeGreaterThanOrEqual(0);
		});
	});

	test('asset values can go negative when liquidating for expenses', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// After income stops, assets will be liquidated
		projection.forEach(row => {
			if (row.assets) {
				Object.values(row.assets).forEach(value => {
					expect(typeof value).toBe('number');
				});
			}
		});
	});

	test('die with zero analysis should be reasonable', () => {
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);

		expect(typeof analysis.stopNow).toBe('number');
		expect(typeof analysis.currentFinalWorth).toBe('number');
		expect(analysis.optimalYear).toBeGreaterThanOrEqual(0);
		expect(analysis.target).toBe(EXAMPLE_DATA.targetFinalNetWorth);
	});

	test('all UI functions should work together', () => {
		// Test that all functions work with the same example data
		const projection = calculateProjection(EXAMPLE_DATA);
		const analysis = calculateDieWithZeroAnalysis(EXAMPLE_DATA);
		const netIncome = calculateEstimatedNetIncome(
			EXAMPLE_DATA.income,
			{ from: 0, rate: 0.25 }
		);
		const assetValue = calculateAssetValueAtYear(EXAMPLE_DATA, 'ETFs', 0);

		expect(projection.length).toBeGreaterThan(0);
		expect(analysis.optimalYear).not.toBeNull();
		expect(netIncome).toBeGreaterThan(0);
		expect(assetValue).toBeGreaterThan(0);
	});

	test('transactions work correctly across multiple years', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// Year 5: 50% Crypto -> ETFs
		expect(projection[5].assetOutgoingTransfers?.Crypto).toBeGreaterThan(0);
		expect(projection[5].assetIncomingTransfers?.ETFs).toBeGreaterThan(0);

		// Year 10: 100% Crypto -> Bonds
		expect(projection[10].assetOutgoingTransfers?.Crypto).toBeGreaterThan(0);
		expect(projection[10].assetIncomingTransfers?.Bonds).toBeGreaterThan(0);

		// Year 15: 100% ETFs -> Bonds
		expect(projection[15].assetOutgoingTransfers?.ETFs).toBeGreaterThan(0);
		expect(projection[15].assetIncomingTransfers?.Bonds).toBeGreaterThan(0);
	});

	test('income progression matches configuration', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// Years 0-4: 100k
		expect(projection[0].grossIncome).toBe(100000);
		expect(projection[4].grossIncome).toBe(100000);

		// Years 5-14: 150k
		expect(projection[5].grossIncome).toBe(150000);
		expect(projection[14].grossIncome).toBe(150000);

		// Years 15+: 0 (retirement)
		expect(projection[15].grossIncome).toBe(0);
		expect(projection[39].grossIncome).toBe(0);
	});

	test('expenses grow with inflation', () => {
		const projection = calculateProjection(EXAMPLE_DATA);

		// Year 0: 50k
		expect(projection[0].expenses).toBe(50000);

		// Year 10: 50k * (1.01)^10 ≈ 55,231
		expect(projection[10].expenses).toBeCloseTo(55231, 0);

		// Year 20: 50k * (1.01)^20 ≈ 61,010
		expect(projection[20].expenses).toBeCloseTo(61010, 0);
	});
});
