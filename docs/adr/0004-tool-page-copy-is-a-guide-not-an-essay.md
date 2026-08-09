# 4. Tool page copy is a short guide, not an essay

Date: 2026-08-09
Status: Accepted

## Context

The sprint plan's indexation thesis says thin pages get crawled and then not
indexed, and the tool page template was built around that: a 40–70 word intro,
then two essay-length sections under the widget — "How it works" and "Edge cases
and gotchas", each with a 120-word floor — then a 3–6 question FAQ. The validator
enforced 400–1,800 words of body copy per page.

In practice that produced pages where someone who searched "percentage
calculator" met four paragraphs on the difference between percentage points and
percentage change before reaching anything they could act on. The owner's verdict
on reading it back was unambiguous: the tool is the product, the essay is noise,
and what is actually wanted under the widget is a short guide to using it.

## Decision

Replace `howItWorks` and `gotchas` on `ToolDef` with `howToUse: string[]` — 3–6
short imperative steps, each one action, rendered as a numbered list.

`caveats` survives but shrinks from a 120-word section to a single line, still
mandatory for any tool whose `compute` is not `browser`. A tool that ships work
to a server still owes the reader an honest sentence about what it does badly,
in the place someone who just got a mediocre result will look.

New limits in `src/lib/tools/validate.ts`:

| Rule | Before | After |
|---|---|---|
| intro | 40–70 words | 15–45 words |
| prose sections | 2 × ≥120 words | replaced by 3–6 steps of 4–35 words |
| caveats (off-browser) | ≥120 words | ≥12 words |
| FAQ answers | ≥15 words | 10–45 words |
| FAQs | 3–6 | 3–5 |
| total body copy | 400–1,800 words | 90–400 words |

The per-step 35-word ceiling is the rule that stops the essays returning one
bullet at a time. It is mutation-tested.

## Consequences

Tool pages now run roughly 160–260 words of body copy instead of 400–1,400, and
the widget sits directly above a numbered guide rather than a wall of text.

**The known risk is real and accepted.** Pages this short are harder to get
indexed, which was the entire reason for the original floor. The owner made this
call with that trade stated. If Search Console shows "Crawled — currently not
indexed" on tool URLs, the fix is better copy and stronger internal linking, not
simply more words — padding a page back to 400 words would recreate exactly what
was removed.

`pageWordsMin` is read from `LIMITS` by `registry.test.ts` rather than
hardcoded. A duplicate of the number lived in that test and was the only thing
that had to be found and changed by hand when the floor moved.

`src/components/tools/prose.tsx` is deleted — nothing renders multi-paragraph
tool copy any more.
