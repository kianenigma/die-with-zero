/*
This currently works, but it is ugly as fuck. we want the same structure to define:

1. income
2. additional expenses
3. tax rate

As in, each can be defined in either of the 3 ways.

First, let's do our best to refactor this in pure JS into something clean.
then, if you find any bugs in it, fix it.
then, create the objects/classes (based on the refactor needed in the first step) to represent income, additional expense, and tax rate in this model
then, update the UI for these 3 parameters to have a dropdown to first let the user choose the way in which they want to define this, and update the UI accordingly. For manual, allow a way to fill all rows with the same value from one cell, similar to excel sheets. start using this code in the index.html to calculate the income/tax/expense for year.

*/

const fixed = {
	type: "fixed",
	years: 40,
	payload: {
		start: 10000,
		growth: 0.02
	}
}

const range = {
	type: "range",
	years: 40,
	payload: [
		{ from: 0, amount: 10000 },
		{ from: 10, amount: 20000 },
		{ from: 20, amount: 22000 }
	]
}

const manual = {
	type: "manual",
	years: 40,
	payload: Array.from({ length: 40, }, () => 10000)
}

function validate(income) {
	if (income.type === "fixed") {
		return { ok: true }
	} else if (income.type === "range") {
		if (income.payload.length === 0) {
			return { ok: false, reason: "len zero" }
		}
		if (income.payload[0].from !== 0) {
			return { ok: false, reason: "first index not zero" }
		}

		let prev = undefined;
		for (let item of income.payload) {
			if (prev !== undefined && item.from <= prev.from) {
				return { ok: false, reason: "years not ordered" }
			}
			prev = item
		}

		if (income.payload[income.payload.length - 1].from > income.years) {
			return { ok: false, reason: "out of range" }
		}

		return { ok: true }
	} else if (income.type === "manual") {
		if (income.payload.length !== income.years) {
			return { ok: false, reason: "incomplete" }
		}

		return { ok: true }
	} else {
		throw "unexpected income type"
	}
}

function incomeForYear(income, year) {
	if (year >= income.years) {
		return { ok: false, reason: "year out of range" }
	}

	if (income.type === "fixed") {
		let start = income.payload.start;
		for (let i = 0; i < year; i++) {
			start = start + (start * income.payload.growth);
		}
		return { ok: true, value: start }
	} else if (income.type === "range") {
		// assume the last one is the match
		let index = income.payload.length - 1;
		for (let search = 0; search < income.payload.length - 1; search++) {
			if (year >= income.payload[search].from && year < income.payload[search + 1].from) {
				index = search;
				break
			}
		}
		return { ok: true, amount: income.payload[index].amount }
	} else if (income.type === "manual") {
		if (year < 0 || year >= income.payload.length) {
			return { ok: false, reason: "out of range" }
		}
		return { ok: true, amount: income.payload[year] }

	} else {
		throw "unexpected income type"
	}
}

// console.log(validate(fixed))
// console.log(validate(range))
// console.log(validate(manual))

// console.log(incomeForYear(fixed, 0))
// console.log(incomeForYear(fixed, 1))
// console.log(incomeForYear(fixed, 2))

console.log(incomeForYear(range, 5))
console.log(incomeForYear(range, 15))
console.log(incomeForYear(range, 19))
console.log(incomeForYear(range, 20))
console.log(incomeForYear(range, 21))
console.log(incomeForYear(manual, 0))
console.log(incomeForYear(manual, 7))
