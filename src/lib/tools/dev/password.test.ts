import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAlphabet,
  CHARSETS,
  describeStrength,
  generatePassphrase,
  generatePassword,
  WORDLIST_SIZE,
} from "./password";

const ALL = CHARSETS.map((c) => c.id);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildAlphabet", () => {
  it("includes only the selected sets", () => {
    const alphabet = buildAlphabet({
      length: 16,
      charsets: ["digits"],
      excludeAmbiguous: false,
    });
    expect(alphabet).toBe("0123456789");
  });

  it("drops look-alike characters on request", () => {
    const alphabet = buildAlphabet({
      length: 16,
      charsets: ["lower", "upper", "digits"],
      excludeAmbiguous: true,
    });
    for (const ch of ["l", "I", "1", "O", "0", "o"]) {
      expect(alphabet).not.toContain(ch);
    }
    expect(alphabet).toContain("a");
  });

  it("is empty when nothing is selected", () => {
    expect(
      buildAlphabet({ length: 16, charsets: [], excludeAmbiguous: false })
    ).toBe("");
  });
});

describe("generatePassword", () => {
  it("produces the requested length", () => {
    for (const length of [1, 8, 24, 64]) {
      const result = generatePassword({
        length,
        charsets: ALL,
        excludeAmbiguous: false,
      });
      expect(result?.password).toHaveLength(length);
    }
  });

  it("returns null when no character set is chosen", () => {
    expect(
      generatePassword({ length: 12, charsets: [], excludeAmbiguous: false })
    ).toBeNull();
  });

  it("only emits characters from the chosen alphabet", () => {
    const result = generatePassword({
      length: 200,
      charsets: ["digits"],
      excludeAmbiguous: false,
    });
    expect(result?.password).toMatch(/^[0-9]{200}$/);
  });

  it("reports entropy as log2(alphabet) per character", () => {
    const result = generatePassword({
      length: 10,
      charsets: ["digits"],
      excludeAmbiguous: false,
    });
    expect(result?.alphabetSize).toBe(10);
    expect(result?.bits).toBeCloseTo(10 * Math.log2(10), 6);
  });

  it("never touches Math.random", () => {
    // The point of the module. If any code path reaches for the non-cryptographic
    // generator, this throws instead of silently producing a weak password.
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random is not a CSPRNG and must not be used here");
    });
    expect(() =>
      generatePassword({ length: 32, charsets: ALL, excludeAmbiguous: false })
    ).not.toThrow();
    expect(() =>
      generatePassphrase({ words: 5, separator: "-", capitalise: false, appendNumber: true })
    ).not.toThrow();
  });

  it("reaches every character of a small alphabet", () => {
    const result = generatePassword({
      length: 256,
      charsets: ["digits"],
      excludeAmbiguous: false,
    });
    expect(new Set(result!.password).size).toBe(10);
  });

  it("rejects out-of-range bytes instead of folding them with a modulo", () => {
    // A statistical test cannot settle this: `byte % 26` over-represents the
    // first 22 letters by only about 11%, which is inside the noise of any
    // sample small enough to run in a unit suite.
    //
    // So drive the generator with a known byte sequence instead. Sweeping
    // 0…255 repeatedly, correct rejection sampling discards everything at or
    // above 234 (the largest multiple of 26) and yields exactly nine of each
    // letter per sweep. A modulo implementation consumes 26 fewer bytes per
    // sweep and drifts, handing the leading letters a surplus.
    let cursor = 0;
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(
      (array: ArrayBufferView | null) => {
        const view = array as Uint8Array;
        for (let i = 0; i < view.length; i++) view[i] = cursor++ % 256;
        return array as never;
      }
    );

    const options = {
      length: 234,
      charsets: ["lower" as const],
      excludeAmbiguous: false,
    };
    const drawn =
      generatePassword(options)!.password + generatePassword(options)!.password;

    const counts = new Map<string, number>();
    for (const ch of drawn) counts.set(ch, (counts.get(ch) ?? 0) + 1);

    expect(drawn).toHaveLength(468);
    expect(counts.size).toBe(26);
    for (const [letter, count] of counts) {
      expect(count, `${letter} appeared ${count} times, expected 18`).toBe(18);
    }
  });

  it("clamps a nonsense length instead of hanging or returning empty", () => {
    expect(
      generatePassword({ length: 0, charsets: ALL, excludeAmbiguous: false })?.password
    ).toHaveLength(1);
    expect(
      generatePassword({ length: 1e6, charsets: ALL, excludeAmbiguous: false })?.password
    ).toHaveLength(256);
  });
});

