import fs from "node:fs";
import { loadConfig } from "./config.js";
import { applyBudget, buildContext, FileContext, shouldSkip } from "./context.js";
import { git, listChangedFiles, resolveRange, setRepoDir } from "./git.js";
import { emitActionsOutput, renderMarkdown, Report, upsertPrComment } from "./report.js";
import { Finding, postProcess, reviewWithLLM } from "./review.js";

/**
 * Usage:
 *   In GitHub Actions: reads the event payload automatically (push event).
 *   Locally:           tsx src/index.ts --base <sha> --head <sha> [--dry-run]
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const repoDir = process.env.REVIEW_REPO_DIR ?? process.env.GITHUB_WORKSPACE ?? process.cwd();
  setRepoDir(repoDir);
  const cfg = loadConfig(repoDir);
  const dryRun = process.argv.includes("--dry-run");

  // ---- inputs -------------------------------------------------------------
  let before = arg("base");
  let after = arg("head") ?? process.env.GITHUB_SHA ?? git(["rev-parse", "HEAD"]).trim();
  let defaultBranch = process.env.DEFAULT_BRANCH ?? "main";
  let repo = process.env.GITHUB_REPOSITORY ?? "";
  if (process.env.GITHUB_EVENT_PATH && !arg("head")) {
    const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    if (process.env.GITHUB_EVENT_NAME === "push") {
      before = ev.before;
      after = ev.after;
    }
    defaultBranch = ev.repository?.default_branch ?? defaultBranch;
    repo = ev.repository?.full_name ?? repo;
  }

  // ---- 1. resolve range (force-push / new-branch aware) --------------------
  const range = resolveRange({ before, after, defaultBranch });
  if (!range) return console.log("Branch deleted; nothing to review.");
  const rangeLabel = `${range.base.slice(0, 8)}..${range.head.slice(0, 8)}`;
  const notes = [...range.notes];

  // ---- 2. list + filter files ---------------------------------------------
  const skipped: { path: string; reason: string }[] = [];
  const contexts: FileContext[] = [];
  for (const f of listChangedFiles(range)) {
    const why = shouldSkip(f, cfg, range.head);
    if (why) {
      skipped.push({ path: f.path, reason: why });
      continue;
    }
    const c = buildContext(range, f, cfg);
    if ("skipped" in c) skipped.push({ path: f.path, reason: c.skipped });
    else contexts.push(c);
  }

  // ---- 3. cap large pushes (risk-sampled) ---------------------------------
  const { selected, dropped } = applyBudget(contexts, cfg);
  skipped.push(...dropped);
  if (dropped.length) {
    notes.push(
      `Large push: reviewed ${selected.length} of ${contexts.length} eligible files (sampled by risk). Not reviewed: ${dropped
        .slice(0, 10)
        .map((d) => d.path)
        .join(", ")}${dropped.length > 10 ? ", …" : ""}`,
    );
  }

  // ---- 4. deterministic secret findings (never sent as secrets to the LLM) --
  const secretFindings: Finding[] = selected.flatMap((c) =>
    c.secrets.map((s) => ({
      file: s.file,
      line: s.line,
      severity: "blocker" as const,
      confidence: 1,
      category: "security",
      summary: `Possible hardcoded secret (${s.type}).`,
      failure_scenario: "Credential committed to git history is exposed to everyone with repo access.",
      suggested_fix: "Remove it, rotate the credential, and load it from a secret store or environment variable.",
    })),
  );

  if (dryRun) {
    console.log(`Range ${rangeLabel}\nNotes: ${notes.join(" | ") || "none"}`);
    console.log(`Selected ${selected.length}, skipped ${skipped.length}`);
    console.log(selected.map((c) => c.text).join("\n\n"));
    return;
  }

  // ---- 5. LLM review ------------------------------------------------------
  let findings: Finding[] = [];
  let summary = "";
  let usage: Report["usage"];
  if (selected.length) {
    const staticNotes = secretFindings.map((f) => `${f.file}:${f.line} ${f.summary}`).join("\n");
    const res = await reviewWithLLM(selected, cfg, staticNotes);
    usage = res.usage;
    summary = res.summary;
    if (res.refused) notes.push("The model declined to review this change; treat it as NOT reviewed.");
    findings = postProcess(res.findings, selected, cfg);
  } else {
    summary = "No reviewable source changes in this push.";
  }
  findings = [...secretFindings, ...findings];

  // ---- 6. report ----------------------------------------------------------
  const report: Report = {
    range: rangeLabel,
    findings,
    summary,
    notes,
    reviewedFiles: selected.map((c) => c.path),
    skipped,
    usage,
  };
  const md = renderMarkdown(report);
  emitActionsOutput(report, md);
  if (!process.env.GITHUB_ACTIONS) console.log(md);
  if (process.env.GITHUB_TOKEN && repo) {
    try {
      await upsertPrComment(md, repo, range.head, process.env.GITHUB_TOKEN);
    } catch (e) {
      console.log(`::warning::Could not post PR comment: ${(e as Error).message}`);
    }
  }

  const blockers = findings.filter((f) => f.severity === "blocker").length;
  if (blockers && cfg.failOn === "blocker") {
    console.error(`${blockers} blocker(s) found.`);
    process.exit(1);
  }
}

main().catch((e) => {
  // Infra failure must not silently pass the gate: fail loudly.
  console.error(`::error title=AI review failed::${e?.message ?? e}`);
  process.exit(2);
});
