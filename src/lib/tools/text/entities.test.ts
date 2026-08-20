import { describe, expect, it } from "vitest";
import { REQUIRED_ESCAPES, decodeEntities, encodeEntities } from "./entities";

describe("encoding", () => {
  it("escapes the ampersand first", () => {
    // Doing & last turns the &lt; it just produced into &amp;lt;. This is the
    // single most common bug in a hand-written escaper.
    expect(encodeEntities("<a & b>")).toBe("&lt;a &amp; b&gt;");
    expect(encodeEntities("&")).toBe("&amp;");
    expect(encodeEntities("&lt;")).toBe("&amp;lt;");
  });

  it("escapes both quote characters, not just the double", () => {
    // Guides that list only & < > are describing text between tags. Inside
    // title='...' a bare apostrophe closes the attribute and the rest is markup.
    expect(encodeEntities(`he said "hi"`)).toBe("he said &quot;hi&quot;");
    expect(encodeEntities("it's")).toBe("it&#39;s");
  });

  it("neutralises a script tag", () => {
    expect(encodeEntities('<script>alert("x")</script>')).not.toContain("<script>");
  });

  it("leaves ordinary text alone", () => {
    expect(encodeEntities("plain text, no markup")).toBe("plain text, no markup");
    expect(encodeEntities("")).toBe("");
  });
});

describe("decoding", () => {
  it("handles named references", () => {
    expect(decodeEntities("&lt;b&gt;")).toBe("<b>");
    expect(decodeEntities("caf&eacute;")).toBe("caf&eacute;"); // not in the table, left alone
    expect(decodeEntities("&copy; 2026")).toBe("© 2026");
  });

  it("handles decimal and hex references", () => {
    expect(decodeEntities("&#39;")).toBe("'");
    expect(decodeEntities("&#x27;")).toBe("'");
    expect(decodeEntities("&#128512;")).toBe("😀");
    expect(decodeEntities("&#X1F600;")).toBe("😀");
  });

  it("leaves a malformed reference untouched rather than throwing", () => {
    // One bad entity in a long document should not lose the document.
    for (const bad of ["&#999999999;", "&#x110000;", "&notareal;", "&#;"]) {
      expect(decodeEntities(bad), bad).toBe(bad);
    }
  });

  it("round-trips with encode", () => {
    for (const s of ['<a href="x">&</a>', "it's a test", "plain"]) {
      expect(decodeEntities(encodeEntities(s))).toBe(s);
    }
  });
});

describe("the reference table", () => {
  it("lists all five characters that must be escaped", () => {
    expect(REQUIRED_ESCAPES.map((e) => e.char)).toEqual(["&", "<", ">", '"', "'"]);
  });

  it("says why each one matters", () => {
    for (const e of REQUIRED_ESCAPES) expect(e.why.length).toBeGreaterThan(8);
  });
});
