#include "../include/engine.h"

MonthSummary calculate_month_summary(Transaction* transactions, int count, int month, int year) {
    MonthSummary summary = {0.0, 0.0, 0.0, 0.0, 0};
    
    for (int i = 0; i < count; i++) {
        if (transactions[i].month == month && transactions[i].year == year) {
            summary.transaction_count++;
            if (transactions[i].amount > 0) {
                summary.total_income += transactions[i].amount;
            } else {
                summary.total_expense += fabs(transactions[i].amount);
            }
        }
    }
    
    summary.balance = summary.total_income - summary.total_expense;
    summary.savings_rate = calculate_savings_rate(summary.total_income, summary.total_expense);
    
    return summary;
}

double calculate_savings_rate(double income, double expense) {
    if (income <= 0) return 0.0;
    return ((income - expense) / income) * 100.0;
}

double calculate_category_total(Transaction* transactions, int count, char* category, int month, int year) {
    double total = 0.0;
    for (int i = 0; i < count; i++) {
        if (transactions[i].month == month && 
            transactions[i].year == year && 
            strcmp(transactions[i].category, category) == 0 &&
            transactions[i].amount < 0) {
            total += fabs(transactions[i].amount);
        }
    }
    return total;
}

int compare_transactions_by_date(const void* a, const void* b) {
    Transaction* ta = (Transaction*)a;
    Transaction* tb = (Transaction*)b;
    return strcmp(ta->date, tb->date);
}

void sort_transactions(Transaction* transactions, int count) {
    qsort(transactions, count, sizeof(Transaction), compare_transactions_by_date);
}
