# INTENTIONALLY VULNERABLE - for Semgrep demo only
import hashlib
import os
import pickle
import random
import sqlite3
import subprocess
import yaml

API_KEY = "sk_live_1234567890abcdef"  # hardcoded secret


def get_user(conn: sqlite3.Connection, username: str):
    # SQL injection
    query = "SELECT id, name FROM users WHERE name = '%s'" % username
    return conn.execute(query).fetchone()


def ping(host: str):
    # Command injection
    return os.system("ping -c 1 " + host)


def run(cmd: str):
    return subprocess.call(cmd, shell=True)


def calc(expr: str):
    # Arbitrary code execution
    return eval(expr)


def load_blob(data: bytes):
    # Insecure deserialization
    return pickle.loads(data)


def load_config(text: str):
    # Unsafe YAML load
    return yaml.load(text, Loader=yaml.Loader)


def hash_password(password: str) -> str:
    # Weak hash
    return hashlib.md5(password.encode()).hexdigest()


def new_token() -> str:
    # Predictable randomness
    return str(random.random())


def read_file(name: str):
    # Path traversal
    with open("/var/data/" + name) as f:
        return f.read()
