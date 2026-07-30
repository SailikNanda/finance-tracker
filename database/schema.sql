CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    date TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS month_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_income REAL DEFAULT 0,
    total_expense REAL DEFAULT 0,
    balance REAL DEFAULT 0,
    is_closed INTEGER DEFAULT 0,
    closed_at TIMESTAMP,
    UNIQUE(month, year)
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_month_year ON transactions(month, year);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_type ON transactions(type);
