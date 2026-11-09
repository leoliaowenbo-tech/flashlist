#!/usr/bin/env python3
import sys
import os
import sqlite3
import json
from datetime import datetime, timedelta

APPLE_EPOCH = datetime(2001, 1, 1)

def apple_timestamp_to_iso(ts):
    if not ts:
        return None
    try:
        # Apple Cocoa timestamp is seconds since 2001-01-01
        dt = APPLE_EPOCH + timedelta(seconds=float(ts))
        return dt.isoformat()
    except Exception:
        return None

def parse_sqlite(db_path, months=2):
    if not os.path.exists(db_path):
        print(f"Error: {db_path} does not exist")
        return None

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Find task table
    cur.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in cur.fetchall()]
    print(f"Found tables: {tables}")

    task_table = next((t for t in tables if 'task' in t.lower()), None)
    project_table = next((t for t in tables if 'project' in t.lower() or 'list' in t.lower()), None)

    print(f"Task table: {task_table}, Project table: {project_table}")
    if not task_table:
        return None

    # Inspect columns
    cur.execute(f"PRAGMA table_info({task_table});")
    cols = [r[1] for r in cur.fetchall()]
    print(f"Task columns: {cols}")

    cur.execute(f"SELECT * FROM {task_table};")
    rows = cur.fetchall()
    print(f"Total rows in {task_table}: {len(rows)}")

    conn.close()
    return rows

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'OSXCoreDataObjC.storedata'
    parse_sqlite(path)
