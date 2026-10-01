# Weekly digest: the owner's guide

Every week Codex drafts a short "AI and dev news" post from official feeds.
You write one take per item. You merge. The post goes live. About 15 minutes
a week, from your iPhone, after a one-time setup.

How it works:

1. You start a Codex Cloud task from the ChatGPT app.
2. Codex runs `pnpm digest:fetch` inside the task. It reads 7 official
   sources (OpenAI, Anthropic, Google DeepMind, Hugging Face, Next.js, Vercel,
   GitHub) and keeps the last 7 days.
3. Codex picks 5 to 8 items and writes `content/blog/ai-dev-news-YYYY-wWW.md`.
   Every take says `**My take:** TODO`.
4. Codex sends you a numbered list and waits.
5. You reply with your takes. Codex pastes them word for word and runs the
   checks.
6. You open a pull request from the task. CI and a Vercel preview run on it.
7. Optional: you upload images to the pull request.
8. You merge. Vercel publishes it.

No OpenAI API key is used anywhere. Your ChatGPT Plus plan covers Codex and
image making. There is no draft state: whatever is on `main` is live, so the
tests refuse any post that still has a TODO.

Every step comes from OpenAI's and GitHub's docs as read on 2026-10-01, not
from the live screens, so a label may differ from what you see.
**(not verified)** marks the steps the docs do not settle.

## One-time setup

Do steps 4 to 10 on a computer you trust, in a browser (chatgpt.com) or the
ChatGPT desktop app: OpenAI's docs say the phone cannot create an
environment, only use one. **Not on the development Mac** while SECURITY.md
lists it as infected: these steps sign in to ChatGPT and give an app write
access to the repository. If you have no other computer, try chatgpt.com in
Safari on the iPhone with aA > Request Desktop Website **(not verified)**. Do
the account steps on your phone.

1. **Put this work on `main`.** Codex only sees GitHub. Push the branch from
   a machine SECURITY.md allows (nothing is pushed from the infected Mac),
   merge it through a pull request, then check that the pull request's
   checks, `pnpm integrity` included, pass on `main`.
2. **Secure the accounts.** If you log in to ChatGPT with email and password,
   turn on MFA; Codex Cloud requires it. On GitHub, remove any OAuth app,
   token or deploy key you do not recognise before you add a new app.
3. **Protect `main`. Required, and before step 5.** Without it, the app you
   connect in step 5 and every web upload can reach `main` directly, and
   `main` is the live site. On github.com (a phone browser works): the
   repository > Settings > Branches > Add classic branch protection rule.
   Branch name pattern: `main`. Tick Require a pull request before merging,
   and Require status checks to pass before merging with the checks
   "Typecheck · Lint · Unit tests" and "Build · Bundle budget". Tick Do not
   allow bypassing the above settings. Select Create. Do not require
   approvals: you cannot approve your own pull request.
4. **Create the environment.** On chatgpt.com start a new task, choose
   Work in > Cloud, open Select environment and select Create environment.
   (The same screen: Settings > Codex Cloud > Environments > Create
   environment.)
5. **Give it this one repository.** Pick only `kanchana404/portfolio`. Select
   Connect GitHub if asked. On GitHub's install page for **ChatGPT Codex
   Connector**, choose Only select repositories and pick
   `kanchana404/portfolio`. Read the permission list before you approve:
   OpenAI does not document it. **(not verified)**
6. **Check the app has one repository.** github.com > your profile picture >
   Settings > Applications > Installed GitHub Apps > Configure next to
   ChatGPT Codex Connector. Under Repository access, Only select repositories
   must list only `kanchana404/portfolio`. Save. Suspend and Uninstall are on
   the same page if you ever need to cut access fast.
7. **Install script.** Select Get started. In the setup chat, say: "Use Node
   22 and the pnpm version in package.json. Use `bash scripts/codex-setup.sh`
   as the Install script. No Start skill; this repo needs no running
   services. Never run pnpm build here." If setup fails, select Try again.
