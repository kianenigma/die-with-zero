import pandas as pd
from typing import Dict, List, Union


class FinancialPlanner:
    def __init__(
        self,
        annual_gross_income: float,
        annual_expenses: float,
        inflation_rate: float,
        income_growth_rate: float,
        tax_rate: Union[float, Dict[int, float]],
        asset_allocation: Dict[str, Dict[str, float]],
        additional_expenses: Union[
            None, Dict[int, Dict[str, Union[float, str]]]
        ] = None,
        milestones: Union[None, List[float]] = None,
    ):
        """
        Initialize the financial planner.

        Args:
            annual_gross_income: Annual gross income (before tax)
            annual_expenses: Annual living expenses (current year)
            inflation_rate: Annual inflation rate (e.g., 0.03 for 3%)
            income_growth_rate: Annual income growth rate (e.g., 0.03 for 3%)
            tax_rate: Tax rate as either:
                - Single float (e.g., 0.35 for 35%) applied to all years
                - Dict mapping year to tax rate (e.g., {0: 0.35, 5: 0.40, 10: 0.45})
                  Years not specified use the most recent specified rate
            asset_allocation: Dict with asset categories, each containing:
                - 'amount': Current amount in this asset
                - 'rate': Annual appreciation rate (e.g., 0.08 for 8%)
                - 'liquid': Boolean indicating if asset can be liquidated (True) or not (False)
            additional_expenses: Optional dict mapping year to expense details:
                - 'amount': Annual expense amount
                - 'description': Short description of the expense
                Example: {5: {'amount': 20000, 'description': 'Kid expenses'}}
                Years not specified use the most recent specified expense (or 0 if none)
            milestones: Optional list of net worth milestones to track (e.g., [1000000, 5000000])
                The projection will include columns showing which year each milestone is reached

        Example:
            asset_allocation = {
                'ETFs': {'amount': 50000, 'rate': 0.08, 'liquid': True},
                'Crypto': {'amount': 20000, 'rate': 0.15, 'liquid': True},
                'Real Estate': {'amount': 500000, 'rate': 0.02, 'liquid': False}
            }
            tax_rate = {0: 0.30, 10: 0.35, 20: 0.40}  # 30% for years 0-9, 35% for 10-19, etc.
            additional_expenses = {
                0: {'amount': 0, 'description': 'No kids'},
                5: {'amount': 20000, 'description': 'First kid'},
                10: {'amount': 40000, 'description': 'Second kid'}
            }
        """
        self.initial_gross_income = annual_gross_income
        self.initial_expenses = annual_expenses
        self.inflation_rate = inflation_rate
        self.income_growth_rate = income_growth_rate
        self.tax_rate = tax_rate
        self.asset_allocation = asset_allocation
        self.additional_expenses = additional_expenses or {}
        self.milestones = sorted(milestones) if milestones else []

        # Calculate initial net worth from asset allocation
        self.initial_net_worth = sum(cat["amount"] for cat in asset_allocation.values())

    def _get_tax_rate_for_year(self, year: int) -> float:
        """Get the tax rate for a specific year."""
        if isinstance(self.tax_rate, float):
            return self.tax_rate

        # Find the most recent tax rate at or before this year
        applicable_years = [y for y in sorted(self.tax_rate.keys()) if y <= year]
        if applicable_years:
            return self.tax_rate[applicable_years[-1]]

        # If no rate found for early years, use the first available rate
        return self.tax_rate[min(self.tax_rate.keys())]

    def _get_additional_expense_for_year(self, year: int) -> tuple[float, str]:
        """Get the additional expense amount and description for a specific year."""
        if not self.additional_expenses:
            return 0.0, ""

        # Find the most recent expense definition at or before this year
        applicable_years = [
            y for y in sorted(self.additional_expenses.keys()) if y <= year
        ]
        if applicable_years:
            expense_data = self.additional_expenses[applicable_years[-1]]
            return expense_data["amount"], expense_data["description"]

        # If no expense found for early years, return 0
        return 0.0, ""

    def _project_base(
        self,
        years: int,
        verbose: bool = True,
        income_override: Union[None, Dict[int, float]] = None,
    ) -> pd.DataFrame:
        """
        Base projection function with optional income override.

        Args:
            years: Number of years to project
            verbose: If True, include gain/loss columns for each asset. If False, exclude them.
            income_override: Optional dict mapping year to gross income (overrides normal income calculation)

        Returns:
            DataFrame with yearly breakdown
        """
        results = []

        # Initialize tracking variables
        current_gross_income = self.initial_gross_income
        current_expenses = self.initial_expenses
        assets = {cat: data["amount"] for cat, data in self.asset_allocation.items()}

        # Track which milestones have been reached
        milestones_reached = {ms: None for ms in self.milestones}

        for year in range(years + 1):
            # Override income if specified
            if income_override is not None and year in income_override:
                current_gross_income = income_override[year]

            # Calculate tax and net income
            tax_rate = self._get_tax_rate_for_year(year)
            current_net_income = current_gross_income * (1 - tax_rate)

            # Get additional expenses for this year
            additional_expense, _ = self._get_additional_expense_for_year(year)
            total_expenses = current_expenses + additional_expense

            # Calculate current values
            total_net_worth = sum(assets.values())
            annual_savings = current_net_income - total_expenses if year > 0 else 0

            # Check if any milestones are reached this year
            for milestone in self.milestones:
                if (
                    milestones_reached[milestone] is None
                    and total_net_worth >= milestone
                ):
                    milestones_reached[milestone] = year

            # Store year data
            year_data = {
                "Year": year,
                "Gross Income": current_gross_income,
                "Tax Rate": tax_rate,
                "Net Income": current_net_income,
                "Base Expenses": current_expenses,
                "Additional Expenses": additional_expense,
                "Total Expenses": total_expenses,
                "Annual Savings": annual_savings,
            }

            # Add individual asset categories with their current values
            for category in assets.keys():
                year_data[f"{category}"] = assets[category]

            # Add gain/loss/net columns for each asset (only meaningful from year 1 onwards)
            if verbose and year > 0:
                for category in assets.keys():
                    # These will be populated with the changes that happened this year
                    year_data[f"{category} Gain"] = 0
                    year_data[f"{category} Loss"] = 0
                    year_data[f"{category} Net Change"] = 0

            year_data["Total Net Worth"] = total_net_worth

            # Add unrealized milestones column
            if self.milestones:
                unrealized = [
                    f"€{m/1_000_000:.1f}M" if m >= 1_000_000 else f"€{m/1_000:.0f}K"
                    for m in self.milestones
                    if milestones_reached[m] is None
                ]
                year_data["Unrealized Milestones"] = (
                    ", ".join(unrealized) if unrealized else "All reached!"
                )

            results.append(year_data)

            # Project to next year and calculate gains/losses
            if year < years:
                # Increase income due to growth rate (only if not overridden)
                if income_override is None or (year + 1) not in income_override:
                    current_gross_income *= 1 + self.income_growth_rate

                # Increase expenses due to inflation
                current_expenses *= 1 + self.inflation_rate

                # Initialize tracking
                asset_gains = {cat: 0.0 for cat in assets.keys()}
                asset_losses = {cat: 0.0 for cat in assets.keys()}

                # Handle savings/liquidation
                if annual_savings > 0:
                    # Positive savings: distribute proportionally across liquid assets only
                    liquid_assets = {
                        k: v
                        for k, v in assets.items()
                        if self.asset_allocation[k].get("liquid", True)
                    }
                    total_liquid = sum(liquid_assets.values())

                    if total_liquid > 0:
                        for category in liquid_assets.keys():
                            proportion = assets[category] / total_liquid
                            contribution = annual_savings * proportion
                            assets[category] += contribution
                            asset_gains[category] += contribution
                elif annual_savings < 0:
                    # Negative savings: liquidate from liquid assets equally
                    liquid_assets = {
                        k: v
                        for k, v in assets.items()
                        if self.asset_allocation[k].get("liquid", True)
                    }
                    total_liquid = sum(liquid_assets.values())

                    if total_liquid > 0:
                        amount_to_liquidate = abs(annual_savings)
                        for category in liquid_assets.keys():
                            proportion = assets[category] / total_liquid
                            liquidation = amount_to_liquidate * proportion
                            assets[category] -= liquidation
                            asset_losses[category] += liquidation

                # Apply appreciation rates
                for category, value in assets.items():
                    rate = self.asset_allocation[category]["rate"]
                    appreciation = value * rate
                    assets[category] = value * (1 + rate)
                    asset_gains[category] += appreciation

                # Update the CURRENT year's data with the gains/losses that will occur
                # (This represents what happens during this year to get to next year)
                if verbose:
                    for category in assets.keys():
                        results[-1][f"{category} Gain"] = asset_gains[category]
                        results[-1][f"{category} Loss"] = asset_losses[category]
                        results[-1][f"{category} Net Change"] = (
                            asset_gains[category] - asset_losses[category]
                        )

        return pd.DataFrame(results)

    def project(self, years: int, verbose: bool = True) -> pd.DataFrame:
        """
        Project net worth over specified number of years.

        Args:
            years: Number of years to project
            verbose: If True, include gain/loss columns for each asset. If False, exclude them.

        Returns:
            DataFrame with yearly breakdown
        """
        return self._project_base(years, verbose)

    def _project_with_zero_income(
        self, years: int, start_year: int = 0
    ) -> pd.DataFrame:
        """
        Project net worth with income set to zero from start_year onwards.

        Args:
            years: Number of years to project
            start_year: Year from which income becomes zero (default: 0 means immediately)

        Returns:
            DataFrame with yearly breakdown
        """
        # Build income override dict - keep normal income until start_year, then zero
        income_override = {}
        current_income = self.initial_gross_income

        for year in range(years + 1):
            if year < start_year:
                if year > 0:
                    current_income *= 1 + self.income_growth_rate
                income_override[year] = current_income
            else:
                income_override[year] = 0

        return self._project_base(years, verbose=False, income_override=income_override)

    def summary(self, years: int, verbose: bool = True) -> None:
        """
        Print a formatted summary of the projection.

        Args:
            years: Number of years to project
            verbose: If True, include gain/loss columns for each asset. If False, exclude them.
        """
        df = self.project(years, verbose=verbose)

        print("\n" + "=" * 80)
        print("FINANCIAL PROJECTION SUMMARY")
        print("=" * 80)

        print("\nINITIAL CONDITIONS:")
        print(f"  Starting Net Worth: €{self.initial_net_worth:,.2f}")
        print(f"  Annual Gross Income: €{self.initial_gross_income:,.2f}")
        initial_tax_rate = self._get_tax_rate_for_year(0)
        print(f"  Initial Tax Rate: {initial_tax_rate:.1%}")
        print(
            f"  Initial Net Income: €{self.initial_gross_income * (1 - initial_tax_rate):,.2f}"
        )
        print(f"  Initial Annual Expenses: €{self.initial_expenses:,.2f}")
        print(f"  Inflation Rate: {self.inflation_rate:.1%}")
        print(f"  Income Growth Rate: {self.income_growth_rate:.1%}")

        if isinstance(self.tax_rate, dict) and len(self.tax_rate) > 1:
            print(f"\n  Tax Rate Schedule:")
            for year in sorted(self.tax_rate.keys()):
                print(f"    Year {year}+: {self.tax_rate[year]:.1%}")

        if self.additional_expenses:
            print(f"\n  Additional Expense Schedule:")
            for year in sorted(self.additional_expenses.keys()):
                expense = self.additional_expenses[year]
                print(
                    f"    Year {year}+: €{expense['amount']:,.2f} ({expense['description']})"
                )

        print("\nASSET ALLOCATION:")
        for category, data in self.asset_allocation.items():
            liquid_status = "liquid" if data.get("liquid", True) else "non-liquid"
            print(
                f"  {category}: €{data['amount']:,.2f} "
                f"@ {data['rate']:.1%} annual return ({liquid_status})"
            )

        print("\n" + "-" * 80)
        print("YEAR-BY-YEAR PROJECTION:")
        print("-" * 80)

        # Format the dataframe for display
        pd.options.display.float_format = "{:,.2f}".format
        print(df.to_string(index=False))

        print("\n" + "=" * 80)
        print("KEY METRICS:")
        print("=" * 80)

        final_row = df.iloc[-1]
        initial_row = df.iloc[0]

        print(f"  Final Net Worth (Year {years}): €{final_row['Total Net Worth']:,.2f}")
        print(
            f"  Growth: €{final_row['Total Net Worth'] - initial_row['Total Net Worth']:,.2f}"
        )
        print(
            f"  Total Return: {((final_row['Total Net Worth'] / initial_row['Total Net Worth']) - 1) * 100:.1f}%"
        )
        print(
            f"  CAGR: {((final_row['Total Net Worth'] / initial_row['Total Net Worth']) ** (1/years) - 1) * 100:.2f}%"
        )
        print(f"  Final Annual Expenses: €{final_row['Total Expenses']:,.2f}")

        # Die with Zero Analysis
        print("\n" + "=" * 80)
        print("DIE WITH ZERO ANALYSIS:")
        print("=" * 80)

        # 1. If you stop working now
        df_no_income = self._project_with_zero_income(years, start_year=0)
        final_worth_no_income = df_no_income.iloc[-1]["Total Net Worth"]
        print(f"  If you stop working NOW (year 0):")
        print(f"    Final net worth in year {years}: €{final_worth_no_income:,.2f}")

        # 2. Find optimal retirement year to reach ~0 net worth
        print(f"\n  Optimal retirement year to die with zero:")

        # Binary search for the year where final net worth is closest to zero
        best_year = 0
        best_diff = abs(final_worth_no_income)

        for retire_year in range(1, years + 1):
            df_retire = self._project_with_zero_income(years, start_year=retire_year)
            final_worth = df_retire.iloc[-1]["Total Net Worth"]
            diff = abs(final_worth)

            if diff < best_diff:
                best_diff = diff
                best_year = retire_year

            # If net worth goes negative, we've gone too far
            if final_worth < 0:
                break

        if best_year > 0:
            df_optimal = self._project_with_zero_income(years, start_year=best_year)
            final_worth_optimal = df_optimal.iloc[-1]["Total Net Worth"]
            print(f"    Stop working at year {best_year}")
            print(f"    Final net worth in year {years}: €{final_worth_optimal:,.2f}")
        else:
            print(
                f"    Cannot reach zero - expenses exceed asset growth even with continued income"
            )

        print("\n")


