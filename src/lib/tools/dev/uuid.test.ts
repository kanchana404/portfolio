import { describe, expect, it } from "vitest";
import { generateUuids, inspectUuid, uuidV4, uuidV7 } from "./uuid";

const SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("uuidV4", () => {
  it("has the right shape", () => {
    expect(uuidV4()).toMatch(SHAPE);
  });

  it("sets the version and variant bits required by RFC 9562", () => {
    for (let i = 0; i < 50; i++) {
      const id = uuidV4();
      expect(id[14]).toBe("4");
      expect("89ab").toContain(id[19]);
    }
  });

  it("does not repeat", () => {
    const set = new Set(Array.from({ length: 2000 }, uuidV4));
    expect(set.size).toBe(2000);
  });
});

describe("uuidV7", () => {
  it("has the right shape and version", () => {
    const id = uuidV7();
    expect(id).toMatch(SHAPE);
    expect(id[14]).toBe("7");
    expect("89ab").toContain(id[19]);
  });

  it("sorts lexicographically in creation order", () => {
    // This is the entire reason to prefer v7 as a database key: string order
    // matches time order, so inserts append to the index instead of scattering.
    const early = uuidV7(1_000_000_000_000);
    const later = uuidV7(1_700_000_000_000);
    expect(early < later).toBe(true);
  });

  it("embeds a recoverable timestamp", () => {
    const when = 1_700_000_000_000;
    const inspected = inspectUuid(uuidV7(when));
    expect(inspected.valid).toBe(true);
    expect(inspected.version).toBe(7);
    expect(inspected.timestamp?.getTime()).toBe(when);
  });

  it("still differs for two ids made in the same millisecond", () => {
    const a = uuidV7(1_700_000_000_000);
    const b = uuidV7(1_700_000_000_000);
    expect(a).not.toBe(b);
  });
});

describe("generateUuids", () => {
  it("returns the requested count", () => {
    expect(generateUuids(10, "v4")).toHaveLength(10);
  });
  it("clamps an absurd or invalid count instead of hanging", () => {
    expect(generateUuids(100_000, "v4").length).toBe(500);
    expect(generateUuids(0, "v4").length).toBe(1);
    expect(generateUuids(Number.NaN, "v4").length).toBe(1);
  });
  it("uppercases on request without changing validity", () => {
    const [id] = generateUuids(1, "v4", true);
    expect(id).toBe(id.toUpperCase());
    expect(inspectUuid(id).valid).toBe(true);
  });
});

describe("inspectUuid", () => {
  it("accepts a valid uuid in either case, with surrounding space", () => {
    const id = uuidV4();
    expect(inspectUuid(`  ${id.toUpperCase()}  `).valid).toBe(true);
  });

  it("rejects malformed input with an explanation", () => {
    for (const bad of [
      "",
      "not-a-uuid",
      "12345678-1234-1234-1234-12345678901", // one short
      "12345678-1234-9234-1234-123456789012", // version 9 does not exist
      "12345678-1234-4234-c234-123456789012", // bad variant nibble
    ]) {
      const result = inspectUuid(bad);
      expect(result.valid, `expected ${JSON.stringify(bad)} to be invalid`).toBe(false);
      expect(result.note.length).toBeGreaterThan(0);
    }
  });

  it("gives no timestamp for a v4, which has none to give", () => {
    expect(inspectUuid(uuidV4()).timestamp).toBeNull();
  });
});
