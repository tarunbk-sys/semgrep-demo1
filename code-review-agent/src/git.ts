import { execFileSync } from "node:child_process";

export const ZERO_SHA = /^0+$/;

let cwd = process.env.REVIEW_REPO_DIR ?? process.cwd();
export function setRepoDir(dir: string) {
  cwd = dir;
}

export function git(args: string[], opts: { allowFail?: boolean } = {}): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    if (opts.allowFail) return "";
    throw e;
  }
}

function ok(args: string[]): boolean {
  try {
    execFileSync("git", args, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface Range {
  base: string;
  head: string;
  notes: string[]; // human-readable warnings surfaced in the report
}

/**
 * Resolves the commit range to review, handling:
 *  - new branches (before = 000...)
 *  - force pushes (before no longer exists, or is not an ancestor of after)
 */
export function resolveRange(opts: {
  before?: string;
  after: string;
  defaultBranch: string;
}): Range | null {
  const { before, after, defaultBranch } = opts;
  const notes: string[] = [];
  if (ZERO_SHA.test(after)) return null; // branch deleted

  const fallbackBase = (): string | null => {
    for (const ref of [`origin/${defaultBranch}`, defaultBranch]) {
      const mb = git(["merge-base", ref, after], { allowFail: true }).trim();
      if (mb) return mb;
    }
    return null;
  };

  if (!before || ZERO_SHA.test(before)) {
    const base = fallbackBase();
    if (!base) {
      notes.push("New branch with no common history with the default branch; reviewing only the head commit.");
      return { base: `${after}~1`, head: after, notes };
    }
    notes.push(`New branch: reviewing against merge-base with ${defaultBranch}.`);
    return { base, head: after, notes };
  }

  const exists = ok(["cat-file", "-e", `${before}^{commit}`]);
  const isAncestor = exists && ok(["merge-base", "--is-ancestor", before, after]);
  if (!exists || !isAncestor) {
    const base = fallbackBase();
    notes.push(
      exists
        ? "Force-push (history rewritten) detected: reviewing against merge-base with the default branch."
        : "Force-push detected and the previous commit no longer exists: reviewing against merge-base with the default branch.",
    );
    if (!base) {
      notes.push("Could not find a merge-base; reviewing only the head commit.");
      return { base: `${after}~1`, head: after, notes };
    }
    return { base, head: after, notes };
  }
  return { base: before, head: after, notes };
}

export interface ChangedFile {
  path: string;
  status: string; // A, M, R, ...
  binary: boolean;
  added: number;
  deleted: number;
}

export function listChangedFiles(r: Range): ChangedFile[] {
  const nameStatus = git(["diff", "--name-status", "-z", "--diff-filter=AMRC", r.base, r.head]).split("\0");
  const numstat = git(["diff", "--numstat", "-z", "--diff-filter=AMRC", r.base, r.head]);
  const stats = new Map<string, { added: number; deleted: number; binary: boolean }>();
  // numstat -z: "<a>\t<d>\t<path>\0" or for renames "<a>\t<d>\t\0<old>\0<new>\0"
  const parts = numstat.split("\0");
  for (let i = 0; i < parts.length; i++) {
    const m = /^(\S+)\t(\S+)\t(.*)$/.exec(parts[i]);
    if (!m) continue;
    let p = m[3];
    if (p === "") {
      p = parts[i + 2] ?? "";
      i += 2;
    }
    const binary = m[1] === "-";
    stats.set(p, { added: binary ? 0 : +m[1], deleted: binary ? 0 : +m[2], binary });
  }
  const out: ChangedFile[] = [];
  for (let i = 0; i < nameStatus.length; ) {
    const status = nameStatus[i++];
    if (!status) continue;
    const isRename = status[0] === "R" || status[0] === "C";
    if (isRename) i++; // skip old path
    const p = nameStatus[i++];
    if (!p) continue;
    const s = stats.get(p) ?? { added: 0, deleted: 0, binary: false };
    out.push({ path: p, status: status[0], ...s });
  }
  return out;
}

/** New-side line ranges of each hunk for a file, using -U0. */
export function changedRanges(r: Range, file: string): { start: number; end: number }[] {
  const d = git(["diff", "-U0", "--no-color", r.base, r.head, "--", file]);
  const ranges: { start: number; end: number }[] = [];
  for (const m of d.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = +m[1];
    const count = m[2] === undefined ? 1 : +m[2];
    ranges.push({ start, end: count === 0 ? start : start + count - 1, ...(count === 0 ? { pureDeletion: true } : {}) });
  }
  return ranges;
}

export function fileAt(rev: string, file: string): string | null {
  try {
    return git(["show", `${rev}:${file}`]);
  } catch {
    return null;
  }
}
