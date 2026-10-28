# INTENTIONALLY VULNERABLE - for Semgrep demo only
import hashlib
import os
import pickle
import random
import sqlite3
import subprocess
import yaml

AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"  # hardcoded secret
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"


def get_user(conn: sqlite3.Connection, username: str):
    # SQL injection
    query = "SELECT id, name FROM users WHERE name = '%s'" % username
    return conn.execute(query).fetchone()


def ping(host: str):
    # Command injection
    return os.popen("ping -c 1 " + host).read()


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
    return "".join(random.choice("abcdef0123456789") for _ in range(32))


def read_file(name: str):
    # Path traversal
    with open("/var/data/" + name) as f:
        return f.read()
