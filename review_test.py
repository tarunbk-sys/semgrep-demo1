import subprocess


def run_command(cmd):
    # shell=True with user input -> command injection
    subprocess.call(cmd, shell=True)


def find_user(db, name):
    # string-formatted SQL -> SQL injection
    db.execute("select * from users where name = '%s'" % name)


def calculate(expr):
    # eval on user input -> code execution
    return eval(expr)
