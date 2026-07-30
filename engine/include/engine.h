#ifndef FINANCE_ENGINE_H
#define FINANCE_ENGINE_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>

typedef struct {
    int id;
    char name[256];
    double amount;
    char category[128];
    char date[32];
    int month;
    int year;
} Transaction;

typedef struct {
    double total_income;
    double total_expense;
    double balance;
    double savings_rate;
    int transaction_count;
} MonthSummary;

typedef struct {
    double amount;
    char description[256];
    char category[128];
} SavingsSuggestion;

MonthSummary calculate_month_summary(Transaction* transactions, int count, int month, int year);
double calculate_savings_rate(double income, double expense);
double calculate_category_total(Transaction* transactions, int count, char* category, int month, int year);
int compare_transactions_by_date(const void* a, const void* b);
void sort_transactions(Transaction* transactions, int count);

#endif