if __name__ == "__main__":
    # Example data (safe to share with others)
    EXAMPLE_DATA = {
        "annual_gross_income": 80000,
        "annual_expenses": 40000,
        "years": 40,
        "inflation_rate": 0.02,
        "income_growth_rate": 0.02,
        "tax_rate": {0: 0.30, 20: 1.0},
        "additional_expenses": {
            0: {"amount": 15000, "description": "Kids education"},
            18: {"amount": 0, "description": "None"},
        },
        "asset_allocation": {
            "ETFs": {"amount": 200000, "rate": 0.07, "liquid": True},
            "Crypto": {"amount": 50000, "rate": 0.12, "liquid": True},
            "Real Estate": {"amount": 400000, "rate": 0.03, "liquid": False},
        },
        "milestones": [1000000, 2000000, 3000000],
    }

    planner = FinancialPlanner(
        annual_gross_income=EXAMPLE_DATA["annual_gross_income"],
        income_growth_rate=EXAMPLE_DATA["income_growth_rate"],
        annual_expenses=EXAMPLE_DATA["annual_expenses"],
        inflation_rate=EXAMPLE_DATA["inflation_rate"],
        tax_rate=EXAMPLE_DATA["tax_rate"],
        additional_expenses=EXAMPLE_DATA["additional_expenses"],
        asset_allocation=EXAMPLE_DATA["asset_allocation"],
        milestones=EXAMPLE_DATA["milestones"],
    )
    planner.summary(years=EXAMPLE_DATA["years"], verbose=False)
