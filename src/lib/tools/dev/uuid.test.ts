import { describe, expect, it } from "vitest";
import {
  MAX_UUID_COUNT,
  buildUuidV7,
  generateUuids,
  parseUuid,
  uuidV7Timestamp,
} from "./uuid";

const TEN = (fill: number) => new Uint8Array(10).fill(fill);

describe("version 7 layout", () => {
  it("puts the timestamp in the high 48 bits, big-endian", () => {
    // 0x0189_1234_5678 is a plausible millisecond epoch and uses all six bytes.
    const ts = 0x018912345678;
    const id = buildUuidV7(ts, TEN(0));
    expect(id.slice(0, 8)).toBe("01891234");
    expect(id.slice(9, 13)).toBe("5678");
  });

  it("survives a timestamp wider than 32 bits", () => {
    // The bug this catches: writing the timestamp with `<<` coerces to int32,
    // so every epoch after 1970 + 49 days truncates. A real epoch is 41 bits.
    const ts = Date.UTC(2026, 7, 20, 12, 0, 0);
    expect(uuidV7Timestamp(buildUuidV7(ts, TEN(0xab)))).toBe(ts);
  });

  it("sets version 7 by replacing the nibble, not OR-ing it", () => {
    // With random bytes of 0xff, an `|= 0x70` leaves the nibble at 0xf and the
    // id claims version 15. Roughly half of all ids would be wrong.
    const id = buildUuidV7(0, TEN(0xff));
    expect(id[14]).toBe("7");
    expect(parseUuid(id).version).toBe(7);
  });

  it("sets the RFC 9562 variant for every random byte value", () => {
    for (const fill of [0x00, 0x3f, 0x7f, 0xc0, 0xff]) {
      const id = buildUuidV7(0, TEN(fill));
      expect("89ab", `variant nibble for fill ${fill}`).toContain(id[19]);
      expect(parseUuid(id).valid, `valid for fill ${fill}`).toBe(true);
    }
  });

  it("sorts by creation time as plain text", () => {
    // The entire reason to prefer v7 as a database key: lexical order is
    // insertion order, so the index appends instead of fragmenting.
    const base = Date.UTC(2026, 0, 1);
    const ids = [0, 1, 2, 1000, 86_400_000].map((offset) =>
      buildUuidV7(base + offset, TEN(0x11))
    );
    expect([...ids].sort()).toEqual(ids);
  });

  it("refuses to build from too little entropy", () => {
    expect(() => buildUuidV7(0, new Uint8Array(9))).toThrow(/10 random bytes/);
  });
});

describe("generating batches", () => {
  it("produces the count asked for", () => {
    expect(generateUuids("v4", 5)).toHaveLength(5);
    expect(generateUuids("v7", 3)).toHaveLength(3);
  });

  it("clamps rather than trusting the input", () => {
    expect(generateUuids("v4", 0)).toHaveLength(1);
    expect(generateUuids("v4", -20)).toHaveLength(1);
    expect(generateUuids("v4", 10_000)).toHaveLength(MAX_UUID_COUNT);
  });

  it("does not repeat itself", () => {
    // A generator built on Math.random() passes a shape check and fails this.
    const ids = generateUuids("v4", 200);
    expect(new Set(ids).size).toBe(200);
    const sevens = generateUuids("v7", 200);
    expect(new Set(sevens).size).toBe(200);
  });

  it("gives every id the right version", () => {
    for (const id of generateUuids("v7", 20)) {
      expect(parseUuid(id)).toEqual({ valid: true, version: 7 });
    }
    for (const id of generateUuids("v4", 20)) {
      expect(parseUuid(id)).toEqual({ valid: true, version: 4 });
    }
  });
});

describe("reading a uuid back", () => {
  it("accepts a well-formed id and reports its version", () => {
    expect(parseUuid("f81d4fae-7dec-11d0-a765-00a0c91e6bf6")).toEqual({
      valid: true,
      version: 1,
    });
  });

  it("rejects the wrong shape", () => {
    for (const bad of ["", "not-a-uuid", "f81d4fae7dec11d0a76500a0c91e6bf6", "zzzzzzzz-7dec-11d0-a765-00a0c91e6bf6"]) {
      expect(parseUuid(bad).valid, bad).toBe(false);
    }
  });

  it("rejects a wrong variant nibble", () => {
    // Shape-only validators accept this. It is not a UUID: the variant field
    // says it follows a different specification entirely.
    expect(parseUuid("f81d4fae-7dec-41d0-0765-00a0c91e6bf6").valid).toBe(false);
  });

  it("reads no timestamp from a non-v7 id", () => {
    expect(uuidV7Timestamp("f81d4fae-7dec-41d0-a765-00a0c91e6bf6")).toBeNull();
    expect(uuidV7Timestamp("nope")).toBeNull();
  });
});
