import asyncio
import json
import os
import sqlite3
from collections import deque

_DB_PATH = os.path.join(os.path.dirname(__file__), "crowdlens.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db_sync():
    conn = _get_conn()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id    INTEGER NOT NULL,
                anomaly     TEXT    NOT NULL,
                timestamp   REAL    NOT NULL,
                iso         TEXT    NOT NULL,
                source      TEXT    NOT NULL DEFAULT '',
                snapshot_url TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC)")
        conn.commit()
    finally:
        conn.close()


def _insert_alert_sync(entry: dict):
    conn = _get_conn()
    try:
        conn.execute(
            """
            INSERT INTO alerts (alert_id, anomaly, timestamp, iso, source, snapshot_url)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                entry["id"],
                json.dumps(entry["anomaly"]),
                entry["timestamp"],
                entry["iso"],
                entry.get("source", ""),
                entry.get("snapshot_url"),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _load_alerts_sync(limit: int = 500) -> list[dict]:
    conn = _get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?", (limit,)
        ).fetchall()
        results = []
        for row in rows:
            results.append({
                "id": row["alert_id"],
                "anomaly": json.loads(row["anomaly"]),
                "timestamp": row["timestamp"],
                "iso": row["iso"],
                "source": row["source"],
                "snapshot_url": row["snapshot_url"],
            })
        return results
    finally:
        conn.close()


def _clear_alerts_sync():
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM alerts")
        conn.commit()
    finally:
        conn.close()


async def init_db():
    await asyncio.to_thread(_init_db_sync)


async def insert_alert(entry: dict):
    await asyncio.to_thread(_insert_alert_sync, entry)


async def load_alerts(limit: int = 500) -> list[dict]:
    return await asyncio.to_thread(_load_alerts_sync, limit)


async def clear_alerts():
    await asyncio.to_thread(_clear_alerts_sync)


def load_into_deque(dq: deque):
    """Synchronously populate an existing deque from the DB (called at startup)."""
    rows = _load_alerts_sync(dq.maxlen or 500)
    for row in reversed(rows):
        dq.append(row)
