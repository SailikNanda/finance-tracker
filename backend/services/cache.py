"""Thread-safe TTL cache."""
from __future__ import annotations
import threading
import time
from typing import Any, Generic, Optional, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self) -> None:
        self._store: dict[str, tuple[T, float]] = {}
        self._lock = threading.RLock()

    def get(self, key: str, default: T | None = None) -> T | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return default
            value, expires_at = entry
            if time.time() > expires_at:
                self._store.pop(key, None)
                return default
            return value

    def set(self, key: str, value: T, ttl_seconds: float = 3600) -> None:
        with self._lock:
            self._store[key] = (value, time.time() + ttl_seconds)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"size": len(self._store)}