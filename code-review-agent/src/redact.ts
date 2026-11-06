/** Redacts likely secrets before anything is sent to the LLM. */
const PATTERNS: { type: string; re: RegExp }[] = [
  { type: "aws-access-key", re: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { type: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { type: "github-pat", re: /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g },
  { type: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { type: "openai-style-key", re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { type: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { type: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { type: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  {
    type: "hardcoded-credential",
    re: /((?:secret|passw(?:or)?d|token|api[_-]?key|private[_-]?key)["']?\s*[:=]\s*["'])([^"'\s]{8,})(["'])/gi,
  },
];

export interface RedactResult {
  text: string;
  hits: string[]; // secret types found on this line
}

export function redactLine(line: string): RedactResult {
  let text = line;
  const hits: string[] = [];
  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    hits.push(type);
    text =
      type === "hardcoded-credential"
        ? text.replace(re, (_m, a, _b, c) => `${a}[REDACTED:${type}]${c}`)
        : text.replace(re, `[REDACTED:${type}]`);
  }
  return { text, hits };
}
