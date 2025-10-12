# Die With Zero - Financial Planner

A financial planning tool to help you visualize your net worth trajectory and optimize your retirement timing based on the "Die With Zero" philosophy.

<img width="4966" height="2698" alt="image" src="https://github.com/user-attachments/assets/1dc43d6f-3a1e-4108-a2a3-ed926e0317d1" />

## Features

- **Interactive Projections**: Model your financial future with customizable income, expenses, tax rates, and asset allocations
- **Die With Zero Analysis**: Calculate the optimal retirement year to maximize life enjoyment while reaching zero net worth at the end
- **Asset Tracking**: Support for both liquid (ETFs, crypto) and non-liquid (real estate) assets with individual return rates
- **Milestone Tracking**: Set net worth goals and see when you'll reach them
- **Dynamic Tax Rates**: Model changing tax situations over time (e.g., retirement, moving countries)
- **Save/Load Scenarios**: Export and import different financial scenarios for comparison

## Getting Started

### Online Version
Visit the live demo: [GitHub Pages URL will be available after setup]

### Local Version
Open `web/index.html` in your browser - no installation required. The tool runs entirely client-side.

### Enabling GitHub Pages
1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "GitHub Actions" as the source
3. Push any commit to trigger the deployment
4. Your site will be available at `https://[username].github.io/[repository-name]/`

## How It Works

The planner calculates year-by-year projections of your net worth based on:
- Income (with growth rate)
- Expenses (with inflation)
- Tax rates (can change by year)
- Asset appreciation rates
- Additional one-time or recurring expenses

When savings are positive, they're distributed proportionally across liquid assets. When negative (expenses exceed income), liquid assets are sold proportionally to cover the shortfall.
