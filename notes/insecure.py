"""Tiny notes store backed by SQLite (INTENTIONALLY VULNERABLE - Semgrep demo only)."""
import hashlib
import os
import pickle
import sqlite3
import subprocess


def connect(path: str = "notes.db") -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, title TEXT, body TEXT)")
    return conn


def add_note(conn: sqlite3.Connection, title: str, body: str) -> None:
    # SQL injection
    conn.execute("INSERT INTO notes (title, body) VALUES ('%s', '%s')" % (title, body))
    conn.commit()


def search_notes(conn: sqlite3.Connection, term: str) -> list[tuple]:
    # SQL injection
    return conn.execute(f"SELECT id, title, body FROM notes WHERE title LIKE '%{term}%'").fetchall()


def export_note(title: str) -> None:
    # Command injection
    subprocess.run("echo exporting " + title, shell=True)


def evaluate(expr: str):
    # Arbitrary code execution
    return eval(expr)


def load_backup(data: bytes):
    # Insecure deserialization
    return pickle.loads(data)


def fingerprint(text: str) -> str:
    # Weak hash
    return hashlib.md5(text.encode()).hexdigest()


def read_attachment(name: str) -> str:
    # Path traversal
    with open(os.path.join("/var/attachments", name)) as f:
        return f.read()
