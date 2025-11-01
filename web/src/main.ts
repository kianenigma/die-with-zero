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
import {
	calculateProjection,
	calculateDieWithZeroAnalysis,
	calculateEstimatedNetIncome,
	calculateAssetValueAtYear
} from './ui-functions';
import type {
	FinancialParams,
	ProjectionRow,
	DieWithZeroAnalysis,
	AppData,
	IncomeType,
	ExpenseType,
	TaxType
} from './types';

// TODO: year 0 calculation is still a bit off
// TODO: years is duplicate in overall config and individual income/expense/tax

// Register Chart.js components
Chart.register(...registerables, annotationPlugin, zoomPlugin);

const STORAGE_KEY = 'die-with-zero-params';

const app = createApp(defineComponent({
	data(): AppData {
		// Merge stored data with defaults to ensure all properties exist
		const mergeWithDefaults = (stored: any, defaults: FinancialParams): FinancialParams => {
			// Deep merge function to ensure all nested properties exist
			const result: any = JSON.parse(JSON.stringify(defaults));

			if (!stored || typeof stored !== 'object') {
				return result;
			}

			// Merge top-level properties
			for (const key in defaults) {
				if (stored.hasOwnProperty(key)) {
					const storedValue = stored[key];
					const defaultValue = (defaults as any)[key];

					// Handle arrays
					if (Array.isArray(defaultValue)) {
						result[key] = Array.isArray(storedValue) ? storedValue : defaultValue;
					}
					// Handle objects (like income, expense, tax)
					else if (typeof defaultValue === 'object' && defaultValue !== null) {
						result[key] = typeof storedValue === 'object' && storedValue !== null
							? { ...defaultValue, ...storedValue }
							: defaultValue;
					}
					// Handle primitives
					else {
						result[key] = storedValue;
					}
				}
			}

			// Ensure transactions array exists (for backward compatibility)
			if (!result.transactions) {
				result.transactions = [];
			}

			return result;
		};

		// Try to load from localStorage, fallback to EXAMPLE_DATA
		const loadFromStorage = (): FinancialParams => {
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored) {
					const parsed = JSON.parse(stored);
					return mergeWithDefaults(parsed, EXAMPLE_DATA);
				}
			} catch (error) {
				console.error('Error loading from localStorage:', error);
			}
			return JSON.parse(JSON.stringify(EXAMPLE_DATA));
		};

		const loadSidebarWidth = (): number => {
			const DEFAULT_WIDTH = 500;
			const MIN_WIDTH = 300;
			const MAX_WIDTH = 800;

			try {
				const stored = localStorage.getItem('sidebar-width');
				if (stored) {
					const parsed = parseInt(stored, 10);
					// Validate the parsed value
					if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
						return parsed;
					}
				}
			} catch (error) {
				console.error('Error loading sidebar width:', error);
			}
			return DEFAULT_WIDTH;
		};

		const loadDarkTheme = (): boolean => {
			const DEFAULT_THEME = false; // Default to light theme

			try {
				const stored = localStorage.getItem('dark-theme');
				if (stored !== null && stored !== undefined) {
					return stored === 'true';
				}
			} catch (error) {
				console.error('Error loading dark theme:', error);
			}
			return DEFAULT_THEME;
		};

		return {
			params: loadFromStorage(),
			chartInstance: null,
			tooltips: TOOLTIPS,
			sidebarCollapsed: false,
			darkTheme: loadDarkTheme(),
			sidebarWidth: loadSidebarWidth(),
			isResizing: false
		};
	},
	computed: {
		projection(): ProjectionRow[] {
			return calculateProjection(this.params);
		},
		dieWithZero(): DieWithZeroAnalysis {
			return calculateDieWithZeroAnalysis(this.params);
		},
		incomeValidation(): { ok: boolean; reason?: string } {
			return validateIncome(this.params.income);
		},
		expenseValidation(): { ok: boolean; reason?: string } {
			return validateExpense(this.params.expense);
		},
		taxValidation(): { ok: boolean; reason?: string } {
			return validateTax(this.params.tax);
		},
		suggestedExpenseAdjustment(): { startingExpense: number; growth: number } | null {
			// Only provide suggestion if we have a shortfall/surplus
			const analysis = this.dieWithZero;
			const shortfall = analysis.target - analysis.currentFinalWorth;
			if (shortfall === 0) {
				return null;
			}

			// Get current expense settings
			let currentStart = 0;
			let currentGrowth = 0;

			if (this.params.expense.type === 'fixed') {
				currentStart = this.params.expense.payload.start;
				currentGrowth = this.params.expense.payload.growth;
			} else if (this.params.expense.type === 'range' && this.params.expense.payload.length > 0) {
				currentStart = this.params.expense.payload[0].amount;
				currentGrowth = 0;
			} else if (this.params.expense.type === 'manual' && this.params.expense.payload.length > 0) {
				currentStart = this.params.expense.payload[0];
				currentGrowth = 0;
			} else {
				return null;
			}

			// Calculate adjustment needed
			// If shortfall is positive, we need to REDUCE expenses (save more)
			// If shortfall is negative, we can INCREASE expenses (save less)
			const adjustmentPerYear = -shortfall / this.params.years;
			const suggestedStart = currentStart + adjustmentPerYear;

			// Use the same growth rate they currently have
			return {
				startingExpense: Math.max(0, suggestedStart),
				growth: currentGrowth
			};
		}
	},
	watch: {
		'params.years'() {
			// Sync income years when projection years change
			this.syncIncomeYears();
		},
		'params.assets': {
			handler() {
				// Cleanup transactions when assets are removed
				this.cleanupInvalidTransactions();
			},
			deep: true
		},
		sidebarWidth(newWidth: number) {
			// Save sidebar width to localStorage
			try {
				localStorage.setItem('sidebar-width', newWidth.toString());
			} catch (error) {
				console.error('Error saving sidebar width:', error);
			}
			// Update chart after resize
			this.$nextTick(() => {
				this.updateChart();
			});
		},
		darkTheme(newValue: boolean) {
			// Save dark theme to localStorage
			try {
				localStorage.setItem('dark-theme', newValue.toString());
			} catch (error) {
				console.error('Error saving dark theme:', error);
			}
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
		addTransaction() {
			// Ensure transactions array exists
			if (!this.params.transactions) {
				this.params.transactions = [];
			}

			this.params.transactions.push({
				year: 0,
				fromAsset: this.params.assets[0]?.name || '',
				toAsset: this.params.assets[0]?.name || '',
				amountType: 'percentage',
				amount: 0
			});
		},
		removeTransaction(index: number) {
			if (!this.params.transactions) {
				return;
			}
			this.params.transactions.splice(index, 1);
		},
		cleanupInvalidTransactions() {
			// Ensure transactions array exists
			if (!this.params.transactions) {
				this.params.transactions = [];
				return;
			}

			// Remove transactions that reference non-existent assets
			const assetNames = new Set(this.params.assets.map(a => a.name));
			this.params.transactions = this.params.transactions.filter(t =>
				assetNames.has(t.fromAsset) && assetNames.has(t.toAsset)
			);
		},
		startResize(event: MouseEvent) {
			this.isResizing = true;
			document.body.classList.add('resizing');
			event.preventDefault();
		},
		handleResize(event: MouseEvent) {
			if (!this.isResizing) return;

			const minWidth = 300;
			const maxWidth = 800;
			const newWidth = Math.min(Math.max(event.clientX, minWidth), maxWidth);

			this.sidebarWidth = newWidth;
			// Update CSS variable for fixed resize handle position
			document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
		},
		stopResize() {
			this.isResizing = false;
			document.body.classList.remove('resizing');
		},
		getAssetValueAtYear(assetName: string, year: number): number {
			return calculateAssetValueAtYear(this.params, assetName, year);
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
			if (num === null || num === undefined) return '';
			if (num === 0) return '0';
			return new Intl.NumberFormat('en-US').format(num);
		},
		parseInputNumber(value: string): number {
			// Remove all non-digit characters except decimal point
			const cleaned = value.replace(/[^\d.]/g, '');
			const parsed = parseFloat(cleaned);
			return isNaN(parsed) ? 0 : parsed;
		},
		getEstimatedIncomeForTaxRange(taxRangeItem: { from: number; rate: number }): number {
			return calculateEstimatedNetIncome(this.params.income, taxRangeItem);
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

		// Initialize CSS variable for sidebar width
		document.documentElement.style.setProperty('--sidebar-width', `${this.sidebarWidth}px`);

		this.$nextTick(() => {
			this.updateChart();
		});

		// Setup resize event listeners
		document.addEventListener('mousemove', this.handleResize);
		document.addEventListener('mouseup', this.stopResize);

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
