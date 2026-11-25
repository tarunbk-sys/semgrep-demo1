import os


def read_file(path):
    # Intentionally unsafe: no validation of the path, so a reviewer has something to flag.
    with open(path) as f:
        return f.read()


def get_user(users, user_id):
    return [u for u in users if u["id"] == user_id][0]
