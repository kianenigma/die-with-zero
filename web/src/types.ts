// Core data types for the financial planner

export interface Asset {
	name: string;
	amount: number;
	rate: number;
	liquid: boolean;
}

export interface TaxRate {
	year: number;
	rate: number;
}

export interface FinancialParams {
	currency: string;
	annualGrossIncome: number;
	annualExpenses: number;
	years: number;
	inflationRate: number;
	incomeGrowthRate: number;
	taxRates: TaxRate[];
	assets: Asset[];
	milestones: number[];
	targetFinalNetWorth: number;
}

export interface ProjectionRow {
	year: number;
	totalNetWorth: number;
	grossIncome?: number;
	tax?: number;
	netIncome?: number;
	expenses?: number;
	savings?: number;
	assets?: Record<string, number>;
	assetAppreciation?: Record<string, number>;
	assetContributions?: Record<string, number>;
	assetLosses?: Record<string, number>;
	netWorthChange?: number;
	unrealizedMilestones?: string;
}

export interface DieWithZeroAnalysis {
	stopNow: number;
	optimalYear: number;
	optimalFinalWorth: number;
	target: number;
}

export interface AppData {
	params: FinancialParams;
	chartInstance: any;
	tooltips: Record<string, string>;
	sidebarCollapsed: boolean;
	darkTheme: boolean;
}

export interface ProjectionOptions {
	zeroIncomeFromYear?: number | null;
	trackMilestones?: boolean;
	trackGainsLosses?: boolean;
}
