import os
from groq import Groq

class FinanceAI:
    def __init__(self, api_key: str = ""):
        if not api_key:
            api_key = os.getenv("GROQ_API_KEY", "")
        self._api_key = api_key
        self._client = None
        self.model = "llama-3.3-70b-versatile"

    @property
    def client(self):
        if self._client is None and self._api_key:
            try:
                self._client = Groq(api_key=self._api_key)
            except Exception:
                self._client = None
                return None
        return self._client if self._client else None

    def _call_groq(self, prompt: str) -> str:
        client = self.client
        if not client:
            return self._fallback_response(prompt)
        try:
            chat_completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model,
                temperature=0.7,
                max_tokens=1024,
            )
            return chat_completion.choices[0].message.content
        except Exception:
            return self._fallback_response(prompt)
    
    def _fallback_response(self, prompt: str) -> str:
        if "insights" in prompt.lower():
            return """Monthly Financial Insights (built-in advice)

Based on your data, here are key observations:
- Track your spending patterns to identify areas for improvement
- Consider setting up automatic savings transfers
- Review subscriptions and recurring expenses regularly
- Look for opportunities to reduce dining out expenses

Remember: small consistent changes lead to significant savings over time.

Tip: add a free Groq API key in Settings to unlock live AI analysis."""

        return """Savings Tips (built-in advice)

1. Follow the 50/30/20 rule: 50% needs, 30% wants, 20% savings
2. Track every expense, no matter how small
3. Set up an emergency fund covering 3-6 months of expenses
4. Review and cancel unused subscriptions
5. Use cashback apps for regular purchases

Tip: add a free Groq API key in Settings to unlock live AI analysis."""
    
    def get_financial_insights(self, current_month_data: dict, previous_month_data: dict, month: int, year: int) -> dict:
        month_names = ["", "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]
        
        categories_text = "\n".join(
            f"• {cat}: ${total:.2f}" for cat, total in current_month_data["categories"].items()
        ) if current_month_data["categories"] else "No expenses recorded yet"
        
        prompt = f"""Analyze this financial data and provide insights for {month_names[month]} {year}:

Current Month:
- Total Income: ${current_month_data['income']:.2f}
- Total Expenses: ${current_month_data['expense']:.2f}
- Balance: ${current_month_data['income'] - current_month_data['expense']:.2f}
- Expense Categories:
{categories_text}

Previous Month:
- Total Income: ${previous_month_data['income']:.2f}
- Total Expenses: ${previous_month_data['expense']:.2f}

Provide:
1. A brief analysis of spending patterns
2. Comparison with previous month (if available)
3. Top 3 areas where spending could be reduced
4. One positive highlight from the spending data
5. A motivational tip for better financial health

Keep response concise and actionable. Use emojis for visual appeal."""
        
        response = self._call_groq(prompt)
        
        return {
            "month": month_names[month],
            "year": year,
            "insights": response,
            "highlights": {
                "income": current_month_data["income"],
                "expenses": current_month_data["expense"],
                "savings": current_month_data["income"] - current_month_data["expense"],
                "top_category": max(current_month_data["categories"].items(), key=lambda x: x[1])[0] if current_month_data["categories"] else "N/A"
            }
        }
    
    def get_savings_suggestions(self, monthly_data: list) -> dict:
        data_text = "\n".join(
            f"• Month {d['month']}/{d['year']}: Income ${d['income']:.2f}, Expenses ${d['expense']:.2f}, Saved ${d['income'] - d['expense']:.2f}"
            for d in monthly_data
        )
        
        prompt = f"""Based on these 6 months of financial data, provide personalized savings suggestions:

{data_text}

Provide:
1. Trend analysis of income and expenses
2. 5 specific, actionable ways to save more money
3. Categories where spending could be reduced
4. Suggested monthly savings goal
5. Warning signs to watch for

Format as practical advice. Be encouraging but realistic. Use emojis."""
        
        response = self._call_groq(prompt)
        
        return {
            "suggestions": response,
            "analysis_period": f"{len(monthly_data)} months",
            "average_income": sum(d["income"] for d in monthly_data) / len(monthly_data) if monthly_data else 0,
            "average_expense": sum(d["expense"] for d in monthly_data) / len(monthly_data) if monthly_data else 0,
        }
