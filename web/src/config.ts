import type { FinancialParams } from './types';

// Constants
export const K = 1000;
export const M = 1000 * K;

// Example data (safe to share with others)
export const EXAMPLE_DATA: FinancialParams = {
	currency: '€',
	currentAge: 30,
	years: 40,
	income: {
		type: 'fixed',
		years: 40,
		payload: {
			start: 80 * K,
			growth: 0.03
		}
	},
	expense: {
		type: 'fixed',
		years: 40,
		payload: {
			start: 40 * K,
			growth: 0.03
		}
	},
	tax: {
		type: 'range',
		years: 40,
		payload: [
			{ from: 0, rate: 0.20 },
			{ from: 10, rate: 0.40 },
			{ from: 20, rate: 1.00 }
		]
	},
	assets: [
		{ name: 'ETFs', amount: 200000, rate: 3, liquid: true },
		{ name: 'Crypto', amount: 50000, rate: 5, liquid: true },
		{ name: 'Real Estate', amount: 400000, rate: 1, liquid: false }
	],
	milestones: [500 * K, M],
	targetFinalNetWorth: 500 * K,
	transactions: []
};

// Tooltip descriptions
export const TOOLTIPS: Record<string, string> = {
	currentAge: "Your current age. This will be displayed alongside the year number in the projection table.",
	projectionYears: "Number of years to project into the future.",
	incomeType: "How to model your income: Fixed (constant with growth rate), Range (different amounts for different year ranges), or Manual (specify each year individually).",
	incomeFixed: "Starting annual income and growth rate. Growth compounds yearly.",
	incomeRange: "Define different income levels for different year ranges. Useful for modeling career changes or retirement phases.",
	incomeManual: "Manually specify income for each individual year. Most flexible but requires more data entry.",
	expenseType: "How to model your expenses: Fixed (constant with growth rate), Range (different amounts for different year ranges), or Manual (specify each year individually).",
	expenseFixed: "Starting annual expenses and growth rate (e.g., inflation). Growth compounds yearly.",
	expenseRange: "Define different expense levels for different year ranges. Useful for modeling lifestyle changes or retirement.",
	expenseManual: "Manually specify expenses for each individual year. Most flexible but requires more data entry.",
	taxType: "How to model your tax rate: Fixed (constant rate), Range (different rates for different year ranges), or Manual (specify each year individually). Tax rates are percentages as decimals (e.g., 0.30 for 30%).",
	taxFixed: "Fixed tax rate applied to all years. Enter as decimal (e.g., 0.30 for 30%).",
	taxRange: "Define different tax rates for different year ranges. Useful for modeling career changes or retirement. A 100% (1.00) tax rate means you stop working.",
	taxManual: "Manually specify tax rate for each individual year. Enter as decimals (e.g., 0.30 for 30%).",
	assetAllocation: "Your current assets and their expected returns. Liquid assets can be used to cover expenses, non-liquid cannot.",
	returnRate: "Expected annual return/appreciation rate for this asset.",
	liquid: "Can this asset be sold/liquidated to cover expenses? (Yes for stocks/crypto, No for primary residence)",
	milestones: "Net worth goals to track. The table shows which milestones haven't been reached yet.",
	targetFinalNetWorth: "The target net worth you want to have at the end of the projection period. Set to 0 to 'die with zero', or any amount you want to leave behind or have as a safety buffer.",
	yearlyBreakdown: "Year 0 represents your starting point (no savings or gains yet). From year 1 onwards, each asset column shows the current value with: appreciation (green ↑) from growth rate, contributions (lighter green ↑↑) from your savings (only liquid assets), and losses (red ↓) from liquidation to cover expenses. Total Net Worth shows the net change (green/red ↑/↓) from the previous year.",
	transactions: "Define asset transformations at specific years. You can convert a fixed amount or percentage of one asset into another. For example, convert 50% of Crypto to ETFs in year 10. Transactions that reference non-existent assets will be automatically removed."
};
