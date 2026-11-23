"""Sample file that follows safe practices, for testing PR scans. Expected: no findings."""

import ast
import hashlib
import os
import sqlite3
import subprocess

import requests
import yaml
from flask import Flask, jsonify, request

app = Flask(__name__)


def find_user(name):
    conn = sqlite3.connect("app.db")
    # Parameterized query: the driver handles the value safely
    return conn.execute("SELECT * FROM users WHERE name = ?", (name,)).fetchall()


def ping(host):
    # No shell, arguments passed as a list
    return subprocess.run(["ping", "-c", "1", host], check=True)


def calculate(expression):
    # Only accepts Python literals, never executes code
    return ast.literal_eval(expression)


def load_config(text):
    return yaml.safe_load(text)


def hash_password(password, salt):
    # Slow, salted key derivation instead of a fast hash
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000).hex()


def fetch(url):
    # Certificate checks stay on, with a timeout
    return requests.get(url, timeout=10)


def api_key():
    # Secrets come from the environment, not the source
    return os.environ["API_KEY"]


@app.route("/greet")
def greet():
    # JSON response: no HTML is built from user input
    return jsonify(message="Hello", name=request.args.get("name", ""))


if __name__ == "__main__":
    app.run(debug=False, host="127.0.0.1")
