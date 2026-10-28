# semgrep-demo1

Python demo for [Semgrep](https://semgrep.dev): a tiny SQLite notes store, written twice.

- `notes/clean.py` – safe version, should produce no findings
- `notes/insecure.py` – **intentionally vulnerable**. Never use it in production.

The GitHub Actions workflow runs `semgrep scan --config auto --error` on every push and PR.