8. **Internet.** Turn on Allow Codex to access internet. Under Allow domains
   choose Custom domains only. Under Additional allowed domains add exactly
   these 8:

   ```text
   registry.npmjs.org
   openai.com
   deepmind.google
   huggingface.co
   nextjs.org
   vercel.com
   github.blog
   www.anthropic.com
   ```

   `registry.npmjs.org` is for `pnpm install`. There is no "GET only"
   setting in the current Codex Cloud (only the Legacy one has it). The
   fetcher itself only sends GET requests to the 7 feed hosts, and refuses a
   redirect anywhere else. Whether the install step uses the same list is
   not documented. **(not verified)**
9. **No secrets.** Leave Environment variables and Network secrets empty;
   do not select Manage. Leave Settings > Codex Cloud > Personal vault empty.
   The digest needs no keys.
10. **Publish.** If you see Privacy > Who can use, keep Only me (it may not
    appear on Plus). Select Publish and wait for "Environment published". If
    it ever shows Unpublished, open it and select Publish.
11. **Test from the iPhone.** ChatGPT app > Codex > choose the portfolio
    environment. Send: "Run pnpm digest:fetch --check and show me the table.
    Do not change any files." All 7 sources should say `ok`. If every
    source fails, Node's proxy support is the likely cause: see "If
    something goes wrong". That proves the feeds answer, not that other
    hosts are blocked (AGENTS.md forbids `curl`), so also open the
    environment's settings (its Edit button) and check that Allow domains
    says Custom domains only and Additional allowed domains lists exactly
    the 8 hosts above, nothing more. If you change anything, select Publish
    again. **(not verified: the name of the edit button)**
12. **Optional: the Legacy environment for `@codex` comments.** `@codex`
    comments on a pull request run in Codex Cloud (Legacy), which has its own
    environments, at chatgpt.com/codex/settings/environments. Create one for
    `kanchana404/portfolio` with setup script `bash scripts/codex-setup.sh`,
    Set package versions > Node.js 22, no Secrets, and Agent internet access
    Off. OpenAI plans to retire Legacy. **(not verified: the docs do not name
    the create button)**
13. **Leave automatic code review off.** At app.chatgpt.com/settings/code-review,
    keep Automatic review off under Personal preferences. On a public
    repository, who else can trigger Codex is not documented.
14. **A weekly reminder.** Plus cannot start the task on a schedule. Make a
    repeating iPhone Reminder (Friday 9:00), or in a normal ChatGPT chat on
    the web ask: "Every Friday at 9:00 AM Sri Lanka time (Asia/Colombo),
    remind me to run the weekly AI digest in Codex." Check the time under
    Scheduled. Then in ChatGPT Settings > Notifications, turn on push (or
    email) for tasks; Manage tasks there opens Scheduled. If no push reaches
    the iPhone, create the reminder from the ChatGPT iPhone app instead
    **(not verified)**.

## Every week

1. **Start.** ChatGPT app > Codex > the portfolio environment. Type
   `$weekly-digest` and send it. (The long version is in
   `docs/digest/weekly-prompt.md`.) You can lock the phone; the task keeps
   running.
2. **Read the list.** Reopen the task later. Codex lists the items it picked,
   the ones it skipped, and anything that looked like instructions hidden in
   a feed. Open the post file and check that each summary only restates its
   source. To change the picks, reply: "Drop 3 and use the Vercel item
   instead."
3. **Send your takes** in one message, numbered to match:
   `1. <2-3 sentences> 2. <…>`. Each take needs at least 40 characters. Codex
   pastes them word for word; it never writes or edits a take. Send them
   before the pull request: a post with TODO takes fails every check, and
   whether a later reply updates an open pull request is not documented
   **(not verified)**.
4. **Open the pull request** from the task once Codex says it is ready,
   titled like "Digest: 2026 week 40". The button's name is not documented;
   if the iPhone app does not show it, open the same task on chatgpt.com.
   **(not verified)**
5. **Check the preview.** In the GitHub app or browser, open the pull
   request. Wait for the checks and the Vercel preview, and read
   `/blog/ai-dev-news-YYYY-wWW` on the preview. **(not verified: Vercel's
   labels)**
