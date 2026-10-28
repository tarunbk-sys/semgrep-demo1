# semgrep-demo1

Small demo repo for trying out [Semgrep](https://semgrep.dev).

- `clean/` – safe code that should produce no findings
- `vulnerable/` – **intentionally insecure** code. Never use it in production.

## Run

```sh
semgrep scan --config auto .
```
