/**
 * Unix file permissions, octal and symbolic.
 *
 * The arithmetic is three bits per class and is not the interesting part. What
 * is worth encoding is the fourth digit almost every calculator omits, and the
 * two facts about it that surprise people:
 *
 * - **setuid on a shell script does nothing on Linux.** The kernel ignores it
 *   for interpreted files, deliberately, because honouring it would be a
 *   trivially exploitable race between reading the shebang and running it.
 *   People set it, see no error, and assume it worked.
 * - **The sticky bit means two different things.** On a directory it stops one
 *   user deleting another's files, which is why /tmp is 1777. On a file it is a
 *   historical no-op on Linux.
 *
 * And the one that matters most: **777 is not "make it work"**, it is
 * world-writable, which lets any account on the machine replace the file. It is
 * the most common bad advice in any deployment thread, so the tool says so.
 */

export interface PermissionSet {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface Permissions {
  owner: PermissionSet;
  group: PermissionSet;
  other: PermissionSet;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

const EMPTY: PermissionSet = { read: false, write: false, execute: false };

export const DEFAULT_PERMISSIONS: Permissions = {
  owner: { read: true, write: true, execute: false },
  group: { read: true, write: false, execute: false },
  other: { read: true, write: false, execute: false },
  setuid: false,
  setgid: false,
  sticky: false,
};

function digit(set: PermissionSet): number {
  return (set.read ? 4 : 0) + (set.write ? 2 : 0) + (set.execute ? 1 : 0);
}

function fromDigit(n: number): PermissionSet {
  return { read: (n & 4) !== 0, write: (n & 2) !== 0, execute: (n & 1) !== 0 };
}

export function toOctal(p: Permissions): string {
  const special = (p.setuid ? 4 : 0) + (p.setgid ? 2 : 0) + (p.sticky ? 1 : 0);
  const body = `${digit(p.owner)}${digit(p.group)}${digit(p.other)}`;
  // The leading digit is shown only when it is doing something. Printing 0755
  // everywhere trains people to ignore it, which is how a stray 4755 slips past.
  return special > 0 ? `${special}${body}` : body;
}

export function toSymbolic(p: Permissions): string {
  const part = (s: PermissionSet, special: boolean, marker: string) => {
    const x = s.execute
      ? special
        ? marker.toLowerCase()
        : "x"
      : special
        ? marker.toUpperCase()
        : "-";
    return `${s.read ? "r" : "-"}${s.write ? "w" : "-"}${x}`;
  };
  return (
    part(p.owner, p.setuid, "s") +
    part(p.group, p.setgid, "s") +
    part(p.other, p.sticky, "t")
  );
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  permissions?: Permissions;
}

export function parseOctal(input: string): ParseResult {
  const text = input.trim();
  if (!/^[0-7]{3,4}$/.test(text)) {
    return {
      ok: false,
      error: "Enter three or four digits, each from 0 to 7. For example 755, or 1777 for a shared directory.",
    };
  }
  const padded = text.length === 3 ? `0${text}` : text;
  const [s, o, g, w] = padded.split("").map(Number);
  return {
    ok: true,
    permissions: {
      owner: fromDigit(o),
      group: fromDigit(g),
      other: fromDigit(w),
      setuid: (s & 4) !== 0,
      setgid: (s & 2) !== 0,
      sticky: (s & 1) !== 0,
    },
  };
}

export interface Warning {
  level: "danger" | "note";
  text: string;
}

/** What is worth saying about a given mode, in the order it matters. */
export function warningsFor(p: Permissions, isDirectory: boolean): Warning[] {
  const out: Warning[] = [];

  if (p.other.write && !isDirectory) {
    out.push({
      level: "danger",
      text: "World-writable. Any account on the machine can replace this file's contents, which is why 777 is almost never the right answer to a permissions problem.",
    });
  }
  if (p.setuid) {
    out.push({
      level: "danger",
      text: "setuid runs the file as its owner regardless of who started it. On Linux it is ignored for shell scripts, so setting it there does nothing and looks like it worked.",
    });
  }
  if (p.sticky && isDirectory) {
    out.push({
      level: "note",
      text: "The sticky bit here stops one user deleting another's files. This is what makes /tmp safe at 1777.",
    });
  }
  if (p.sticky && !isDirectory) {
    out.push({
      level: "note",
      text: "The sticky bit on a file does nothing on Linux. It is a leftover from systems that used it to keep a binary in swap.",
    });
  }
  if (isDirectory && (p.owner.read || p.group.read || p.other.read)) {
    const canList = p.owner.execute || p.group.execute || p.other.execute;
    if (!canList) {
      out.push({
        level: "note",
        text: "A directory needs execute to be entered at all. Read without execute lets someone list the names and open nothing.",
      });
    }
  }
  return out;
}
