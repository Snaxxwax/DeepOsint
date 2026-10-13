import json
import sqlite3
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    spec_json TEXT NOT NULL,
    provider TEXT NOT NULL,
    round INTEGER NOT NULL DEFAULT 1,
    stage_marker TEXT NOT NULL DEFAULT 'planned',
    stop_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slot_state (
    run_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    vocab_level INTEGER NOT NULL DEFAULT 0,
    angles_tried_json TEXT NOT NULL DEFAULT '[]',
    fixes_tried_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (run_id, slot_id)
);

CREATE TABLE IF NOT EXISTS queries (
    query_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    slot_id TEXT NOT NULL,
    query_text TEXT NOT NULL,
    angle TEXT NOT NULL,
    fix TEXT,
    freshness_window TEXT,
    result_count INTEGER DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, slot_id, query_text)
);

CREATE TABLE IF NOT EXISTS results (
    result_id TEXT PRIMARY KEY,
    query_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    snippet TEXT,
    rank INTEGER NOT NULL,
    provider TEXT NOT NULL,
    published_date TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
    url TEXT PRIMARY KEY,
    origin_id TEXT NOT NULL,
    html TEXT,
    text TEXT NOT NULL,
    published_date TEXT,
    updated_date TEXT,
    access_date TEXT NOT NULL,
    status_code INTEGER DEFAULT 200,
    snapshot_url TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
    url UNINDEXED,
    text,
    content='pages',
    content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS claims (
    claim_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    url TEXT NOT NULL,
    value TEXT NOT NULL,
    sentence TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    extracted_by TEXT NOT NULL DEFAULT 'deterministic',
    created_at TEXT NOT NULL,
    UNIQUE (run_id, slot_id, url, value, sentence)
);

CREATE TABLE IF NOT EXISTS grades (
    grade_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    slot_id TEXT NOT NULL,
    answer_value TEXT NOT NULL,
    grade TEXT NOT NULL,
    origins_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    shelf_life_status TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, round, slot_id)
);

