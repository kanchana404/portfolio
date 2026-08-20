/**
 * Getting a Cloudflare Turnstile token, without paying for it on page load.
 *
 * The script is ~70 kB and third-party, and almost nobody who opens this page
 * will actually resolve a link, so loading it in the module graph would be a
 * cost paid by everyone for the benefit of a few. It is fetched on the first
 * submit instead. That costs the first resolve a few hundred milliseconds and
 * costs every other visit nothing.
 *
 * Three things about Turnstile that the obvious implementation gets wrong:
 *
 * 1. **A token is single use.** Our download tickets are single use too, so a
 *    cached token produces a second resolve that fails verification. The widget
 *    is reset after every read, so each submit gets a fresh one.
 *
 * 2. **The script can simply never arrive.** Ad blockers and DNS filters block
 *    `challenges.cloudflare.com` routinely. Without a timeout the promise hangs
 *    and the button spins forever, which reads as "your site is broken". It
 *    fails loudly after 10 seconds instead.
 *
 * 3. **No site key is a legitimate state.** Local development and any fork of
 *    this repo have no Cloudflare account. `null` is returned rather than
 *    throwing, and the server decides what to do with that — which, in
 *    production, is refuse.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Long enough for a slow phone, short enough to not read as a hang. */
const SCRIPT_TIMEOUT_MS = 10_000;

/** Turnstile's own interactive challenge can take a while to solve. */
const SOLVE_TIMEOUT_MS = 120_000;

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: (code?: string) => void;
      "timeout-callback"?: () => void;
      appearance?: "always" | "execute" | "interaction-only";
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "flexible" | "compact";
    }
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function turnstileConfigured(): boolean {
  return SITE_KEY.length > 0;
}

export class TurnstileError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TurnstileError";
    this.code = code;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  // Cached, because a second submit must not append a second <script>.
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    const timer = window.setTimeout(() => {
      // Let a later attempt try again; a blocked network is often temporary,
      // and a permanently poisoned cache would make the tool unusable for the
      // rest of the session.
      scriptPromise = null;
      reject(
        new TurnstileError(
          "challenge_unavailable",
          "The 'are you human' check could not load. A blocker or a network filter is usually the cause."
        )
      );
    }, SCRIPT_TIMEOUT_MS);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        scriptPromise = null;
        reject(
          new TurnstileError(
            "challenge_unavailable",
            "The 'are you human' check loaded but did not start."
          )
        );
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      scriptPromise = null;
      reject(
        new TurnstileError(
          "challenge_unavailable",
          "The 'are you human' check could not load. A blocker or a network filter is usually the cause."
        )
      );
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

let widgetId: string | null = null;

/**
 * Resolves to a fresh single-use token, or to `null` when no site key is set.
 *
 * `container` is where the challenge appears if Cloudflare decides this visitor
 * has to see one. With `interaction-only` most people never do, and the element
 * stays empty — so it must be laid out to collapse rather than reserving a box
 * that is usually blank.
 */
export async function getTurnstileToken(
  container: HTMLElement
): Promise<string | null> {
  if (!turnstileConfigured()) return null;

  const turnstile = await loadScript();

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new TurnstileError(
          "challenge_timeout",
          "The 'are you human' check was not completed."
        )
      );
    }, SOLVE_TIMEOUT_MS);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    if (widgetId !== null) {
      // Reuse the rendered widget. Tokens are single use, so it has to be reset
      // before it will issue another one.
      try {
        turnstile.remove(widgetId);
      } catch {
        // Already gone; rendering a fresh one below is the recovery.
      }
      widgetId = null;
    }

    try {
      widgetId = turnstile.render(container, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        theme: "auto",
        size: "flexible",
        callback: (token: string) => finish(() => resolve(token)),
        "error-callback": (code?: string) =>
          finish(() =>
            reject(
              new TurnstileError(
                "challenge_failed",
                code
                  ? `The 'are you human' check failed (${code}).`
                  : "The 'are you human' check failed."
              )
            )
          ),
        "timeout-callback": () =>
          finish(() =>
            reject(
              new TurnstileError(
                "challenge_timeout",
                "The 'are you human' check expired before it was completed."
              )
            )
          ),
      });
    } catch (error) {
      finish(() =>
        reject(
          new TurnstileError(
            "challenge_failed",
            error instanceof Error ? error.message : "The check could not start."
          )
        )
      );
    }
  });
}
