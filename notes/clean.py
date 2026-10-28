"""Tiny notes store backed by SQLite (safe version)."""
import sqlite3


def connect(path: str = "notes.db") -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT, body TEXT)")
    return conn


def add_note(conn: sqlite3.Connection, title: str, body: str) -> int:
    cur = conn.execute("INSERT INTO notes (title, body) VALUES (?, ?)", (title, body))
    conn.commit()
    return cur.lastrowid


def search_notes(conn: sqlite3.Connection, term: str) -> list[tuple]:
    like = f"%{term}%"
    return conn.execute("SELECT id, title, body FROM notes WHERE title LIKE ?", (like,)).fetchall()


if __name__ == "__main__":
    db = connect()
    add_note(db, "hello", "first note")
    print(search_notes(db, "hel"))
