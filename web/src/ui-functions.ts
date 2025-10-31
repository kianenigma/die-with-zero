/**
 * UI Functions Module
 *
 * This module contains all critical UI calculation functions that are used
 * to display data in the interface. These functions are isolated from the
 * Vue component logic to enable comprehensive unit testing.
 *
 * Each function is well-documented and tested to ensure UI correctness as
 * the implementation evolves.
 */

import type {
	FinancialParams,
	ProjectionRow,
	DieWithZeroAnalysis,
	ProjectionOptions,
	Income,
	Tax
} from './types';
import {
	getIncomeForYear,
	getIncomeValue,
	getExpenseForYear,
	getExpenseValue,
	getTaxForYear,
	getTaxRate
} from './income';

/**
 * Calculates the financial projection for all years.
 *
 * This is the core function that populates each row of the projection table.
 * It tracks year-by-year changes in assets, income, expenses, and net worth.
 *
 * @param params - The complete financial parameters
 * @param options - Projection options (e.g., zero income from a certain year)
 * @returns Array of projection rows, one per year
 *
 * @example
 * const projection = calculateProjection(params);
 * // projection[0] contains year 0 data
 * // projection[5].totalNetWorth is the net worth at start of year 5
 */
export function calculateProjection(
	params: FinancialParams,
	options: ProjectionOptions = {}
): ProjectionRow[] {
	const {
		zeroIncomeFromYear = null,
		trackMilestones = true,
		trackGainsLosses = true
	} = options;

	const results: ProjectionRow[] = [];
	const p = params;

	// Initialize assets with starting values
	const assets: Record<string, number> = {};
	p.assets.forEach(a => assets[a.name] = a.amount);

	// Track milestones if requested
	const milestonesReached: Record<number, number | null> = {};
	if (trackMilestones) {
		p.milestones.forEach(m => milestonesReached[m] = null);
	}

	for (let year = 0; year < p.years; year++) {
		// Get income for this year (zero if past retirement)
		let currentGrossIncome = 0;
		if (zeroIncomeFromYear === null || year < zeroIncomeFromYear) {
			const incomeResult = getIncomeForYear(p.income, year);
			currentGrossIncome = getIncomeValue(incomeResult);
		}

		// Get tax rate for this year
		const taxResult = getTaxForYear(p.tax, year);
		const taxRate = getTaxRate(taxResult);

		// Get expenses for this year
		const expenseResult = getExpenseForYear(p.expense, year);
		const totalExpenses = getExpenseValue(expenseResult);

		const currentNetIncome = currentGrossIncome * (1 - taxRate);
		const totalNetWorth = Object.values(assets).reduce((sum, val) => sum + val, 0);
		const annualSavings = currentNetIncome - totalExpenses;

		// Check milestones if tracking
		if (trackMilestones) {
			for (const milestone of p.milestones) {
				if (milestonesReached[milestone] === null && totalNetWorth >= milestone) {
					milestonesReached[milestone] = year;
				}
			}
		}

		// Build result object - this shows START of year values
		const result: ProjectionRow = { year, totalNetWorth };

		if (trackGainsLosses) {
			// Get unrealized milestones
			const unrealized = p.milestones
				.filter(m => milestonesReached[m] === null)
				.map(m => '€' + (m / 1000000).toFixed(1) + 'M')
				.join(', ');

			result.grossIncome = currentGrossIncome;
			result.tax = taxRate * 100; // Convert to percentage
			result.netIncome = currentNetIncome;
			result.expenses = totalExpenses;
			result.savings = annualSavings;
			result.assets = { ...assets };
			result.unrealizedMilestones = unrealized || 'All reached!';
		}

		results.push(result);

		// Project to next year (calculate what happens DURING this year)
		if (year < p.years - 1) {
			// Track gains/losses for this year if requested
			const assetAppreciationGains: Record<string, number> = {};
			const assetSavingsGains: Record<string, number> = {};
			const assetTransferGains: Record<string, number> = {};
			const assetExpenseLosses: Record<string, number> = {};
			const assetTransferLosses: Record<string, number> = {};
			if (trackGainsLosses) {
				p.assets.forEach(a => {
					assetAppreciationGains[a.name] = 0;
					assetSavingsGains[a.name] = 0;
					assetTransferGains[a.name] = 0;
					assetExpenseLosses[a.name] = 0;
					assetTransferLosses[a.name] = 0;
				});
			}

			// Handle savings/liquidation
			if (annualSavings > 0) {
				const liquidAssets = p.assets.filter(a => a.liquid);
				const totalLiquid = liquidAssets.reduce((sum, a) => sum + assets[a.name], 0);

				if (totalLiquid > 0) {
					liquidAssets.forEach(asset => {
						const proportion = assets[asset.name] / totalLiquid;
						const contribution = annualSavings * proportion;
						assets[asset.name] += contribution;
						if (trackGainsLosses) {
							assetSavingsGains[asset.name] += contribution;
						}
					});
				}
			} else if (annualSavings < 0) {
				const liquidAssets = p.assets.filter(a => a.liquid);
				const totalLiquid = liquidAssets.reduce((sum, a) => sum + assets[a.name], 0);

				if (totalLiquid > 0) {
					const amountToLiquidate = Math.abs(annualSavings);
					liquidAssets.forEach(asset => {
						const proportion = assets[asset.name] / totalLiquid;
						const liquidation = amountToLiquidate * proportion;
						assets[asset.name] -= liquidation;
						if (trackGainsLosses) {
							assetExpenseLosses[asset.name] += liquidation;
						}
					});
				}
			}

			// Apply appreciation rates
			p.assets.forEach(asset => {
				const appreciation = assets[asset.name] * (asset.rate / 100);
				assets[asset.name] *= 1 + (asset.rate / 100);
				if (trackGainsLosses) {
					assetAppreciationGains[asset.name] += appreciation;
				}
			});

			// Process transactions for this year
			const transactionsForThisYear = (p.transactions || []).filter(t => t.year === year);

			// First pass: Calculate all transaction amounts using PRE-transaction values
			const transactionAmounts: Array<{
				from: string;
				to: string;
				amount: number;
			}> = [];

			transactionsForThisYear.forEach(transaction => {
				if (assets[transaction.fromAsset] !== undefined && assets[transaction.toAsset] !== undefined) {
					let transactionAmount = 0;

					if (transaction.amountType === 'percentage') {
						transactionAmount = assets[transaction.fromAsset] * (transaction.amount / 100);
					} else {
						transactionAmount = Math.min(transaction.amount, assets[transaction.fromAsset]);
					}

					transactionAmounts.push({
						from: transaction.fromAsset,
						to: transaction.toAsset,
						amount: transactionAmount
					});
				}
			});

			// Second pass: Apply all transactions
			transactionAmounts.forEach(({ from, to, amount }) => {
				assets[from] -= amount;
				assets[to] += amount;

				if (trackGainsLosses) {
					assetTransferLosses[from] += amount;
					assetTransferGains[to] += amount;
				}
			});

			// Attach the gains/losses to the CURRENT row
			if (trackGainsLosses) {
				result.assetAppreciation = { ...assetAppreciationGains };
				result.assetSavingsContributions = { ...assetSavingsGains };
				result.assetIncomingTransfers = { ...assetTransferGains };
				result.assetExpenseLosses = { ...assetExpenseLosses };
				result.assetOutgoingTransfers = { ...assetTransferLosses };

				const nextYearNetWorth = Object.values(assets).reduce((sum, val) => sum + val, 0);
				result.netWorthChange = nextYearNetWorth - totalNetWorth;
			}
		} else {
			// Last year - no arrows needed
			if (trackGainsLosses) {
				const emptyTracking: Record<string, number> = {};
				p.assets.forEach(a => emptyTracking[a.name] = 0);

				result.assetAppreciation = { ...emptyTracking };
				result.assetSavingsContributions = { ...emptyTracking };
				result.assetIncomingTransfers = { ...emptyTracking };
				result.assetExpenseLosses = { ...emptyTracking };
				result.assetOutgoingTransfers = { ...emptyTracking };
				result.netWorthChange = 0;
			}
		}
	}

	return results;
}

