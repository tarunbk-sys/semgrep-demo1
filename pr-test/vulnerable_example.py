"""Sample file with deliberate security problems, for testing PR scans. Never use this code."""

import hashlib
import os
import pickle
import sqlite3
import subprocess

import requests
import yaml
from flask import Flask, request

app = Flask(__name__)


def find_user(name):
    conn = sqlite3.connect("app.db")
    # SQL injection: user input is formatted straight into the query
    return conn.execute("SELECT * FROM users WHERE name = '%s'" % name).fetchall()


def ping(host):
    # Command injection: user input reaches a shell
    return subprocess.run("ping -c 1 " + host, shell=True)


def run_command(cmd):
    os.system(cmd)


def calculate(expression):
    # Arbitrary code execution
    return eval(expression)


def load_session(blob):
    # Unsafe deserialization
    return pickle.loads(blob)


def load_config(text):
    # Unsafe YAML loading
    return yaml.load(text)


def hash_password(password):
    # Weak hash for passwords
    return hashlib.md5(password.encode()).hexdigest()


def fetch(url):
    # TLS certificate checks switched off
    return requests.get(url, verify=False)


@app.route("/greet")
def greet():
    return "<h1>Hello " + request.args.get("name", "") + "</h1>"


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