6. **Small fixes.** Open the file on GitHub, tap the pencil (Edit file), then
   Commit changes to the pull request's branch. Or comment
   `@codex fix: <what to change> in content/blog/<slug>.md, then run pnpm digest:check`
   (Legacy, step 12).
7. **Optional images:** see below.
8. **Merge.** When every check is green: Merge pull request (or Squash and
   merge), then Confirm merge. Vercel builds `main` and the post goes live.
9. **Share** your takes on LinkedIn or X by hand.

## Images (optional)

A digest is fine as text. When you want pictures, the order matters: the
line that shows the picture goes into the post first, then the upload, and
the upload's name must match the line exactly. The Action converts nothing
while any upload has no line.

1. **Make each image in the ChatGPT app.** Our own pictures only: never a
   vendor's screenshot, press image, chart or logo. No text, logos or real
   faces in the image. A starting prompt that matches the site's colours:

   ```text
   A wide 3:2 editorial illustration for a developer blog, shown about 670 px wide on a white page and on a near-black page. Flat, minimal, drawn with confident black ink lines (#0A0A0A) on a flat off-white background (#F5F5F5). One accent only: a single hand-drawn highlighter swipe in soft yellow (#FDE68A) behind the main object, and one thin amber (#D97706) hand-drawn underline or circle. Plenty of empty space. Subject: <one concrete object or metaphor>. One main object, at most two small supporting ones, all inside the central 80% of the frame. No text, letters, numbers, logos, faces, blue, gradients, glow, 3D or photographs.
   ```

