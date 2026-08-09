import { describe, expect, it } from "vitest";
import { HASH_ALGORITHMS, hashText } from "./hash";

/**
 * Known-answer tests.
 *
 * These digests are published in the algorithm specifications and reproduced in
 * every implementation on earth, so if the code ever disagrees with them the
 * code is wrong. Anything less than a known vector only proves the function is
 * self-consistent.
 */
describe("hashText — published vectors", () => {
  it('SHA-256 of "abc"', async () => {
    const r = await hashText("abc", "SHA-256");
    expect(r.ok && r.hex).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it('SHA-1 of "abc"', async () => {
    const r = await hashText("abc", "SHA-1");
    expect(r.ok && r.hex).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it('SHA-512 of "abc"', async () => {
    const r = await hashText("abc", "SHA-512");
    expect(r.ok && r.hex).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a" +
        "2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f"
    );
  });

  it("SHA-256 of the empty string", async () => {
    const r = await hashText("", "SHA-256");
    expect(r.ok && r.hex).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});

describe("hashText — behaviour", () => {
  it("hashes UTF-8 bytes, so non-Latin text works", async () => {
    const r = await hashText("සිංහල", "SHA-256");
    expect(r.ok).toBe(true);
    expect(r.ok && r.hex).toHaveLength(64);
    // Five Sinhala code points encode to more than five UTF-8 bytes.
    expect(r.ok && r.bytes).toBeGreaterThan(5);
  });

  it("returns hex and base64 of the same digest", async () => {
    const r = await hashText("abc", "SHA-256");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const fromHex = Buffer.from(r.hex, "hex").toString("base64");
      expect(r.base64).toBe(fromHex);
    }
  });

  it("produces the documented digest length for every algorithm offered", async () => {
    for (const algo of HASH_ALGORITHMS) {
      const r = await hashText("x", algo.id);
      expect(r.ok, `${algo.id} should hash`).toBe(true);
      if (r.ok) expect(r.hex.length).toBe(algo.bits / 4);
    }
  });

  it("is deterministic", async () => {
    const a = await hashText("same input", "SHA-256");
    const b = await hashText("same input", "SHA-256");
    expect(a).toEqual(b);
  });

  it("changes completely for a one-character difference", async () => {
    const a = await hashText("hello", "SHA-256");
    const b = await hashText("hellp", "SHA-256");
    expect(a.ok && b.ok && a.hex === b.hex).toBe(false);
  });

  it("offers no MD5", () => {
    // Deliberate: crypto.subtle does not implement it, and shipping a JS
    // implementation would be both bytes and an invitation to misuse it.
    const ids = HASH_ALGORITHMS.map((a) => a.id.toLowerCase());
    expect(ids).not.toContain("md5");
  });

  it("labels SHA-1 as legacy so nobody reaches for it by accident", () => {
    const sha1 = HASH_ALGORITHMS.find((a) => a.id === "SHA-1");
    expect(sha1?.label.toLowerCase()).toContain("legacy");
    expect(sha1?.note.toLowerCase()).toContain("never");
  });
});
