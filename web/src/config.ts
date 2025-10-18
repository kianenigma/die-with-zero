import type { FinancialParams } from './types';

// Constants
export const K = 1000;
export const M = 1000 * K;

// Example data (safe to share with others)
export const EXAMPLE_DATA: FinancialParams = {
	currency: '€',
	annualGrossIncome: 80000,
	annualExpenses: 40000,
	years: 40,
	inflationRate: 3,
	incomeGrowthRate: 3,
	taxRates: [
		{ year: 0, rate: 30 },
		{ year: 20, rate: 100 }
	],
	assets: [
		{ name: 'ETFs', amount: 200000, rate: 4, liquid: true },
		{ name: 'Crypto', amount: 50000, rate: 6, liquid: true },
		{ name: 'Real Estate', amount: 400000, rate: 1, liquid: false }
	],
	milestones: [500 * K, M],
	targetFinalNetWorth: 0
};

// Tooltip descriptions
export const TOOLTIPS: Record<string, string> = {
	inflationRate: "Annual inflation rate applied to your expenses. If 2%, your expenses increase 2% per year.",
	projectionYears: "Number of years to project into the future.",
	annualGrossIncome: "Your projected annual income while working. Use a pessimistic (lower) estimate to be conservative.",
	incomeGrowthRate: "Annual income growth rate. If 2%, your salary grows 2% per year. Compare to inflation rate: same = keeping pace with economy, higher = outpacing inflation, lower = falling behind.",
	annualExpenses: "Your baseline living expenses to maintain a good lifestyle. Use a pessimistic (higher) estimate.",
	taxRateSchedule: "Define tax rates that change over time. Applied to gross income. Years must be in ascending order. Higher tax percentages can represent you taking a step back, and having less income. A 100% tax rate means you stop working.",
	assetAllocation: "Your current assets and their expected returns. Liquid assets can be used to cover expenses, non-liquid cannot.",
	returnRate: "Expected annual return/appreciation rate for this asset.",
	liquid: "Can this asset be sold/liquidated to cover expenses? (Yes for stocks/crypto, No for primary residence)",
	milestones: "Net worth goals to track. The table shows which milestones haven't been reached yet.",
	targetFinalNetWorth: "The target net worth you want to have at the end of the projection period. Set to 0 to 'die with zero', or any amount you want to leave behind or have as a safety buffer.",
	yearlyBreakdown: "Year 0 represents your starting point (no savings or gains yet). From year 1 onwards, each asset column shows the current value with: appreciation (green ↑) from growth rate, contributions (lighter green ↑↑) from your savings (only liquid assets), and losses (red ↓) from liquidation to cover expenses. Total Net Worth shows the net change (green/red ↑/↓) from the previous year."
};