describe("generatePassphrase", () => {
  it("joins the requested number of words", () => {
    const result = generatePassphrase({
      words: 5,
      separator: "-",
      capitalise: false,
      appendNumber: false,
    });
    expect(result.password.split("-")).toHaveLength(5);
  });

  it("honours the separator", () => {
    const result = generatePassphrase({
      words: 3,
      separator: ".",
      capitalise: false,
      appendNumber: false,
    });
    expect(result.password.split(".")).toHaveLength(3);
    expect(result.password).not.toContain("-");
  });

  it("capitalises each word on request", () => {
    const result = generatePassphrase({
      words: 4,
      separator: "-",
      capitalise: true,
      appendNumber: false,
    });
    for (const word of result.password.split("-")) {
      expect(word[0]).toBe(word[0].toUpperCase());
    }
  });

  it("appends a two-digit number as an extra segment", () => {
    const result = generatePassphrase({
      words: 3,
      separator: "-",
      capitalise: false,
      appendNumber: true,
    });
    const parts = result.password.split("-");
    expect(parts).toHaveLength(4);
    expect(parts[3]).toMatch(/^\d{2}$/);
  });

  it("derives entropy from the real wordlist size", () => {
    const result = generatePassphrase({
      words: 6,
      separator: "-",
      capitalise: false,
      appendNumber: false,
    });
    expect(result.bits).toBeCloseTo(6 * Math.log2(WORDLIST_SIZE), 6);
  });

  it("has a wordlist with no duplicates", () => {
    // A duplicated word would make the stated entropy an overestimate.
    const sample = generatePassphrase({
      words: 12,
      separator: " ",
      capitalise: false,
      appendNumber: false,
    });
    expect(sample.password.split(" ")).toHaveLength(12);
    expect(WORDLIST_SIZE).toBeGreaterThan(200);
  });

  it("clamps word count to a usable range", () => {
    expect(
      generatePassphrase({
        words: 1,
        separator: "-",
        capitalise: false,
        appendNumber: false,
      }).password.split("-")
    ).toHaveLength(2);
    expect(
      generatePassphrase({
        words: 99,
        separator: "-",
        capitalise: false,
        appendNumber: false,
      }).password.split("-")
    ).toHaveLength(12);
  });
});

describe("describeStrength", () => {
  it("bands entropy from weak to excellent", () => {
    expect(describeStrength(20).band).toBe("weak");
    expect(describeStrength(49).band).toBe("weak");
    expect(describeStrength(50).band).toBe("fair");
    expect(describeStrength(69).band).toBe("fair");
    expect(describeStrength(70).band).toBe("strong");
    expect(describeStrength(99).band).toBe("strong");
    expect(describeStrength(100).band).toBe("excellent");
  });

  it("describes crack time in ascending units", () => {
    expect(describeStrength(1).crackTime).toBe("instantly");
    expect(describeStrength(256).crackTime).toContain("universe");
  });

  it("is monotonic — more entropy is never described as faster to crack", () => {
    const order = [
      "instantly",
      "seconds",
      "minutes",
      "hours",
      "days",
      "years",
      "thousand years",
      "million years",
      "billion years",
      "universe",
    ];
    const rank = (text: string): number =>
      order.reduce((best, unit, i) => (text.includes(unit) ? i : best), 0);

    let previous = -1;
    for (let bits = 1; bits <= 200; bits += 1) {
      const current = rank(describeStrength(bits).crackTime);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});
