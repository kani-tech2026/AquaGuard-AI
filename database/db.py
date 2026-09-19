import sqlite3
from pathlib import Path


DB_PATH = Path("database/aquaguard.db")


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_name TEXT NOT NULL,
            confidence REAL NOT NULL,
            x1 REAL,
            y1 REAL,
            x2 REAL,
            y2 REAL,
            source TEXT,
            latitude REAL,
            longitude REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Add GPS columns if the database already existed
    columns = [
        row[1]
        for row in conn.execute(
            "PRAGMA table_info(detections)"
        ).fetchall()
    ]

    if "latitude" not in columns:
        conn.execute(
            "ALTER TABLE detections ADD COLUMN latitude REAL"
        )

    if "longitude" not in columns:
        conn.execute(
            "ALTER TABLE detections ADD COLUMN longitude REAL"
        )

    conn.commit()
    conn.close()


def add_detection(
    class_name,
    confidence,
    bbox,
    source="unknown",
    latitude=None,
    longitude=None
):
    conn = get_connection()

    conn.execute("""
        INSERT INTO detections
        (
            class_name,
            confidence,
            x1,
            y1,
            x2,
            y2,
            source,
            latitude,
            longitude
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        class_name,
        confidence,
        bbox[0],
        bbox[1],
        bbox[2],
        bbox[3],
        source,
        latitude,
        longitude
    ))

    conn.commit()
    conn.close()


def get_detections(limit=50):
    conn = get_connection()

    cursor = conn.execute("""
        SELECT
            id,
            class_name,
            confidence,
            x1,
            y1,
            x2,
            y2,
            source,
            latitude,
            longitude,
            created_at
        FROM detections
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()

    return rows


if __name__ == "__main__":
    init_db()
    print("AquaGuard database initialized.")