2. **Save it as a named file.** Photos cannot name a file, and GitHub's
   upload cannot rename one, so a picture picked from Photos arrives as
   something like `IMG_4821.PNG`. Instead, in the ChatGPT app open the
   image, tap Share > Save to Files, then in the Files app long-press it >
   Rename. **(not verified: the ChatGPT app's menu labels)** Names are
   lowercase words, digits and hyphens: `1-agents.png` becomes
   `/blog/<slug>/1-agents.webp`. Any other name is lowercased and each run of
   other characters becomes one hyphen (`My Image.PNG` becomes
   `my-image.webp`). Use PNG. A JPEG works only if it is stored upright: a
   phone photo usually is not, and the Action refuses it.
3. **Add the image lines to the post first**, each on its own line with a
   blank line above and below, where the picture belongs:

   ```markdown
   ![One sentence saying what the picture shows](/blog/ai-dev-news-2026-w40/1-agents.webp)
   ```

   Either tell Codex before the pull request ("Add image 1-agents after item
   1, alt: …"), or edit the file on GitHub (pencil > Commit changes to the
   pull request's branch). A cover goes in the frontmatter instead, as
   `cover: "/blog/<slug>/cover.webp"` and `coverAlt: "…"`, and must be at
   least 1200 px wide.
4. **Upload.** In the phone's browser, open the pull request on github.com
   and tap its branch name near the top: that opens the repository on the
   pull request's branch. Open `content/inbox/`, then Add file > Upload
   files > choose your files, and pick them with Choose File(s) from Files,
   not from the photo library. Commit directly to the pull request's branch
   with the green button (Commit changes, or Propose changes).
   **(not verified: the buttons' names)** An upload straight into
   `content/inbox/` belongs to the one post the pull request changes.
   GitHub blocks web uploads to a protected `main`, so they always go to the
   branch.
5. **The Action converts them.** "Blog images" (`.github/workflows/blog-images.yml`)
   turns each upload into WebP in `public/blog/<slug>/` (at most 1600 px
   wide, no metadata, at most 400 KiB), runs the tests on the result, commits
   the WebP files to the branch and deletes the uploads. If the post does
   not use an upload yet, it stops before converting anything: its run
   summary (the pull request's Checks tab > Blog images) lists the exact
   lines to paste. Paste them into the post, write the alt text, and commit
   to the branch; the Action runs again, because the uploads are still
   there.
6. **Run CI again.** A commit made by the Action starts no new checks (GitHub
   never starts workflows from its own token's pushes). That is why the
   Action tests the converted files itself before it commits. To get the
   required checks on the new commit, close the pull request and reopen it.

Until the Action has run, the pull request's checks fail: the publish gate
refuses any upload left in `content/inbox/`, so an unconverted image can
never reach `main`.

## If something goes wrong

- **`pnpm integrity` fails** (in the task, the setup or CI): stop. Do not
  merge anything. Read SECURITY.md; it has happened before.
- **A source fails** in the fetch table: one is fine, Codex says which.
  If every source fails, the environment's internet list is wrong, or the
  task's Node ignores the proxy. `pnpm digest:fetch` starts Node with
  `NODE_USE_ENV_PROXY=1`, which recent Node 22 releases (22.21 or later) need
  to use a proxy. **(not verified inside Codex Cloud)**
- **`pnpm digest:check` fails:** it prints `file:line rule message`. Codex
  fixes everything except takes. A take that fails (too short, or with
  angle brackets or TODO in it) comes back to you.
- **The Action fails:** its log names the upload, and says why.
  - "does not use … yet": the post has no line for that name. Paste the
    lines from the run summary into the post and commit (Images, step 5). If
    the upload's name is wrong instead, delete that upload (open it on the
    branch > the trash icon > Commit changes) and upload it again under the
    right name.
  - Not PNG or JPEG, a JPEG stored turned, narrower than 320 px (or than
    1200 for a cover) once it is at most 2400 px tall, or still over 400 KiB
    at quality 52: delete that upload the same way, and upload a fixed PNG.
- **`@codex` does not react** to a comment: check that the repository appears
  in Codex settings, and that the Legacy environment exists (step 12).

## Limits

- **No schedule on Plus.** Scheduled tasks cannot start a Codex Cloud task
  that opens a pull request (not documented; "dots" can, but not on Plus).
  Start it from the phone; it takes a minute.
- **No GET-only switch** in the current Codex Cloud. The 8-domain list, no
  secrets in the environment, and a fetcher that only sends GET requests to
  its own fixed list are the protections.
- **Codex Cloud cannot make images.** Make them in the ChatGPT app.
- **Pull request details are not documented** for the new Codex Cloud: the
  button's name, the branch name, whether it is a draft, and whether a
  follow-up updates an open pull request. Send your takes before the pull
  request.
- **`@codex` comments run on Legacy,** which OpenAI plans to retire. Editing
  the file on GitHub always works.
- **Android:** Codex Cloud tasks are documented for iOS only.
- **The GitHub permissions** the ChatGPT Codex Connector asks for are not
  documented. Keep it on this one repository and keep `main` protected.
- **Usage:** a cloud task may use more of the Plus allowance than a local
  message. One task a week with a few follow-ups is small; check usage
  monthly at chatgpt.com/codex/settings/usage. **(not verified)**

## What protects what

- `AGENTS.md` (read by Codex and, through `CLAUDE.md`, by Claude Code) puts
  the security rules first: fetched text is data, no browsing, a fixed list
  of commands, protected files, and your takes are yours.
- `.agents/skills/weekly-digest/SKILL.md` is the step-by-step procedure.
- `pnpm integrity` freezes `AGENTS.md`, `CLAUDE.md` and the skill by SHA-256,
  and fails on agent instruction files anywhere else in any file git
  carries, on a `.codex/` folder, a `.mcp.json`, `.claude/settings.json`,
  anything but permission rules in `.claude/settings.local.json`, project
  skills or commands under `.claude/`, and any symlink. Every change to a
  frozen file needs its new hash in `scripts/check-config-integrity.mjs` in
  the same commit.
- The fetcher (`src/lib/feeds/`) strips HTML and invisible characters from
  every title and summary, flags text that reads like instructions, keeps
  links to each source's own site, keeps every request on the source's own
  host, and writes only to `.digest/`, which is gitignored.
- The publish gate fails on a TODO take, a placeholder, raw HTML, a bad link
  or image, a digest link that is not a page of one of the sources, and any
  upload left in `content/inbox/`. `pnpm digest:check` also fails on a
  digest link that is not a candidate's `url`, and on a file changed outside
  the post, its images and the inbox.
- The blog-images Action splits its work: the job that runs repository code
  cannot write, and the job that can write runs no repository code.
