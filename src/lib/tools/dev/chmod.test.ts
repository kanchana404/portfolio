import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERMISSIONS,
  parseOctal,
  toOctal,
  toSymbolic,
  warningsFor,
} from "./chmod";

const p = (octal: string) => parseOctal(octal).permissions!;

describe("octal and symbolic agree", () => {
  it("round-trips the common modes", () => {
    for (const mode of ["644", "755", "600", "777", "700"]) {
      expect(toOctal(p(mode)), mode).toBe(mode);
    }
  });

  it("renders the familiar symbolic strings", () => {
    expect(toSymbolic(p("755"))).toBe("rwxr-xr-x");
    expect(toSymbolic(p("644"))).toBe("rw-r--r--");
    expect(toSymbolic(p("600"))).toBe("rw-------");
    expect(toSymbolic(p("777"))).toBe("rwxrwxrwx");
  });
});

describe("the fourth digit most calculators omit", () => {
  it("reads and writes setuid, setgid and sticky", () => {
    expect(p("4755").setuid).toBe(true);
    expect(p("2755").setgid).toBe(true);
    expect(p("1777").sticky).toBe(true);
    expect(toOctal(p("4755"))).toBe("4755");
    expect(toOctal(p("1777"))).toBe("1777");
  });

  it("hides the leading digit when it is zero", () => {
    // Printing 0755 everywhere trains people to ignore the first digit, which
    // is how a stray 4755 gets past a review.
    expect(toOctal(p("0755"))).toBe("755");
  });

  it("shows special bits in the symbolic form, with case carrying execute", () => {
    // Lowercase s means setuid AND execute. Uppercase S means setuid without
    // execute, which is almost always a mistake, and the case is the only
    // signal that distinguishes them.
    expect(toSymbolic(p("4755"))).toBe("rwsr-xr-x");
    expect(toSymbolic(p("4655"))).toBe("rwSr-xr-x");
    expect(toSymbolic(p("1777"))).toBe("rwxrwxrwt");
    expect(toSymbolic(p("1666"))).toBe("rw-rw-rwT");
  });
});

describe("parsing", () => {
  it("accepts every valid mode, including all three special bits", () => {
    // 7555 is setuid, setgid and sticky together. It is unusual, not invalid,
    // and a parser that rejects it is rejecting a mode ls will happily print.
    expect(parseOctal("7555").ok).toBe(true);
  });

  it("accepts three or four digits", () => {
    expect(parseOctal("755").ok).toBe(true);
    expect(parseOctal("0755").ok).toBe(true);
    expect(parseOctal(" 644 ").ok).toBe(true);
  });

  it("refuses anything else, and says the shape", () => {
    for (const bad of ["", "75", "78", "75555", "rwx", "-1", "8"]) {
      const out = parseOctal(bad);
      expect(out.ok, bad).toBe(false);
      expect(out.error).toMatch(/three or four digits/);
    }
  });
});

describe("warnings", () => {
  it("calls out world-writable files", () => {
    const w = warningsFor(p("777"), false);
    expect(w[0].level).toBe("danger");
    expect(w[0].text).toMatch(/777/);
  });

  it("explains that setuid does nothing on a script", () => {
    const w = warningsFor(p("4755"), false);
    expect(w.some((x) => /ignored for shell scripts/.test(x.text))).toBe(true);
  });

  it("distinguishes the sticky bit on a directory from one on a file", () => {
    expect(warningsFor(p("1777"), true).some((x) => /deleting another/.test(x.text))).toBe(true);
    expect(warningsFor(p("1644"), false).some((x) => /does nothing/.test(x.text))).toBe(true);
  });

  it("notes a directory that cannot be entered", () => {
    // Read without execute lists names and opens nothing, which is a confusing
    // half-broken state rather than an error.
    expect(warningsFor(p("644"), true).some((x) => /entered at all/.test(x.text))).toBe(true);
  });

  it("says nothing about an ordinary mode", () => {
    expect(warningsFor(DEFAULT_PERMISSIONS, false)).toHaveLength(0);
    expect(warningsFor(p("755"), false)).toHaveLength(0);
  });
});
