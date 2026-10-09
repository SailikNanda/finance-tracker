import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
temporary = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(temporary.name) / 'ledger.db')
os.environ['API_AUTH_TOKEN'] = 'fixture-owner-token-' + 'x' * 48
from fastapi.testclient import TestClient
import pytest
import app as api
from config import settings
from db import Base, SessionLocal, Transaction, engine, init_db
from schemas import TransactionCreate

AUTH = {'Authorization': 'Bearer ' + settings.api_auth_token}

@pytest.fixture
def client():
    init_db()
    with SessionLocal() as session:
        session.query(Transaction).delete(); session.commit()
    api.ai_cache.clear()
    with TestClient(api.app) as client:
        yield client

def payload(**overrides):
    return {'name': 'Fixture salary', 'amount': 100, 'category': 'Salary', 'type': 'income', 'currency': 'INR', **overrides}

def test_all_ledger_and_key_routes_require_auth(client):
    cases = [('GET', '/transactions', None), ('POST', '/transactions', payload()), ('DELETE', '/transactions/1', None), ('GET', '/summary', None), ('GET', '/ai/insights', None), ('POST', '/settings/apikey', {'api_key': 'not-a-live-key'})]
    for method, path, body in cases:
        assert client.request(method, path, json=body).status_code == 401
    assert client.post('/transactions', json=payload(), headers=AUTH).status_code == 201

def test_backend_fails_closed_without_configured_owner_token(client, monkeypatch):
    monkeypatch.setattr(settings, 'api_auth_token', '')
    assert client.get('/transactions').status_code == 503

def test_backdated_currency_fields_round_trip(client):
    row = client.post('/transactions', json=payload(date='2020-01-02T10:00:00+05:30', currency='USD'), headers=AUTH).json()
    assert row['currency'] == 'USD'
    assert row['month'] == 1 and row['year'] == 2020
    assert row['date'].startswith('2020-01-02')
    assert client.get('/transactions?month=1&year=2020', headers=AUTH).json()[0]['currency'] == 'USD'

@pytest.mark.parametrize('change', [{'name': '   '}, {'category': '\t'}, {'amount': 'Infinity'}, {'amount': 'NaN'}, {'currency': 'FAK'}, {'date': 'bad'}, {'ignored_extra': 42}])
def test_invalid_financial_inputs_are_rejected(client, change):
    assert client.post('/transactions', json=payload(**change), headers=AUTH).status_code == 422

def test_numeric_infinity_validation_error_still_returns_422(client):
    response = client.post('/transactions', content='{"name":"x","amount":Infinity,"category":"Food","type":"income"}', headers={**AUTH, 'Content-Type': 'application/json'})
    assert response.status_code == 422

def test_totals_convert_mixed_currencies_consistently(client, monkeypatch):
    async def rates(*args, **kwargs): return {'base': 'INR', 'rates': {'USD': 0.0125}}
    monkeypatch.setattr(api.currency_service, 'get_rates', rates)
    client.post('/transactions', json=payload(amount=1000), headers=AUTH)
    client.post('/transactions', json=payload(amount=100, currency='USD'), headers=AUTH)
    assert client.get('/summary', headers=AUTH).json()['total_income'] == 9000

def test_ai_cache_changes_after_create_and_delete(client, monkeypatch):
    monkeypatch.setattr(api, 'get_api_key', lambda db: 'dummy-key')
    class FakeAI:
        model = 'test-model'
        last_call_live = True
        def __init__(self, api_key): pass
        def get_financial_insights(self, current, previous, month, year):
            return {'month': 'Test', 'year': year, 'insights': str(current['income']), 'highlights': {'income': current['income'], 'expenses': current['expense']}}
    monkeypatch.setattr(api, 'FinanceAI', FakeAI)
    first = client.post('/transactions', json=payload(), headers=AUTH).json()
    assert client.get('/ai/insights', headers=AUTH).json()['highlights']['income'] == 100
    client.post('/transactions', json=payload(amount=200), headers=AUTH)
    assert client.get('/ai/insights', headers=AUTH).json()['highlights']['income'] == 300
    client.delete(f'/transactions/{first["id"]}', headers=AUTH)
    assert client.get('/ai/insights', headers=AUTH).json()['highlights']['income'] == 200

def test_existing_database_gets_currency_without_erasing_old_rows(tmp_path, monkeypatch):
    from sqlalchemy import create_engine, text
    import db
    old = create_engine('sqlite:///' + str(tmp_path / 'old.db'))
    with old.begin() as connection:
        connection.execute(text('CREATE TABLE transactions (id INTEGER PRIMARY KEY, name TEXT, amount FLOAT, category TEXT, type TEXT, date TEXT, month INTEGER, year INTEGER)'))
        connection.execute(text("INSERT INTO transactions VALUES (1, 'Old', -500, 'Food', 'expense', '2020-01-02', 1, 2020)"))
    monkeypatch.setattr(db, 'engine', old)
    db.init_db()
    with old.connect() as connection:
        row = connection.execute(text('SELECT amount, currency FROM transactions')).one()
        assert row.amount == -500 and row.currency == 'INR'
    old.dispose()
