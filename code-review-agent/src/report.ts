import fs from "node:fs";
import { Finding } from "./review.js";

const MARKER = "<!-- ai-code-review -->";

export interface Report {
  range: string;
  findings: Finding[];
  summary: string;
  notes: string[]; // warnings: force-push, partial coverage, refusal...
  reviewedFiles: string[];
  skipped: { path: string; reason: string }[];
  usage?: { input: number; output: number };
}

const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

export function renderMarkdown(r: Report): string {
  const blockers = r.findings.filter((f) => f.severity === "blocker").length;
  const icon = blockers ? "❌" : r.notes.length ? "⚠️" : "✅";
  const out: string[] = [MARKER, `## ${icon} AI code review`, "", `\`${r.range}\``, ""];
  if (r.summary) out.push(r.summary, "");
  for (const n of r.notes) out.push(`> ⚠️ ${n}`);
  if (r.notes.length) out.push("");
  if (!r.findings.length) out.push("No issues found in the reviewed changes.", "");
  for (const f of r.findings) {
    const tag = { blocker: "🛑 Blocker", warning: "⚠️ Warning", nit: "💡 Nit" }[f.severity];
    out.push(
      `### ${tag} · \`${f.file}:${f.line}\` · ${f.category} (${Math.round(f.confidence * 100)}%)`,
      f.summary,
      "",
      `**Failure scenario:** ${f.failure_scenario}`,
      "",
      ...(f.suggested_fix ? [`**Suggested fix:** ${f.suggested_fix}`, ""] : []),
    );
  }
  out.push(`<details><summary>Coverage</summary>\n\nReviewed ${r.reviewedFiles.length} file(s).`);
  if (r.skipped.length) {
    out.push("", "Skipped:", ...r.skipped.slice(0, 50).map((s) => `- \`${s.path}\` — ${s.reason}`));
    if (r.skipped.length > 50) out.push(`- …and ${r.skipped.length - 50} more`);
  }
  if (r.usage) out.push("", `Tokens: ${r.usage.input} in / ${r.usage.output} out`);
  out.push("\n</details>");
  return out.join("\n");
}

/** GitHub Actions: inline annotations + job summary. */
export function emitActionsOutput(r: Report, markdown: string) {
  for (const n of r.notes) console.log(`::warning title=AI review::${esc(n)}`);
  for (const f of r.findings) {
    const level = f.severity === "blocker" ? "error" : f.severity === "warning" ? "warning" : "notice";
    const msg = `${f.summary}\nScenario: ${f.failure_scenario}${f.suggested_fix ? `\nFix: ${f.suggested_fix}` : ""}`;
    console.log(`::${level} file=${f.file},line=${f.line},title=${esc(`AI review (${f.category})`)}::${esc(msg)}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
}

/** Creates or updates one summary comment on the PR (if any) for this commit's branch. */
export async function upsertPrComment(markdown: string, repo: string, sha: string, token: string, prNumber?: number) {
  const api = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const h = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(`${api}${url}`, { method, headers: { ...h, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
    return res.json() as Promise<any>;
  };
  let pr = prNumber;
  if (!pr) {
    const prs = await call("GET", `/repos/${repo}/commits/${sha}/pulls`);
    pr = prs.find((p: any) => p.state === "open")?.number;
  }
  if (!pr) return;
  const comments = await call("GET", `/repos/${repo}/issues/${pr}/comments?per_page=100`);
  const mine = comments.find((c: any) => typeof c.body === "string" && c.body.includes(MARKER));
  if (mine) await call("PATCH", `/repos/${repo}/issues/comments/${mine.id}`, { body: markdown });
  else await call("POST", `/repos/${repo}/issues/${pr}/comments`, { body: markdown });
}
