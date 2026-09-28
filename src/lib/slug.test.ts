import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("GPT-5 and AMD: what changed?")).toBe("gpt-5-and-amd-what-changed");
  });

  it("never leaves a hyphen at either end", () => {
    expect(slugify(" Hello ")).toBe("hello");
    expect(slugify("--Hello--")).toBe("hello");
    expect(slugify("Hello - World")).toBe("hello-world");
  });

  it("returns null when nothing usable is left", () => {
    expect(slugify("")).toBeNull();
    expect(slugify("   ")).toBeNull();
    expect(slugify("කවිත")).toBeNull();
  });
});