CREATE TABLE IF NOT EXISTS overrides (
    override_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    slot_id TEXT NOT NULL,
    grade TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (run_id, slot_id)
);

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    stage TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watch (
    run_id TEXT PRIMARY KEY,
    recheck_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_checked_at TEXT
);
"""

class Store:
    def __init__(self, db_path: str = "rloop.sqlite"):
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        with self.conn:
            self.conn.executescript(SCHEMA_SQL)

    def close(self):
        self.conn.close()

    # Runs
    def create_run(self, run_id: str, spec_json: str, provider: str) -> None:
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT OR IGNORE INTO runs (run_id, spec_json, provider, round, stage_marker, created_at, updated_at)
                VALUES (?, ?, ?, 1, 'planned', ?, ?)
                """,
                (run_id, spec_json, provider, now, now),
            )

    def get_run(self, run_id: str) -> Optional[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM runs WHERE run_id = ?", (run_id,))
        return cur.fetchone()

    def update_run_stage(self, run_id: str, round_num: int, stage_marker: str, stop_reason: Optional[str] = None) -> None:
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                UPDATE runs
                SET round = ?, stage_marker = ?, stop_reason = COALESCE(?, stop_reason), updated_at = ?
                WHERE run_id = ?
                """,
                (round_num, stage_marker, stop_reason, now, run_id),
            )

    # Slot State
    def get_slot_state(self, run_id: str, slot_id: str) -> Tuple[int, List[str], List[str]]:
        cur = self.conn.cursor()
        cur.execute("SELECT vocab_level, angles_tried_json, fixes_tried_json FROM slot_state WHERE run_id = ? AND slot_id = ?", (run_id, slot_id))
        row = cur.fetchone()
        if not row:
            return 0, [], []
        return row["vocab_level"], json.loads(row["angles_tried_json"]), json.loads(row["fixes_tried_json"])

    def update_slot_state(self, run_id: str, slot_id: str, vocab_level: int, angles_tried: List[str], fixes_tried: List[str]) -> None:
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO slot_state (run_id, slot_id, vocab_level, angles_tried_json, fixes_tried_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(run_id, slot_id) DO UPDATE SET
                    vocab_level = excluded.vocab_level,
                    angles_tried_json = excluded.angles_tried_json,
                    fixes_tried_json = excluded.fixes_tried_json
                """,
                (run_id, slot_id, vocab_level, json.dumps(angles_tried), json.dumps(fixes_tried)),
            )

    # Queries
    def save_query(self, run_id: str, round_num: int, slot_id: str, query_text: str, angle: str, fix: Optional[str] = None) -> Optional[str]:
        query_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        try:
            with self.conn:
                self.conn.execute(
                    """
                    INSERT INTO queries (query_id, run_id, round, slot_id, query_text, angle, fix, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (query_id, run_id, round_num, slot_id, query_text, angle, fix, now),
                )
            return query_id
        except sqlite3.IntegrityError:
            # Query already exists for this slot
            cur = self.conn.cursor()
            cur.execute("SELECT query_id FROM queries WHERE run_id = ? AND slot_id = ? AND query_text = ?", (run_id, slot_id, query_text))
            row = cur.fetchone()
            return row["query_id"] if row else None

    def update_query_results(self, query_id: str, result_count: int, error: Optional[str] = None) -> None:
        with self.conn:
            self.conn.execute(
                "UPDATE queries SET result_count = ?, error = ? WHERE query_id = ?",
                (result_count, error, query_id),
            )

    def get_queries_for_run(self, run_id: str) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM queries WHERE run_id = ? ORDER BY round, slot_id", (run_id,))
        return cur.fetchall()

    # Results
    def save_results(self, query_id: str, results: List[Dict[str, Any]]) -> None:
        now = datetime.utcnow().isoformat()
        with self.conn:
            for r in results:
                res_id = str(uuid.uuid4())
                self.conn.execute(
                    """
                    INSERT INTO results (result_id, query_id, url, title, snippet, rank, provider, published_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (res_id, query_id, r["url"], r.get("title", ""), r.get("snippet", ""), r.get("rank", 1), r["provider"], r.get("published_date"), now),
                )

    def get_results_for_run(self, run_id: str) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT r.*, q.slot_id, q.round, q.angle
            FROM results r
            JOIN queries q ON r.query_id = q.query_id
            WHERE q.run_id = ?
            ORDER BY q.round, q.slot_id, r.rank
            """,
            (run_id,),
        )
        return cur.fetchall()

    # Pages
    def save_page(self, url: str, origin_id: str, text: str, html: Optional[str] = None,
                  published_date: Optional[str] = None, updated_date: Optional[str] = None,
                  status_code: int = 200, snapshot_url: Optional[str] = None) -> None:
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO pages (url, origin_id, html, text, published_date, updated_date, access_date, status_code, snapshot_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    origin_id = excluded.origin_id,
                    text = excluded.text,
                    published_date = COALESCE(excluded.published_date, pages.published_date),
                    updated_date = COALESCE(excluded.updated_date, pages.updated_date),
                    access_date = excluded.access_date
                """,
                (url, origin_id, html, text, published_date, updated_date, now, status_code, snapshot_url),
            )

    def get_page(self, url: str) -> Optional[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM pages WHERE url = ?", (url,))
        return cur.fetchone()

    # Claims
    def save_claim(self, run_id: str, slot_id: str, url: str, value: str, sentence: str,
                   verified: bool, reason: Optional[str], extracted_by: str = "deterministic") -> None:
        claim_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO claims (claim_id, run_id, slot_id, url, value, sentence, verified, reason, extracted_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id, slot_id, url, value, sentence) DO UPDATE SET
                    verified = excluded.verified,
                    reason = excluded.reason
                """,
                (claim_id, run_id, slot_id, url, value, sentence, 1 if verified else 0, reason, extracted_by, now),
            )

    def get_claims_for_run(self, run_id: str, slot_id: Optional[str] = None) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        if slot_id:
            cur.execute("SELECT * FROM claims WHERE run_id = ? AND slot_id = ?", (run_id, slot_id))
        else:
            cur.execute("SELECT * FROM claims WHERE run_id = ?", (run_id,))
        return cur.fetchall()

    # Grades
    def save_grade(self, run_id: str, round_num: int, slot_id: str, answer_value: str,
                   grade: str, origins_count: int, notes: str, shelf_life_status: str) -> None:
        grade_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO grades (grade_id, run_id, round, slot_id, answer_value, grade, origins_count, notes, shelf_life_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id, round, slot_id) DO UPDATE SET
                    answer_value = excluded.answer_value,
                    grade = excluded.grade,
                    origins_count = excluded.origins_count,
                    notes = excluded.notes,
                    shelf_life_status = excluded.shelf_life_status
                """,
                (grade_id, run_id, round_num, slot_id, answer_value, grade, origins_count, notes, shelf_life_status, now),
            )

    def get_grades_for_run(self, run_id: str, round_num: Optional[int] = None) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        if round_num is not None:
            cur.execute("SELECT * FROM grades WHERE run_id = ? AND round = ? ORDER BY slot_id", (run_id, round_num))
        else:
            cur.execute("SELECT * FROM grades WHERE run_id = ? ORDER BY round, slot_id", (run_id,))
        return cur.fetchall()

    # Overrides
    def save_override(self, run_id: str, slot_id: str, grade: str, reason: str) -> None:
        override_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO overrides (override_id, run_id, slot_id, grade, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id, slot_id) DO UPDATE SET
                    grade = excluded.grade,
                    reason = excluded.reason
                """,
                (override_id, run_id, slot_id, grade, reason, now),
            )

    def get_overrides(self, run_id: str) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM overrides WHERE run_id = ?", (run_id,))
        return cur.fetchall()

    # Events
    def log_event(self, run_id: str, round_num: int, stage: str, event_type: str, payload: Dict[str, Any]) -> None:
        event_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO events (event_id, run_id, round, stage, event_type, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (event_id, run_id, round_num, stage, event_type, json.dumps(payload), now),
            )

    def get_events(self, run_id: str) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM events WHERE run_id = ? ORDER BY created_at", (run_id,))
        return cur.fetchall()

    # Watch
    def set_watch(self, run_id: str, recheck_date: str) -> None:
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO watch (run_id, recheck_date, status)
                VALUES (?, ?, 'active')
                ON CONFLICT(run_id) DO UPDATE SET recheck_date = excluded.recheck_date, status = 'active'
                """,
                (run_id, recheck_date),
            )

    def get_due_watches(self, current_date: str) -> List[sqlite3.Row]:
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM watch WHERE status = 'active' AND recheck_date <= ?", (current_date,))
        return cur.fetchall()
