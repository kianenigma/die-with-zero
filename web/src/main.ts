import { createApp, defineComponent } from 'vue/dist/vue.esm-bundler.js';
import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'hammerjs';

import { EXAMPLE_DATA, TOOLTIPS } from './config';
import {
	getIncomeForYear,
	getIncomeValue,
	getExpenseForYear,
	getExpenseValue,
	getTaxForYear,
	getTaxRate,
	validateIncome,
	validateExpense,
	validateTax
} from './income';
import type {
	FinancialParams,
	ProjectionRow,
	DieWithZeroAnalysis,
	AppData,
	ProjectionOptions,
	IncomeType,
	ExpenseType,
	TaxType
} from './types';

// TODO: year 0 calculation is still a bit off
// TODO: die with zero calculation is off
// TODO: years is duplicate in overall config and individual income/expense/tax
// TODO: projection: how much should be your yearly to die with target X after Y years.

// Register Chart.js components
Chart.register(...registerables, annotationPlugin, zoomPlugin);

const STORAGE_KEY = 'die-with-zero-params';

const app = createApp(defineComponent({
	data(): AppData {
		// Try to load from localStorage, fallback to EXAMPLE_DATA
		const loadFromStorage = (): FinancialParams => {
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored) {
					return JSON.parse(stored) as FinancialParams;
				}
			} catch (error) {
				console.error('Error loading from localStorage:', error);
			}
			return JSON.parse(JSON.stringify(EXAMPLE_DATA));
		};

		return {
			params: loadFromStorage(),
			chartInstance: null,
			tooltips: TOOLTIPS,
			sidebarCollapsed: false,
			darkTheme: false
		};
	},
	computed: {
		projection(): ProjectionRow[] {
			return this.calculateProjection();
		},
		dieWithZero(): DieWithZeroAnalysis {
			const target = this.params.targetFinalNetWorth || 0;

			// 1. Calculate if you stop working now (year 0)
			const stopNowProjection = this.calculateProjectionWithZeroIncome(0);
			const stopNow = stopNowProjection[stopNowProjection.length - 1].totalNetWorth;

			// 2. Find optimal year to stop working to reach target final net worth
			let optimalYear: number | null = null;
			let optimalFinalWorth = 0;

			// Try each possible retirement year
			for (let retireYear = 0; retireYear <= this.params.years; retireYear++) {
				const projection = this.calculateProjectionWithZeroIncome(retireYear);
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
				for (let retireYear = 0; retireYear <= this.params.years; retireYear++) {
					const projection = this.calculateProjectionWithZeroIncome(retireYear);
					const finalWorth = projection[projection.length - 1].totalNetWorth;
					const diff = Math.abs(finalWorth - target);

					if (diff < bestDiff) {
						bestDiff = diff;
						optimalYear = retireYear;
						optimalFinalWorth = finalWorth;
					}
				}
			}

			// 3. Calculate required annual savings to reach target (assuming you work all years)
			// Use the current projection and see what the shortfall/surplus is
			const currentProjection = this.calculateProjection();
			const currentFinalWorth = currentProjection[currentProjection.length - 1].totalNetWorth;
			const shortfall = target - currentFinalWorth;

			let requiredAnnualSavings: number | null = null;
			if (shortfall !== 0) {
				// Simple approximation: divide shortfall by number of years
				// This is a rough estimate, as it doesn't account for compounding
				requiredAnnualSavings = shortfall / this.params.years;
			}

			return {
				stopNow,
				optimalYear,
				optimalFinalWorth,
				requiredAnnualSavings,
				target
			};
		},
		incomeValidation(): { ok: boolean; reason?: string } {
			return validateIncome(this.params.income);
		},
		expenseValidation(): { ok: boolean; reason?: string } {
			return validateExpense(this.params.expense);
		},
		taxValidation(): { ok: boolean; reason?: string } {
			return validateTax(this.params.tax);
		}
	},
	watch: {
		'params.years'() {
			// Sync income years when projection years change
			this.syncIncomeYears();
		},
		params: {
			handler() {
				// Save to localStorage whenever params change
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(this.params));
				} catch (error) {
					console.error('Error saving to localStorage:', error);
				}

				this.$nextTick(() => {
					this.updateChart();
				});
			},
			deep: true
		},
		projection: {
			handler() {
				this.$nextTick(() => {
					this.updateChart();
				});
			},
			deep: true
		}
	},
	methods: {
		toggleSidebar() {
			this.sidebarCollapsed = !this.sidebarCollapsed;
			// Wait for transition to complete before updating chart
			setTimeout(() => {
				this.updateChart();
			}, 300);
		},
		toggleTheme() {
			this.darkTheme = !this.darkTheme;
			document.documentElement.classList.toggle('dark', this.darkTheme);
			// Update chart to match new theme
			this.$nextTick(() => {
				this.updateChart();
			});
		},
		resetZoom() {
			if (this.chartInstance) {
				this.chartInstance.resetZoom();
			}
		},
		updateTargetFinalNetWorth(value: string) {
			this.params.targetFinalNetWorth = this.parseInputNumber(value);
		},
		saveParameters() {
			// Create a JSON string of the current parameters
			const dataStr = JSON.stringify(this.params, null, 2);
			const dataBlob = new Blob([dataStr], { type: 'application/json' });

			// Create download link
			const url = URL.createObjectURL(dataBlob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `financial-plan-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		},
		loadParameters(event: Event) {
			const target = event.target as HTMLInputElement;
			const file = target.files?.[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const result = e.target?.result;
					if (typeof result !== 'string') return;

					const loadedParams = JSON.parse(result) as FinancialParams;
					// Validate that the loaded data has the expected structure
					if (loadedParams && typeof loadedParams === 'object') {
						this.params = loadedParams;
						// Reset file input
						const fileInput = this.$refs.fileInput as HTMLInputElement;
						if (fileInput) fileInput.value = '';
					} else {
						alert('Invalid file format');
					}
				} catch (error) {
					alert('Error loading file: ' + (error as Error).message);
				}
			};
			reader.readAsText(file);
		},
		addAsset() {
			this.params.assets.push({ name: 'New Asset', amount: 0, rate: 0, liquid: true });
		},
		removeAsset(index: number) {
			this.params.assets.splice(index, 1);
		},
		addMilestone() {
			this.params.milestones.push(0);
		},
		removeMilestone(index: number) {
			this.params.milestones.splice(index, 1);
		},
		changeIncomeType(newType: IncomeType) {
			// When changing income type, preserve what we can and create sensible defaults
			const currentIncome = this.params.income;
			const years = this.params.years;

			if (newType === 'fixed') {
				// Try to get a starting value from current income
				let start = 80000;
				if (currentIncome.type === 'range' && currentIncome.payload.length > 0) {
					start = currentIncome.payload[0].amount;
				} else if (currentIncome.type === 'manual' && currentIncome.payload.length > 0) {
					start = currentIncome.payload[0];
				} else if (currentIncome.type === 'fixed') {
					start = currentIncome.payload.start;
				}

				this.params.income = {
					type: 'fixed',
					years,
					payload: {
						start,
						growth: 0.03
					}
				};
			} else if (newType === 'range') {
				// Create a simple range starting at current income
				let start = 80000;
				if (currentIncome.type === 'fixed') {
					start = currentIncome.payload.start;
				} else if (currentIncome.type === 'range' && currentIncome.payload.length > 0) {
					start = currentIncome.payload[0].amount;
				} else if (currentIncome.type === 'manual' && currentIncome.payload.length > 0) {
					start = currentIncome.payload[0];
				}

				this.params.income = {
					type: 'range',
					years,
					payload: [
						{ from: 0, amount: start }
					]
				};
			} else if (newType === 'manual') {
				// Fill manual with sensible defaults
				const payload: number[] = [];
				for (let year = 0; year < years; year++) {
					const incomeResult = getIncomeForYear(currentIncome, year);
					payload.push(getIncomeValue(incomeResult));
				}

				this.params.income = {
					type: 'manual',
					years,
					payload
				};
			}
		},
		addIncomeRange() {
			if (this.params.income.type !== 'range') return;

			const lastRange = this.params.income.payload.length > 0
				? this.params.income.payload[this.params.income.payload.length - 1]
				: { from: 0, amount: 80000 };

			this.params.income.payload.push({
				from: Math.min(lastRange.from + 5, this.params.years),
				amount: lastRange.amount
			});
		},
		removeIncomeRange(index: number) {
			if (this.params.income.type !== 'range') return;
			if (this.params.income.payload.length > 1) {
				this.params.income.payload.splice(index, 1);
			}
		},
		syncIncomeYears() {
			// Sync income.years with params.years
			this.params.income.years = this.params.years;

			// For manual type, adjust the array length
			if (this.params.income.type === 'manual') {
				const currentLength = this.params.income.payload.length;
				const targetLength = this.params.years;

				if (currentLength < targetLength) {
					// Add more years with default values
					const lastValue = currentLength > 0 ? this.params.income.payload[currentLength - 1] : 0;
					for (let i = currentLength; i < targetLength; i++) {
						this.params.income.payload.push(lastValue);
					}
				} else if (currentLength > targetLength) {
					// Remove excess years
					this.params.income.payload = this.params.income.payload.slice(0, targetLength);
				}
			}

			// Sync expense.years
			this.params.expense.years = this.params.years;
			if (this.params.expense.type === 'manual') {
				const currentLength = this.params.expense.payload.length;
				const targetLength = this.params.years;

				if (currentLength < targetLength) {
					const lastValue = currentLength > 0 ? this.params.expense.payload[currentLength - 1] : 0;
					for (let i = currentLength; i < targetLength; i++) {
						this.params.expense.payload.push(lastValue);
					}
				} else if (currentLength > targetLength) {
					this.params.expense.payload = this.params.expense.payload.slice(0, targetLength);
				}
			}

			// Sync tax.years
			this.params.tax.years = this.params.years;
			if (this.params.tax.type === 'manual') {
				const currentLength = this.params.tax.payload.length;
				const targetLength = this.params.years;

				if (currentLength < targetLength) {
					const lastValue = currentLength > 0 ? this.params.tax.payload[currentLength - 1] : 0;
					for (let i = currentLength; i < targetLength; i++) {
						this.params.tax.payload.push(lastValue);
					}
				} else if (currentLength > targetLength) {
					this.params.tax.payload = this.params.tax.payload.slice(0, targetLength);
				}
			}
		},
		setAllManualIncome(value: number) {
			if (this.params.income.type !== 'manual') return;

			// Set all years to the specified value
			for (let i = 0; i < this.params.income.payload.length; i++) {
				this.params.income.payload[i] = value;
			}
		},
		// Expense management methods
		changeExpenseType(newType: ExpenseType) {
			const currentExpense = this.params.expense;
			const years = this.params.years;

			if (newType === 'fixed') {
				let start = 40000;
				if (currentExpense.type === 'range' && currentExpense.payload.length > 0) {
					start = currentExpense.payload[0].amount;
				} else if (currentExpense.type === 'manual' && currentExpense.payload.length > 0) {
					start = currentExpense.payload[0];
				} else if (currentExpense.type === 'fixed') {
					start = currentExpense.payload.start;
				}

				this.params.expense = {
					type: 'fixed',
					years,
					payload: {
						start,
						growth: 0.03
					}
				};
			} else if (newType === 'range') {
				let start = 40000;
				if (currentExpense.type === 'fixed') {
					start = currentExpense.payload.start;
				} else if (currentExpense.type === 'range' && currentExpense.payload.length > 0) {
					start = currentExpense.payload[0].amount;
				} else if (currentExpense.type === 'manual' && currentExpense.payload.length > 0) {
					start = currentExpense.payload[0];
				}

				this.params.expense = {
					type: 'range',
					years,
					payload: [
						{ from: 0, amount: start }
					]
				};
			} else if (newType === 'manual') {
				const payload: number[] = [];
				for (let year = 0; year < years; year++) {
					const expenseResult = getExpenseForYear(currentExpense, year);
					payload.push(getExpenseValue(expenseResult));
				}

				this.params.expense = {
					type: 'manual',
					years,
					payload
				};
			}
		},
		addExpenseRange() {
			if (this.params.expense.type !== 'range') return;

			const lastRange = this.params.expense.payload.length > 0
				? this.params.expense.payload[this.params.expense.payload.length - 1]
				: { from: 0, amount: 40000 };

			this.params.expense.payload.push({
				from: Math.min(lastRange.from + 5, this.params.years),
				amount: lastRange.amount
			});
		},
		removeExpenseRange(index: number) {
			if (this.params.expense.type !== 'range') return;
			if (this.params.expense.payload.length > 1) {
				this.params.expense.payload.splice(index, 1);
			}
		},
		setAllManualExpense(value: number) {
			if (this.params.expense.type !== 'manual') return;

			for (let i = 0; i < this.params.expense.payload.length; i++) {
				this.params.expense.payload[i] = value;
			}
		},
		// Tax management methods
		changeTaxType(newType: TaxType) {
			const currentTax = this.params.tax;
			const years = this.params.years;

			if (newType === 'fixed') {
				let rate = 0.30;
				if (currentTax.type === 'range' && currentTax.payload.length > 0) {
					rate = currentTax.payload[0].rate;
				} else if (currentTax.type === 'manual' && currentTax.payload.length > 0) {
					rate = currentTax.payload[0];
				} else if (currentTax.type === 'fixed') {
					rate = currentTax.payload.rate;
				}

				this.params.tax = {
					type: 'fixed',
					years,
					payload: {
						rate
					}
				};
			} else if (newType === 'range') {
				let rate = 0.30;
				if (currentTax.type === 'fixed') {
					rate = currentTax.payload.rate;
				} else if (currentTax.type === 'range' && currentTax.payload.length > 0) {
					rate = currentTax.payload[0].rate;
				} else if (currentTax.type === 'manual' && currentTax.payload.length > 0) {
					rate = currentTax.payload[0];
				}

				this.params.tax = {
					type: 'range',
					years,
					payload: [
						{ from: 0, rate }
					]
				};
			} else if (newType === 'manual') {
				const payload: number[] = [];
				for (let year = 0; year < years; year++) {
					const taxResult = getTaxForYear(currentTax, year);
					payload.push(getTaxRate(taxResult));
				}

				this.params.tax = {
					type: 'manual',
					years,
					payload
				};
			}
		},
		addTaxRange() {
			if (this.params.tax.type !== 'range') return;

			const lastRange = this.params.tax.payload.length > 0
				? this.params.tax.payload[this.params.tax.payload.length - 1]
				: { from: 0, rate: 0.30 };

			this.params.tax.payload.push({
				from: Math.min(lastRange.from + 5, this.params.years),
				rate: lastRange.rate
			});
		},
		removeTaxRange(index: number) {
			if (this.params.tax.type !== 'range') return;
			if (this.params.tax.payload.length > 1) {
				this.params.tax.payload.splice(index, 1);
			}
		},
		setAllManualTax(value: number) {
			if (this.params.tax.type !== 'manual') return;

			for (let i = 0; i < this.params.tax.payload.length; i++) {
				this.params.tax.payload[i] = value;
			}
		},
		formatNumber(num: number): string {
			return new Intl.NumberFormat('en-US', {
				minimumFractionDigits: 0,
				maximumFractionDigits: 0
			}).format(num);
		},
		formatCurrency(num: number): string {
			return this.params.currency + this.formatNumber(num);
		},
		formatInputNumber(num: number): string {
			if (num === 0 || num === null) return '';
			return new Intl.NumberFormat('en-US').format(num);
		},
		parseInputNumber(value: string): number {
			// Remove all non-digit characters except decimal point
			const cleaned = value.replace(/[^\d.]/g, '');
			const parsed = parseFloat(cleaned);
			return isNaN(parsed) ? 0 : parsed;
		},
		getEstimatedIncomeForTaxRange(taxRangeItem: { from: number; rate: number }): number {
			// Calculate gross income at the year this tax rate starts
			const incomeResult = getIncomeForYear(this.params.income, taxRangeItem.from);
			const grossIncome = getIncomeValue(incomeResult);
			// Apply tax to get net income (rate is already decimal)
			const netIncome = grossIncome * (1 - taxRangeItem.rate);
			return netIncome;
		},
		_projectBase(options: ProjectionOptions = {}): ProjectionRow[] {
			// Base projection function that both calculateProjection and calculateProjectionWithZeroIncome use
			const {
				zeroIncomeFromYear = null,
				trackMilestones = false,
				trackGainsLosses = false
			} = options;

			const results: ProjectionRow[] = [];
			const p = this.params;

			// Initialize
			const assets: Record<string, number> = {};
			p.assets.forEach(a => assets[a.name] = a.amount);

			// Track milestones if requested
			const milestonesReached: Record<number, number | null> = {};
			if (trackMilestones) {
				p.milestones.forEach(m => milestonesReached[m] = null);
			}

			let previousNetWorth: number | null = null;

			for (let year = 0; year < p.years; year++) {
				// Get income for this year
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
				const annualSavings = year > 0 ? currentNetIncome - totalExpenses : 0;

				// Calculate net worth change
				const netWorthChange = previousNetWorth !== null ? totalNetWorth - previousNetWorth : 0;

				// Check milestones if tracking
				if (trackMilestones) {
					for (const milestone of p.milestones) {
						if (milestonesReached[milestone] === null && totalNetWorth >= milestone) {
							milestonesReached[milestone] = year;
						}
					}
				}

				// Build result object
				const result: ProjectionRow = { year, totalNetWorth };

				if (trackGainsLosses) {
					// Get unrealized milestones
					const unrealized = p.milestones
						.filter(m => milestonesReached[m] === null)
						.map(m => '€' + (m / 1000000).toFixed(1) + 'M')
						.join(', ');

					// Initialize gain/loss tracking for this year
					const assetAppreciation: Record<string, number> = {};
					const assetContributions: Record<string, number> = {};
					const assetLosses: Record<string, number> = {};
					p.assets.forEach(a => {
						assetAppreciation[a.name] = 0;
						assetContributions[a.name] = 0;
						assetLosses[a.name] = 0;
					});

					result.grossIncome = currentGrossIncome;
					result.tax = taxRate * 100; // Convert to percentage
					result.netIncome = currentNetIncome;
					result.expenses = totalExpenses;
					result.savings = annualSavings;
					result.assets = { ...assets };
					result.assetAppreciation = { ...assetAppreciation };
					result.assetContributions = { ...assetContributions };
					result.assetLosses = { ...assetLosses };
					result.netWorthChange = netWorthChange;
					result.unrealizedMilestones = unrealized || 'All reached!';
				}

				results.push(result);
				previousNetWorth = totalNetWorth;

				// Project to next year
				if (year < p.years) {

					// Track gains/losses for this year if requested
					const assetGains: Record<string, number> = {};
					const assetContributions: Record<string, number> = {};
					const assetLosses: Record<string, number> = {};
					if (trackGainsLosses) {
						p.assets.forEach(a => {
							assetGains[a.name] = 0;
							assetContributions[a.name] = 0;
							assetLosses[a.name] = 0;
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
									assetContributions[asset.name] += contribution;
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
									assetLosses[asset.name] += liquidation;
								}
							});
						}
					}

					// Apply appreciation rates
					p.assets.forEach(asset => {
						const appreciation = assets[asset.name] * (asset.rate / 100);
						assets[asset.name] *= 1 + (asset.rate / 100);
						if (trackGainsLosses) {
							assetGains[asset.name] += appreciation;
						}
					});

					// Update the current year's data with the gains/losses
					if (trackGainsLosses) {
						results[results.length - 1].assetAppreciation = { ...assetGains };
						results[results.length - 1].assetContributions = { ...assetContributions };
						results[results.length - 1].assetLosses = { ...assetLosses };
					}
				}
			}

			return results;
		},
		calculateProjectionWithZeroIncome(startYear: number): ProjectionRow[] {
			return this._projectBase({
				zeroIncomeFromYear: startYear,
				trackMilestones: false,
				trackGainsLosses: false
			});
		},
		calculateProjection(): ProjectionRow[] {
			return this._projectBase({
				zeroIncomeFromYear: null,
				trackMilestones: true,
				trackGainsLosses: true
			});
		},
		updateChart() {
			const chartCanvas = this.$refs.chart as HTMLCanvasElement | undefined;
			if (!chartCanvas) return;
			if (!this.projection || this.projection.length === 0) return;

			const ctx = chartCanvas.getContext('2d');
			if (!ctx) return;

			// Destroy existing chart
			if (this.chartInstance) {
				this.chartInstance.destroy();
			}

			const years = this.projection.map(p => p.year);

			// Create datasets for each asset
			const datasets = this.params.assets.map((asset, index) => {
				const colors = [
					'#6b8ba8', // dim blue
					'#7a9b7f', // dim green
					'#b37d7d', // dim red
					'#9b8fb3', // dim purple
					'#b3956b', // dim orange/brown
					'#7db3ad'  // dim teal
				];
				return {
					label: asset.name,
					data: this.projection.map(p => p.assets?.[asset.name] || 0),
					borderColor: colors[index % colors.length],
					backgroundColor: colors[index % colors.length] + '20',
					tension: 0.4,
					fill: false,
					borderWidth: 2
				};
			});

			// Add total net worth dataset
			datasets.push({
				label: 'Total Net Worth',
				data: this.projection.map(p => p.totalNetWorth),
				borderColor: '#475569',
				backgroundColor: '#47556920',
				borderWidth: 3,
				tension: 0.4,
				fill: false
			} as any);

			// Get theme colors
			const isDark = document.documentElement.classList.contains('dark');
			const textColor = isDark ? '#9ca3af' : '#6b7280';
			const gridColor = isDark ? '#374151' : '#e5e7eb';

			// Create milestone annotations only if annotation plugin is available
			const chartOptions: any = {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: {
					mode: 'index',
					intersect: false,
				},
				plugins: {
					legend: {
						position: 'top',
						labels: {
							color: textColor
						}
					},
					title: {
						display: true,
						text: 'Net Worth & Asset Projection Over Time (Scroll to zoom, drag to pan)',
						color: textColor
					},
					zoom: {
						zoom: {
							wheel: {
								enabled: true,
							},
							pinch: {
								enabled: true
							},
							mode: 'xy',
						},
						pan: {
							enabled: true,
							mode: 'xy',
						},
						limits: {
							x: { min: 'original', max: 'original' },
							y: { min: 'original', max: 'original' }
						}
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							color: textColor,
							callback: function (value: number) {
								if (value === 0) return '€0';
								return '€' + (value / 1000000).toFixed(1) + 'M';
							}
						},
						grid: {
							color: gridColor
						}
					},
					x: {
						ticks: {
							color: textColor
						},
						grid: {
							color: gridColor
						},
						title: {
							display: true,
							text: 'Year',
							color: textColor
						}
					}
				}
			};

			// Add annotations for milestones
			if (this.params.milestones && Array.isArray(this.params.milestones)) {
				const annotations: any = {};
				this.params.milestones.forEach((milestone, index) => {
					if (milestone && !isNaN(milestone)) {
						annotations['milestone' + index] = {
							type: 'line',
							yMin: milestone,
							yMax: milestone,
							borderColor: '#9a6b65',
							borderWidth: 2,
							borderDash: [5, 5],
							label: {
								display: true,
								content: '€' + (milestone / 1000000).toFixed(1) + 'M',
								position: 'end',
								backgroundColor: '#9a6b65'
							}
						};
					}
				});

				if (Object.keys(annotations).length > 0) {
					chartOptions.plugins.annotation = { annotations: annotations };
				}
			}

			this.chartInstance = new Chart(ctx, {
				type: 'line',
				data: {
					labels: years,
					datasets: datasets
				},
				options: chartOptions
			});
		}
	},
	mounted() {
		// Apply dark theme on load
		document.documentElement.classList.toggle('dark', this.darkTheme);

		this.$nextTick(() => {
			this.updateChart();
		});

		// Setup tooltip handling
		const tooltip = document.getElementById('tooltip');
		if (!tooltip) return;

		document.addEventListener('mouseover', (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('tooltip-icon')) {
				const tooltipText = target.getAttribute('data-tooltip');
				const rect = target.getBoundingClientRect();

				if (tooltipText) {
					tooltip.textContent = tooltipText;
					tooltip.style.display = 'block';
					tooltip.style.left = (rect.right + 10) + 'px';
					tooltip.style.top = (rect.top + rect.height / 2) + 'px';
					tooltip.style.transform = 'translateY(-50%)';
				}
			}
		});

		document.addEventListener('mouseout', (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('tooltip-icon')) {
				tooltip.style.display = 'none';
			}
		});
	}
}));

app.mount('#app');
