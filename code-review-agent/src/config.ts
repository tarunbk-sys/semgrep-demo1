import fs from "node:fs";
import path from "node:path";

export interface Config {
  model: string;
  maxFiles: number;
  maxChangedLines: number;
  maxInputTokens: number;
  minConfidence: number;
  maxComments: number;
  failOn: "blocker" | "never";
  ignore: string[];
  highRisk: string[];
}

export const DEFAULT_IGNORE = [
  // lockfiles
  "**/package-lock.json", "**/yarn.lock", "**/pnpm-lock.yaml", "**/poetry.lock",
  "**/Pipfile.lock", "**/go.sum", "**/Cargo.lock", "**/Gemfile.lock", "**/composer.lock",
  // vendored / build output
  "**/vendor/**", "**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**",
  "**/*.min.js", "**/*.min.css", "**/*.map",
  // generated
  "**/*.pb.go", "**/*_pb2.py", "**/*_generated.*", "**/__generated__/**", "**/*.snap",
  // binaries / assets
  "**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.gif", "**/*.ico", "**/*.pdf", "**/*.zip",
  "**/*.jar", "**/*.woff", "**/*.woff2", "**/*.ttf", "**/*.mp4", "**/*.svg",
];

export const DEFAULT_HIGH_RISK = [
  "**/auth/**", "**/*auth*", "**/*payment*", "**/*billing*", "**/*crypto*",
  "**/*security*", "**/*.sql", "**/migrations/**", "**/*controller*", "**/*handler*",
  "**/*route*", "**/Dockerfile", "**/*.tf", "**/*.yml", "**/*.yaml",
];

const DEFAULTS: Config = {
  model: "claude-opus-5-5",
  maxFiles: 40,
  maxChangedLines: 3000,
  maxInputTokens: 60_000,
  minConfidence: 0.7,
  maxComments: 10,
  failOn: "blocker",
  ignore: DEFAULT_IGNORE,
  highRisk: DEFAULT_HIGH_RISK,
};

/** Loads `.codereview.json` from the reviewed repo (optional) and merges over defaults. */
export function loadConfig(repoDir: string): Config {
  const file = path.join(repoDir, ".codereview.json");
  if (!fs.existsSync(file)) return DEFAULTS;
  const user = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Config> & {
    extraIgnore?: string[];
  };
  return {
    ...DEFAULTS,
    ...user,
    ignore: [...DEFAULT_IGNORE, ...(user.extraIgnore ?? [])],
  };
}

/** Minimal glob -> RegExp (supports **, *, ?). */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

export function matchesAny(file: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(file));
}
