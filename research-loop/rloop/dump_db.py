import json
import sqlite3
import sys

def dump_db(db_path: str = "rloop.sqlite"):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    tables = ["runs", "slot_state", "queries", "results", "pages", "claims", "grades", "overrides", "events", "watch"]
    data = {}

    for t in tables:
        try:
            cur.execute(f"SELECT * FROM {t}")
            rows = [dict(r) for r in cur.fetchall()]
            data[t] = rows
        except Exception as e:
            data[t] = []

    conn.close()
    return data

if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else "rloop.sqlite"
    print(json.dumps(dump_db(db)))
