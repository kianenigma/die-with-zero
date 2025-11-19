import type { Income, Expense, Tax, ValidationResult, ValueResult } from './types';

/**
 * Validates a single income definition.
 */
function validateSingleIncome(income: Income): ValidationResult {
	if (income.type === 'fixed') {
		if (income.payload.start < 0) {
			return { ok: false, reason: 'Starting income cannot be negative' };
		}
		return { ok: true };
	}

	if (income.type === 'range') {
		if (!Array.isArray(income.payload) || income.payload.length === 0) {
			return { ok: false, reason: 'Range income must have at least one range' };
		}
		if (income.payload[0].from !== 0) {
			return { ok: false, reason: 'First range item must start at year 0' };
		}

		let prev: typeof income.payload[0] | undefined = undefined;
		for (const item of income.payload) {
			if (item.amount < 0) {
				return { ok: false, reason: 'Income amount cannot be negative' };
			}
			if (item.from < 0) {
				return { ok: false, reason: 'Year cannot be negative' };
			}
			if (prev !== undefined && item.from <= prev.from) {
				return { ok: false, reason: 'Range years must be in ascending order' };
			}
			prev = item;
		}

		// This check needs `income.years` which is on the parent Income object
		// It's better to do this check in the main `validateIncome` if `income.years` is not always available on `Income` itself
		// For now, assuming `income.years` is always present for a single Income object.
		if (income.payload[income.payload.length - 1].from > income.years) {
			return { ok: false, reason: 'Range year exceeds total projection years' };
		}

		return { ok: true };
	}

	if (income.type === 'manual') {
		if (!Array.isArray(income.payload)) {
			return { ok: false, reason: 'Manual income must be an array of values' };
		}
		if (income.payload.length !== income.years) {
			return { ok: false, reason: `Manual payload must have exactly ${income.years} entries (years 0 to ${income.years - 1})` };
		}
		for (const val of income.payload) {
			if (val < 0) {
				return { ok: false, reason: 'Income cannot be negative' };
			}
		}
		return { ok: true };
	}

	return { ok: false, reason: 'Unknown income type' };
}

/**
 * Validates the income parameters.
 *
 * Checks if the income configuration is valid and consistent.
 *
 * @param incomes - The income configuration(s) to validate
 * @returns Validation result
 */
export function validateIncome(incomes: Income[] | Income): ValidationResult {
	// Handle backward compatibility or single object input
	const incomeList = Array.isArray(incomes) ? incomes : [incomes];

	if (incomeList.length === 0) {
		// It's okay to have no income? Let's say yes for now, or maybe we want at least one.
		// For now, let's assume empty is valid (0 income).
		return { ok: true };
	}

	for (const income of incomeList) {
		const result = validateSingleIncome(income);
		if (!result.ok) {
			return result;
		}
	}

	return { ok: true };
}

/**
 * Calculates the income for a single income definition for a specific year.
 */
function getSingleIncomeForYear(income: Income, year: number): ValueResult {
	if (year < 0 || year >= income.years) {
		return { ok: false, reason: 'Year out of range' };
	}

	if (income.type === 'fixed') {
		const { start, growth } = income.payload;
		const value = start * Math.pow(1 + growth, year);
		return { ok: true, value };
	}

	if (income.type === 'range') {
		// Find the range that applies to this year
		// Ranges are sorted by 'from' year ascending
		// We want the last range where range.from <= year
		let amount = 0;
		// Sort ranges just in case they aren't sorted (though validation should ensure this)
		const sortedRanges = [...income.payload].sort((a, b) => a.from - b.from);

		for (const range of sortedRanges) {
			if (year >= range.from) {
				amount = range.amount;
			} else {
				// Since ranges are sorted, once we pass the year, we can stop
				break;
			}
		}
		return { ok: true, value: amount };
	}

	if (income.type === 'manual') {
		if (year < 0 || year >= income.payload.length) {
			return { ok: false, reason: 'Year out of range for manual income' };
		}
		const value = income.payload[year];
		if (typeof value !== 'number') {
			return { ok: false, reason: 'Invalid manual income data' };
		}
		return { ok: true, value };
	}

	return { ok: false, reason: 'Unknown income type' };
}

/**
 * Calculates the total income for a specific year.
 *
 * @param incomes - The income configuration(s)
 * @param year - The year to calculate income for (0-indexed)
 * @returns The calculated income value or an error
 */
export function getIncomeForYear(incomes: Income[] | Income, year: number): ValueResult {
	// Handle backward compatibility or single object input
	const incomeList = Array.isArray(incomes) ? incomes : [incomes];

	let totalIncome = 0;

	for (const income of incomeList) {
		const result = getSingleIncomeForYear(income, year);
		if (!result.ok) {
			return result;
		}
		if (result.value !== undefined) {
			totalIncome += result.value;
		}
	}

	return { ok: true, value: totalIncome };
}

/**
 * Helper to get income value or amount from result
 */
export function getIncomeValue(result: ValueResult): number {
	if (!result.ok) {
		return 0;
	}
	return result.value ?? result.amount ?? 0;
}

export function validateExpense(expenses: Expense[]): ValidationResult {
	if (!Array.isArray(expenses)) {
		return { ok: false, reason: 'Expenses must be an array' };
	}

	for (const expense of expenses) {
		const result = validateSingleExpense(expense);
		if (!result.ok) {
			return result;
		}
	}

	return { ok: true };
}

