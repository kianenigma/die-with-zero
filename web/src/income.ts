import type { Income, Expense, Tax, ValidationResult, ValueResult } from './types';

/**
 * Validates an income structure
 */
export function validateIncome(income: Income): ValidationResult {
	if (income.type === 'fixed') {
		return { ok: true };
	} else if (income.type === 'range') {
		if (income.payload.length === 0) {
			return { ok: false, reason: 'Range payload cannot be empty' };
		}
		if (income.payload[0].from !== 0) {
			return { ok: false, reason: 'First range item must start at year 0' };
		}

		let prev: typeof income.payload[0] | undefined = undefined;
		for (const item of income.payload) {
			if (prev !== undefined && item.from <= prev.from) {
				return { ok: false, reason: 'Range years must be in ascending order' };
			}
			prev = item;
		}

		if (income.payload[income.payload.length - 1].from > income.years) {
			return { ok: false, reason: 'Range year exceeds total projection years' };
		}

		return { ok: true };
	} else if (income.type === 'manual') {
		if (income.payload.length !== income.years) {
			return { ok: false, reason: `Manual payload must have exactly ${income.years} entries (years 0 to ${income.years - 1})` };
		}

		return { ok: true };
	} else {
		return { ok: false, reason: 'Unexpected income type' };
	}
}

/**
 * Gets the income for a specific year
 */
export function getIncomeForYear(income: Income, year: number): ValueResult {
	if (year < 0 || year >= income.years) {
		return { ok: false, reason: 'Year out of range' };
	}

	if (income.type === 'fixed') {
		let start = income.payload.start;
		for (let i = 0; i < year; i++) {
			start = start + (start * income.payload.growth);
		}
		return { ok: true, value: start };
	} else if (income.type === 'range') {
		// Assume the last one is the match
		let index = income.payload.length - 1;
		for (let search = 0; search < income.payload.length - 1; search++) {
			if (year >= income.payload[search].from && year < income.payload[search + 1].from) {
				index = search;
				break;
			}
		}
		return { ok: true, amount: income.payload[index].amount };
	} else if (income.type === 'manual') {
		if (year < 0 || year >= income.payload.length) {
			return { ok: false, reason: 'Year out of range for manual income' };
		}
		return { ok: true, amount: income.payload[year] };
	} else {
		return { ok: false, reason: 'Unexpected income type' };
	}
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

/**
 * Validates an expense structure
 */
export function validateExpense(expense: Expense): ValidationResult {
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

/**
 * Gets the expense for a specific year
 */
export function getExpenseForYear(expense: Expense, year: number): ValueResult {
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
