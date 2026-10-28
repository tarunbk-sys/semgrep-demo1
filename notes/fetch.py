"""Fetch a note from a remote URL (INTENTIONALLY VULNERABLE - Semgrep demo only)."""
import requests

ADMIN_PASSWORD = "admin123"  # hardcoded credential


def fetch_note(url: str) -> str:
    # TLS verification disabled; user-controlled URL (SSRF)
    return requests.get(url, verify=False, timeout=5).text


def is_admin(password: str) -> bool:
    return password == ADMIN_PASSWORD
