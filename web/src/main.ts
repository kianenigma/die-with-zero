import { createApp, defineComponent } from 'vue/dist/vue.esm-bundler.js';
import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'hammerjs';

import { EXAMPLE_DATA, TOOLTIPS } from './config';
import type {
	FinancialParams,
	ProjectionRow,
	DieWithZeroAnalysis,
	AppData,
	ProjectionOptions,
	TaxRate
} from './types';

// Register Chart.js components
Chart.register(...registerables, annotationPlugin, zoomPlugin);

const app = createApp(defineComponent({
	data(): AppData {
		return {
			params: JSON.parse(JSON.stringify(EXAMPLE_DATA)),
			chartInstance: null,
			tooltips: TOOLTIPS,
			sidebarCollapsed: false,
			darkTheme: true
		};
	},
	computed: {
		projection(): ProjectionRow[] {
			return this.calculateProjection();
		},
		dieWithZero(): DieWithZeroAnalysis {
			const target = this.params.targetFinalNetWorth || 0;

			// Calculate if you stop working now
			const stopNowProjection = this.calculateProjectionWithZeroIncome(0);
			const stopNow = stopNowProjection[stopNowProjection.length - 1].totalNetWorth;

			// Find optimal retirement year to reach target
			let bestYear = 0;
			let bestDiff = Math.abs(stopNow - target);
			let optimalFinalWorth = stopNow;

			for (let retireYear = 1; retireYear <= this.params.years; retireYear++) {
				const projection = this.calculateProjectionWithZeroIncome(retireYear);
				const finalWorth = projection[projection.length - 1].totalNetWorth;
				const diff = Math.abs(finalWorth - target);

				if (diff < bestDiff) {
					bestDiff = diff;
					bestYear = retireYear;
					optimalFinalWorth = finalWorth;
				}

				// If net worth goes too negative, we've gone too far
				if (finalWorth < target - Math.abs(target)) {
					break;
				}
			}

			return {
				stopNow,
				optimalYear: bestYear,
				optimalFinalWorth,
				target
			};
		}
	},
	watch: {
		params: {
			handler() {
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
			document.body.classList.toggle('dark-theme', this.darkTheme);
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
		addTaxRate() {
			// Find the last year and add a new tax rate for the next year
			const lastYear = this.params.taxRates.length > 0
				? this.params.taxRates[this.params.taxRates.length - 1].year
				: 0;
			this.params.taxRates.push({ year: lastYear + 1, rate: 30 });
		},
		removeTaxRate(index: number) {
			this.params.taxRates.splice(index, 1);
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
		getTaxRateForYear(year: number): number {
			// Sort and find the most recent tax rate at or before this year
			const sorted = [...this.params.taxRates].sort((a, b) => a.year - b.year);
			const applicable = sorted.filter(tr => tr.year <= year);
			if (applicable.length > 0) {
				return applicable[applicable.length - 1].rate / 100;
			}
			return sorted.length > 0 ? sorted[0].rate / 100 : 0.3;
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
		getEstimatedIncomeForTaxRate(taxRate: TaxRate): number {
			// Calculate gross income at the year this tax rate starts
			const grossIncome = this.params.annualGrossIncome * Math.pow(1 + this.params.incomeGrowthRate / 100, taxRate.year);
			// Apply tax to get net income
			const netIncome = grossIncome * (1 - taxRate.rate / 100);
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
			let currentGrossIncome = p.annualGrossIncome;
			let currentExpenses = p.annualExpenses;
			const assets: Record<string, number> = {};
			p.assets.forEach(a => assets[a.name] = a.amount);

			// Track milestones if requested
			const milestonesReached: Record<number, number | null> = {};
			if (trackMilestones) {
				p.milestones.forEach(m => milestonesReached[m] = null);
			}

			let previousNetWorth: number | null = null;

			for (let year = 0; year <= p.years; year++) {
				// Set income to zero after zeroIncomeFromYear if specified
				if (zeroIncomeFromYear !== null && year >= zeroIncomeFromYear) {
					currentGrossIncome = 0;
				}

				const taxRate = this.getTaxRateForYear(year);
				const totalExpenses = currentExpenses;
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
					// Increase income due to growth rate (only if not yet at zeroIncomeFromYear)
					if (zeroIncomeFromYear === null || year < zeroIncomeFromYear - 1) {
						currentGrossIncome *= 1 + (p.incomeGrowthRate / 100);
					}

					currentExpenses *= 1 + (p.inflationRate / 100);

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
				const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
				return {
					label: asset.name,
					data: this.projection.map(p => p.assets?.[asset.name] || 0),
					borderColor: colors[index % colors.length],
					backgroundColor: colors[index % colors.length] + '20',
					tension: 0.4,
					fill: false
				};
			});

			// Add total net worth dataset
			datasets.push({
				label: 'Total Net Worth',
				data: this.projection.map(p => p.totalNetWorth),
				borderColor: '#2c3e50',
				backgroundColor: '#2c3e5020',
				borderWidth: 3,
				tension: 0.4,
				fill: false
			} as any);

			// Get theme colors
			const isDark = document.body.classList.contains('dark-theme');
			const textColor = isDark ? '#e0e0e0' : '#666';
			const gridColor = isDark ? '#404040' : '#e0e0e0';

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
							borderColor: '#e67e22',
							borderWidth: 2,
							borderDash: [5, 5],
							label: {
								display: true,
								content: '€' + (milestone / 1000000).toFixed(1) + 'M',
								position: 'end',
								backgroundColor: '#e67e22'
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
		document.body.classList.toggle('dark-theme', this.darkTheme);

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
