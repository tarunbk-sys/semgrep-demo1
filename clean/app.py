import hashlib
import secrets
import sqlite3
import subprocess


def get_user(conn: sqlite3.Connection, username: str):
    # Parameterized query
    cur = conn.execute("SELECT id, name FROM users WHERE name = ?", (username,))
    return cur.fetchone()


def ping(host: str) -> str:
    # Argument list, no shell
    result = subprocess.run(["ping", "-c", "1", host], capture_output=True, text=True, check=False)
    return result.stdout


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return salt, digest


def new_token() -> str:
    return secrets.token_urlsafe(32)
