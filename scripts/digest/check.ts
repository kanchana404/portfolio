/**
 * `pnpm digest:check [--allow-todo] [--images-pending] [--scope]`
 *
 * Runs the publish gate (src/lib/blog/validate.ts) over content/blog,
 * public/blog and content/inbox, and prints every issue as
 * `file:line  rule  message`. The weekly digest's drafting step uses it:
 *
 * - `--allow-todo`: `**My take:** TODO` lines do not fail the check. They are
 *   the owner's to write. Every other issue, and any other TODO, still does.
 * - `--images-pending`: an image a post names that is not in public/blog yet
 *   does not fail the check (the owner uploads it to the pull request).
 * - `--scope`: also fails when a file outside content/blog, public/blog and
 *   content/inbox changed, committed on this branch since it left main or
 *   not committed yet. A digest task must not touch anything else. With no
 *   main or origin/main to compare with (a checkout Codex Cloud has not been
 *   verified to provide), it checks the uncommitted files only and says so:
 *   the drafting step commits nothing, and the pull request diff is reviewed.
 *
 * When `.digest/candidates.json` exists, every link in the digest it names
 * must also be one of its items' urls, exactly.
 *
 * With no flags it is as strict as `pnpm test`, which CI and Vercel run.
 * Exit 0 when nothing blocks, 1 otherwise. No network.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { todayUtc } from "../../src/lib/blog/dates";
import { readContentSnapshot } from "../../src/lib/blog/posts";
import { formatIssue, validateCollection, type Issue } from "../../src/lib/blog/validate";
import { changedPaths, classifyIssues, offCandidateLinks, outsideScope, readCandidates } from "../../src/lib/feeds/digest-check";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CANDIDATES = join(root, ".digest/candidates.json");

const FLAGS = ["--allow-todo", "--images-pending", "--scope"];

const git = (args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });

/**
 * The commit this branch left main at: the merge base with origin/main or
 * main, the later of the two when both exist. Null when neither exists.
 */
function branchBase(): string | null {
  const bases: string[] = [];
  for (const ref of ["origin/main", "main"]) {
    try {
      bases.push(git(["merge-base", "HEAD", ref]).trim());
    } catch {
      // No such ref here.
    }
  }
  if (bases.length < 2 || bases[0] === bases[1]) return bases[0] ?? null;
  try {
    git(["merge-base", "--is-ancestor", bases[0], bases[1]]);
    return bases[1];
  } catch {
    return bases[0];
  }
}

/**
 * Files changed outside the digest's scope. `uncommittedOnly` is true when
 * there was no main to compare with, so only the working tree was checked.
 */
function strayFiles(): { stray: string[]; uncommittedOnly: boolean } {
  const base = branchBase();
  const committed = base === null ? "" : git(["diff", "--name-only", "-z", "--no-renames", base, "HEAD"]);
  const status = git(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"]);
  return { stray: outsideScope(changedPaths(committed, status)), uncommittedOnly: base === null };
}

/** The candidates check's issues, or one issue saying why the file cannot be used. */
function candidateIssues(posts: Parameters<typeof offCandidateLinks>[0]): Issue[] {
  if (!existsSync(CANDIDATES)) return [];
  let candidates: ReturnType<typeof readCandidates>;
  try {
    candidates = readCandidates(JSON.parse(readFileSync(CANDIDATES, "utf8")));
  } catch {
    candidates = ".digest/candidates.json cannot be read; run pnpm digest:fetch again";
  }
  if (typeof candidates === "string") return [{ file: ".digest/candidates.json", rule: "link", message: candidates }];
  return offCandidateLinks(posts, candidates);
}

function main(): number {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const unknown = args.filter((a) => !FLAGS.includes(a));
  if (unknown.length > 0) {
    console.error(`digest:check: unknown argument ${unknown.join(" ")}\nusage: pnpm digest:check [${FLAGS.join("] [")}]`);
    return 1;
  }
  const allowTodo = args.includes("--allow-todo");
  const imagesPending = args.includes("--images-pending");
  const scope = args.includes("--scope");

  const snapshot = readContentSnapshot(root);
  const { posts, issues } = validateCollection(snapshot, todayUtc());
  const { blocking, takes, pendingImages } = classifyIssues(issues, snapshot);

  const failures = [...blocking, ...candidateIssues(posts)];
  if (!allowTodo) failures.push(...takes);
  if (!imagesPending) failures.push(...pendingImages);
  failures.sort((a, b) => (a.file !== b.file ? (a.file < b.file ? -1 : 1) : (a.line ?? 0) - (b.line ?? 0)));

  let stray: string[] = [];
  let noBase = false;
  if (scope) {
    ({ stray, uncommittedOnly: noBase } = strayFiles());
  }

  for (const issue of failures) console.error(formatIssue(issue));
  if (!allowTodo && takes.length > 0) {
    console.error(
      `\n${takes.length} take(s) still say TODO. The owner writes them; paste the owner's words verbatim after **My take:**.`
    );
  }
  for (const path of stray) console.error(`${path}  scope  a digest task changes only content/blog, public/blog and content/inbox`);
  const notes: string[] = [];
  if (noBase) {
    notes.push("no main or origin/main here, so --scope checked uncommitted files only; commit nothing before the pull request");
  }
  if (allowTodo && takes.length > 0) {
    notes.push(`${takes.length} take(s) still TODO, allowed while drafting: ${takes.map((t) => `${t.file}:${t.line}`).join(", ")}`);
  }
  if (imagesPending && pendingImages.length > 0) {
    notes.push(`${pendingImages.length} image(s) waiting for an upload: ${pendingImages.map((i) => i.message.split(" ")[0]).join(", ")}`);
  }
  for (const note of notes) console.log(`digest:check  note  ${note}`);

  const failed = failures.length > 0 || stray.length > 0;
  console.log(
    `digest:check  ${failed ? "FAIL" : "ok"}  ${posts.length} post(s), ${failures.length} blocking issue(s)` +
      (scope ? `, ${stray.length} file(s) out of scope${noBase ? " (uncommitted only)" : ""}` : "")
  );
  return failed ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`digest:check: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
