/**
 * The names and numbers both sides of the wire have to agree on.
 *
 * Separate from `ticket.ts` for one concrete reason: that module imports
 * `node:crypto`, and the browser client needs these constants. Importing them
 * from there would pull the Node crypto polyfill into a client bundle for the
 * sake of two string literals, and the failure mode is a build that silently
 * grows rather than one that breaks.
 *
 * Every value here has a counterpart in the Python service. Changing one
 * without the other produces a 401 with nothing in it that says why.
 */

/** Matches TICKET_AUDIENCE in app/security/tickets.py. */
export const TICKET_AUDIENCE = "downloader";

/** Matches TICKET_TTL_S in app/security/tickets.py. */
export const TICKET_TTL_S = 120;

/** Matches TICKET_HEADER in app/security/tickets.py. */
export const TICKET_HEADER = "X-Download-Ticket";

/** Matches TURNSTILE_HEADER in app/routes/jobs.py. */
export const TURNSTILE_HEADER = "X-Turnstile-Token";
