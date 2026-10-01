import { MISSING_IMAGE, bodyLinks, type ContentSnapshot, type Issue, type Post } from "../blog/validate";

/**
 * The logic behind `pnpm digest:check`: the publish gate's issues sorted into
 * what blocks always and what may wait while a digest is being drafted.
 *
 * - `takes`: a `**My take:** TODO` line. The owner writes those; with
 *   `--allow-todo` they do not fail the check. Any other TODO still does.
 * - `pendingImages`: an image a post names that is not in public/blog yet,
 *   because the owner has still to upload it. Only with `--images-pending`
 *   do they not fail the check.
 *
 * Also the scope check's git parsing, and the check that this week's digest
 * links only the candidates' own urls.
 *
 * `pnpm test` stays strict either way: it is what CI and Vercel run.
 *
 * Pure; the tsx CLI loads it without the `@/` alias.
 */

export const TODO_TAKE = "**My take:** TODO";

/** Where a digest task may change files: the post, its images, and uploads. */
export const SCOPE_PREFIXES = ["content/blog/", "public/blog/", "content/inbox/"];

export interface Classified {
  blocking: Issue[];
  takes: Issue[];
  pendingImages: Issue[];
}

export function classifyIssues(issues: readonly Issue[], snapshot: ContentSnapshot): Classified {
  const lines = new Map(snapshot.postFiles.map((f) => [`content/blog/${f.name}`, f.source.split("\n")]));
  const out: Classified = { blocking: [], takes: [], pendingImages: [] };
  for (const issue of issues) {
    const text = issue.line === undefined ? undefined : lines.get(issue.file)?.[issue.line - 1];
    if (issue.rule === "todo" && text?.trimEnd() === TODO_TAKE) {
      out.takes.push(issue);
      continue;
    }
    const slug = /^content\/blog\/([^/]+)\.md$/.exec(issue.file)?.[1];
    if (
      issue.rule === "image" &&
      slug !== undefined &&
      issue.message.startsWith(`public/blog/${slug}/`) &&
      issue.message.endsWith(MISSING_IMAGE)
    ) {
      out.pendingImages.push(issue);
      continue;
    }
    out.blocking.push(issue);
  }
  return out;
}

/**
 * Paths from `git status --porcelain=v1 -z --untracked-files=all`: entries
 * end in NUL, each `XY path`; a rename or copy is followed by an entry that
 * holds only the original path.
 */
export function parseStatusZ(output: string): string[] {
  const fields = output.split("\0");
  const paths: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    if (entry.length < 4) continue;
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (status.includes("R") || status.includes("C")) {
      const from = fields[i + 1];
      if (from) paths.push(from);
      i++;
    }
  }
  return paths;
}

/** Paths from `git diff --name-only -z --no-renames`: each ends in NUL. */
export function parseNamesZ(output: string): string[] {
  return output.split("\0").filter((path) => path !== "");
}

/**
 * Every path a digest task changed: what the branch committed since it left
 * main (`git diff --name-only -z --no-renames <base> HEAD`), and what is not
 * committed yet (`git status --porcelain=v1 -z`). The committed half matters
 * to a follow-up task that starts from the pull request's branch, and to an
 * agent that commits before it checks.
 */
export function changedPaths(committedZ: string, statusZ: string): string[] {
  return [...new Set([...parseNamesZ(committedZ), ...parseStatusZ(statusZ)])].sort();
}

export function outsideScope(paths: readonly string[]): string[] {
  return [...new Set(paths)].filter((p) => !SCOPE_PREFIXES.some((prefix) => p.startsWith(prefix))).sort();
}

export interface Candidates {
  /** `content/blog/<slug>.md`, this week's digest. */
  postPath: string;
  urls: ReadonlySet<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What the check needs from `.digest/candidates.json`, or why it cannot be used. */
export function readCandidates(json: unknown): Candidates | string {
  const broken = ".digest/candidates.json is not what pnpm digest:fetch writes; run pnpm digest:fetch again";
  if (!isRecord(json) || typeof json.postPath !== "string" || !Array.isArray(json.items)) return broken;
  const urls = new Set<string>();
  for (const item of json.items) {
    if (!isRecord(item) || typeof item.url !== "string") return broken;
    urls.add(item.url);
  }
  return { postPath: json.postPath, urls };
}

/**
 * Links in this week's digest (the post at `postPath`) that are not the url
 * of a candidate, exactly. The publish gate already keeps a digest's links on
 * the sources' sites; this also refuses a page on those sites that no feed
 * listed, such as an address a summary mentioned.
 */
export function offCandidateLinks(posts: readonly Post[], candidates: Candidates): Issue[] {
  const post = posts.find((p) => p.file === candidates.postPath);
  if (!post) return [];
  return bodyLinks(post.body, post.bodyLine)
    .filter(({ target }) => !(target.startsWith("#") || (target.startsWith("/") && !target.startsWith("//"))))
    .filter(({ target }) => !candidates.urls.has(target))
    .map(({ line, target }) => ({
      file: post.file,
      line,
      rule: "link" as const,
      message: `${target} is not the url of any item in .digest/candidates.json; link each item with its url exactly as given`,
    }));
}