/**
 * Calculates the "Die With Zero" analysis.
 *
 * This function determines:
 * 1. Final net worth if you stop working now
 * 2. Optimal year to retire to reach target final net worth
 * 3. Additional annual savings needed to reach target
 *
 * @param params - The complete financial parameters
 * @returns Analysis object with retirement optimization data
 *
 * @example
 * const analysis = calculateDieWithZeroAnalysis(params);
 * console.log(`Stop at year ${analysis.optimalYear} to reach target`);
 */
export function calculateDieWithZeroAnalysis(params: FinancialParams): DieWithZeroAnalysis {
	const target = params.targetFinalNetWorth || 0;

	// 1. Calculate if you stop working now (year 0)
	const stopNowProjection = calculateProjection(params, { zeroIncomeFromYear: 0 });
	const stopNow = stopNowProjection[stopNowProjection.length - 1].totalNetWorth;

	// 2. Find optimal year to stop working to reach target final net worth
	let optimalYear: number | null = null;
	let optimalFinalWorth = 0;

	// Try each possible retirement year
	for (let retireYear = 0; retireYear <= params.years; retireYear++) {
		const projection = calculateProjection(params, { zeroIncomeFromYear: retireYear });
		const finalWorth = projection[projection.length - 1].totalNetWorth;

		// We want the earliest year where we can reach or exceed the target
		if (finalWorth >= target) {
			optimalYear = retireYear;
			optimalFinalWorth = finalWorth;
			break;
		}
	}

	// If no year works, find the year that gets closest to target
	if (optimalYear === null) {
		let bestDiff = Infinity;
		for (let retireYear = 0; retireYear <= params.years; retireYear++) {
			const projection = calculateProjection(params, { zeroIncomeFromYear: retireYear });
			const finalWorth = projection[projection.length - 1].totalNetWorth;
			const diff = Math.abs(finalWorth - target);

			if (diff < bestDiff) {
				bestDiff = diff;
				optimalYear = retireYear;
				optimalFinalWorth = finalWorth;
			}
		}
	}

	// 3. Calculate required annual savings to reach target
	const currentProjection = calculateProjection(params);
	const currentFinalWorth = currentProjection[currentProjection.length - 1].totalNetWorth;
	const shortfall = target - currentFinalWorth;

	let requiredAnnualSavings: number | null = null;
	if (shortfall !== 0) {
		// Simple approximation: divide shortfall by number of years
		requiredAnnualSavings = shortfall / params.years;
	}

	return {
		stopNow,
		optimalYear,
		optimalFinalWorth,
		requiredAnnualSavings,
		target,
		currentFinalWorth
	};
}