function validateSingleExpense(expense: Expense): ValidationResult {
	if (expense.type === 'fixed') {
		return { ok: true };
	} else if (expense.type === 'range') {
		if (expense.payload.length === 0) {
			return { ok: false, reason: 'Range payload cannot be empty' };
		}
		if (expense.payload[0].from !== 0) {
			return { ok: false, reason: 'First range item must start at year 0' };
		}

		let prev: typeof expense.payload[0] | undefined = undefined;
		for (const item of expense.payload) {
			if (prev !== undefined && item.from <= prev.from) {
				return { ok: false, reason: 'Range years must be in ascending order' };
			}
			prev = item;
		}

		if (expense.payload[expense.payload.length - 1].from > expense.years) {
			return { ok: false, reason: 'Range year exceeds total projection years' };
		}

		return { ok: true };
	} else if (expense.type === 'manual') {
		if (expense.payload.length !== expense.years) {
			return { ok: false, reason: `Manual payload must have exactly ${expense.years} entries (years 0 to ${expense.years - 1})` };
		}

		return { ok: true };
	} else {
		return { ok: false, reason: 'Unexpected expense type' };
	}
}

export function getExpenseForYear(expenses: Expense[], year: number): ValueResult {
	let total = 0;

	// Handle single expense object for backward compatibility or if passed incorrectly
	const expensesList = Array.isArray(expenses) ? expenses : [expenses];

	for (const expense of expensesList) {
		const result = getSingleExpenseForYear(expense, year);
		if (!result.ok) {
			return result;
		}
		total += result.value ?? result.amount ?? 0;
	}

	return { ok: true, amount: total };
}

export function getSingleExpenseForYear(expense: Expense, year: number): ValueResult {
	if (year < 0 || year >= expense.years) {
		return { ok: false, reason: 'Year out of range' };
	}

	if (expense.type === 'fixed') {
		let start = expense.payload.start;
		for (let i = 0; i < year; i++) {
			start = start + (start * expense.payload.growth);
		}
		return { ok: true, value: start };
	} else if (expense.type === 'range') {
		// Assume the last one is the match
		let index = expense.payload.length - 1;
		for (let search = 0; search < expense.payload.length - 1; search++) {
			if (year >= expense.payload[search].from && year < expense.payload[search + 1].from) {
				index = search;
				break;
			}
		}
		return { ok: true, amount: expense.payload[index].amount };
	} else if (expense.type === 'manual') {
		if (year < 0 || year >= expense.payload.length) {
			return { ok: false, reason: 'Year out of range for manual expense' };
		}
		return { ok: true, amount: expense.payload[year] };
	} else {
		return { ok: false, reason: 'Unexpected expense type' };
	}
}

/**
 * Helper to get expense value or amount from result
 */
export function getExpenseValue(result: ValueResult): number {
	if (!result.ok) {
		return 0;
	}
	return result.value ?? result.amount ?? 0;
}

/**
 * Validates a tax structure
 */
export function validateTax(tax: Tax): ValidationResult {
	if (tax.type === 'fixed') {
		return { ok: true };
	} else if (tax.type === 'range') {
		if (tax.payload.length === 0) {
			return { ok: false, reason: 'Range payload cannot be empty' };
		}
		if (tax.payload[0].from !== 0) {
			return { ok: false, reason: 'First range item must start at year 0' };
		}

		let prev: typeof tax.payload[0] | undefined = undefined;
		for (const item of tax.payload) {
			if (prev !== undefined && item.from <= prev.from) {
				return { ok: false, reason: 'Range years must be in ascending order' };
			}
			prev = item;
		}

		if (tax.payload[tax.payload.length - 1].from > tax.years) {
			return { ok: false, reason: 'Range year exceeds total projection years' };
		}

		return { ok: true };
	} else if (tax.type === 'manual') {
		if (tax.payload.length !== tax.years) {
			return { ok: false, reason: `Manual payload must have exactly ${tax.years} entries (years 0 to ${tax.years - 1})` };
		}

		return { ok: true };
	} else {
		return { ok: false, reason: 'Unexpected tax type' };
	}
}

/**
 * Gets the tax rate for a specific year (returns as decimal, e.g., 0.30 for 30%)
 */
export function getTaxForYear(tax: Tax, year: number): ValueResult {
	if (year < 0 || year >= tax.years) {
		return { ok: false, reason: 'Year out of range' };
	}

	if (tax.type === 'fixed') {
		return { ok: true, rate: tax.payload.rate };
	} else if (tax.type === 'range') {
		// Assume the last one is the match
		let index = tax.payload.length - 1;
		for (let search = 0; search < tax.payload.length - 1; search++) {
			if (year >= tax.payload[search].from && year < tax.payload[search + 1].from) {
				index = search;
				break;
			}
		}
		return { ok: true, rate: tax.payload[index].rate };
	} else if (tax.type === 'manual') {
		if (year < 0 || year >= tax.payload.length) {
			return { ok: false, reason: 'Year out of range for manual tax' };
		}
		return { ok: true, rate: tax.payload[year] };
	} else {
		return { ok: false, reason: 'Unexpected tax type' };
	}
}

/**
 * Helper to get tax rate from result
 */
export function getTaxRate(result: ValueResult): number {
	if (!result.ok) {
		return 0;
	}
	return result.rate ?? 0;
}
