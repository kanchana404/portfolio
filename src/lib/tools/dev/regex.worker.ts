/**
 * Runs the match, so the main thread cannot be frozen by one.
 *
 * A JavaScript regex cannot be interrupted. There is no timeout argument and no
 * cooperative yield, so once `exec` starts backtracking through an exponential
 * search the only thing that stops it is killing the thread it is on. That is
 * the whole reason this file exists: `worker.terminate()` is the timeout.
 *
 * Everything else about the tool would work fine inline. This one property does
 * not, and it is the difference between a slow answer and a tab the reader has
 * to force-quit.
 */

import { type Match, runMatch } from "./regex";

export interface MatchRequest {
  pattern: string;
  flags: string;
  input: string;
  limit: number;
}

export type MatchResponse =
  | { ok: true; matches: Match[] }
  | { ok: false; message: string };

const post = self.postMessage as (message: MatchResponse) => void;

self.onmessage = (event: MessageEvent<MatchRequest>) => {
  const { pattern, flags, input, limit } = event.data;
  try {
    post({ ok: true, matches: runMatch(pattern, flags, input, limit) });
  } catch (error) {
    post({
      ok: false,
      message: error instanceof Error ? error.message : "That pattern failed to run.",
    });
  }
};
