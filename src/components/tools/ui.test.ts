import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_INPUT_CLASS, TOOL_LABEL_CLASS, cx } from "./ui";

/**
 * The tool primitives duplicate the shared UI kit's class strings on purpose —
 * see the rationale in `ui.tsx`. Duplication that nothing checks is duplication
 * that silently drifts, so these read the originals off disk and assert the
 * strings still match.
 *
 * Reading the source rather than importing it keeps this suite in plain Node:
 * `@/components/ui/label` pulls Radix and `class-variance-authority`, which is
 * exactly the weight the tool primitives exist to avoid.
 */
const root = process.cwd();
const read = (p: string): string => readFileSync(join(root, p), "utf8");

describe("tool primitives stay in step with the shared UI kit", () => {
  it("ToolInput matches @/components/ui/input", () => {
    const source = read("src/components/ui/input.tsx");
    expect(
      source.includes(TOOL_INPUT_CLASS),
      "src/components/ui/input.tsx changed its classes — update TOOL_INPUT_CLASS in src/components/tools/ui.tsx to match"
    ).toBe(true);
  });

  it("ToolLabel matches @/components/ui/label", () => {
    const source = read("src/components/ui/label.tsx");
    expect(
      source.includes(TOOL_LABEL_CLASS),
      "src/components/ui/label.tsx changed its classes — update TOOL_LABEL_CLASS in src/components/tools/ui.tsx to match"
    ).toBe(true);
  });
});

describe("no tool widget may import the heavy UI kit", () => {
  // tailwind-merge alone is ~21 kB of client JavaScript, and a widget is the
  // only client JS on an SEO-critical route. This is the guard that stops the
  // next widget quietly reintroducing it.
  const widgetDir = "src/components/tools/widgets";
  const widgets = readFileSync(join(root, "src/lib/tools/widgets.ts"), "utf8");

  const imported = [...widgets.matchAll(/from "(@\/components\/tools\/widgets\/[^"]+)"/g)].map(
    (m) => m[1].replace("@/", "src/")
  );

  it("finds the widget modules to check", () => {
    expect(imported.length).toBeGreaterThan(0);
    expect(widgetDir).toBeTruthy();
  });

  it.each(imported)("%s imports no tailwind-merge or Radix", (modulePath) => {
    const source = read(`${modulePath}.tsx`);
    expect(source).not.toContain("@/lib/utils");
    expect(source).not.toContain("@/components/ui/");
    expect(source).not.toContain("tailwind-merge");
    expect(source).not.toContain("@radix-ui");
  });
});

describe("cx", () => {
  it("joins truthy parts with a space", () => {
    expect(cx("a", "b")).toBe("a b");
  });
  it("drops falsy parts rather than printing them", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });
  it("returns an empty string when everything is falsy", () => {
    expect(cx(false, undefined)).toBe("");
  });
});
