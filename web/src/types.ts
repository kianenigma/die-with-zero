// Core data types for the financial planner

export interface Asset {
	name: string;
	amount: number;
	rate: number;
	liquid: boolean;
}

export type ValueType = 'fixed' | 'range' | 'manual';

// Income types
export type IncomeType = ValueType;

export interface IncomeFixed {
	type: 'fixed';
	years: number;
	payload: {
		start: number;
		growth: number;
	};
}

export interface IncomeRangeItem {
	from: number;
	amount: number;
}

export interface IncomeRange {
	type: 'range';
	years: number;
	payload: IncomeRangeItem[];
}

export interface IncomeManual {
	type: 'manual';
	years: number;
	payload: number[];
}

export type Income = IncomeFixed | IncomeRange | IncomeManual;

// Expense types (same structure as Income)
export type ExpenseType = ValueType;

export interface ExpenseFixed {
	type: 'fixed';
	years: number;
	payload: {
		start: number;
		growth: number;
	};
}

export interface ExpenseRangeItem {
	from: number;
	amount: number;
}

export interface ExpenseRange {
	type: 'range';
	years: number;
	payload: ExpenseRangeItem[];
}

export interface ExpenseManual {
	type: 'manual';
	years: number;
	payload: number[];
}

export type Expense = ExpenseFixed | ExpenseRange | ExpenseManual;

// Tax types (tax is a percentage/rate, not an amount)
export type TaxType = ValueType;

export interface TaxFixed {
	type: 'fixed';
	years: number;
	payload: {
		rate: number; // Percentage as decimal (e.g., 0.30 for 30%)
	};
}

export interface TaxRangeItem {
	from: number;
	rate: number; // Percentage as decimal
}

export interface TaxRange {
	type: 'range';
	years: number;
	payload: TaxRangeItem[];
}

export interface TaxManual {
	type: 'manual';
	years: number;
	payload: number[]; // Array of tax rates as decimals
}

export type Tax = TaxFixed | TaxRange | TaxManual;

export interface ValidationResult {
	ok: boolean;
	reason?: string;
}

export interface ValueResult {
	ok: boolean;
	value?: number;
	amount?: number;
	rate?: number;
	reason?: string;
}

export interface FinancialParams {
	currency: string;
	currentAge: number;
	income: Income;
	expense: Expense;
	tax: Tax;
	years: number;
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
	optimalYear: number | null;
	optimalFinalWorth: number;
	requiredAnnualSavings: number | null;
	target: number;
	currentFinalWorth: number;
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