/**
 * Calculates the estimated net income for a given tax range item.
 *
 * This is shown in the Tax Range configuration UI to help users understand
 * what their net income will be when a particular tax rate applies.
 *
 * @param income - The income configuration
 * @param taxRangeItem - A specific tax range item (year and rate)
 * @returns The estimated net income at that year
 *
 * @example
 * const netIncome = calculateEstimatedNetIncome(
 *   params.income,
 *   { from: 10, rate: 0.40 }
 * );
 * // Returns net income at year 10 with 40% tax
 */
export function calculateEstimatedNetIncome(
	income: Income,
	taxRangeItem: { from: number; rate: number }
): number {
	// Calculate gross income at the year this tax rate starts
	const incomeResult = getIncomeForYear(income, taxRangeItem.from);
	const grossIncome = getIncomeValue(incomeResult);
	// Apply tax to get net income (rate is already decimal)
	const netIncome = grossIncome * (1 - taxRangeItem.rate);
	return netIncome;
}

/**
 * Calculates the asset value at the end of a specific year.
 *
 * This is used in the transaction tooltip to show users how much of an asset
 * will be available at the time of a transaction. The value shown is AFTER
 * all income/expenses/appreciation but BEFORE the transaction is applied.
 *
 * @param params - The complete financial parameters
 * @param assetName - The name of the asset to query
 * @param year - The year to calculate the value for
 * @returns The asset value at the end of that year (before transactions)
 *
 * @example
 * const cryptoValue = calculateAssetValueAtYear(params, 'Crypto', 5);
 * // Returns how much Crypto you'll have at end of year 5
 */
export function calculateAssetValueAtYear(
	params: FinancialParams,
	assetName: string,
	year: number
): number {
	const projection = calculateProjection(params);

	if (year >= projection.length) {
		return 0;
	}

	const row = projection[year];
	if (!row || !row.assets) return 0;

	// Start with the beginning value
	let value = row.assets[assetName] || 0;

	// Add all gains that happen during this year
	if (row.assetAppreciation) value += row.assetAppreciation[assetName] || 0;
	if (row.assetSavingsContributions) value += row.assetSavingsContributions[assetName] || 0;
	if (row.assetIncomingTransfers) value += row.assetIncomingTransfers[assetName] || 0;

	// Subtract expense losses (but NOT outgoing transfers, since we want the value BEFORE transfers)
	if (row.assetExpenseLosses) value -= row.assetExpenseLosses[assetName] || 0;

	return value;
}
