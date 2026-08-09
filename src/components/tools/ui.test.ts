import { readFileSync, readdirSync } from "node:fs";
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

describe("nothing on the client side of the tool boundary may import the heavy UI kit", () => {
  // tailwind-merge alone is ~21 kB of client JavaScript, and a widget is the
  // only client JS on an SEO-critical route. This is the guard that stops the
  // next widget quietly reintroducing it.
  //
  // The directory is listed rather than the map parsed. An earlier version read
  // the import statements out of the widget map, which meant a widget file that
  // existed but was not yet wired up was silently exempt — precisely the moment
  // someone is copying an existing widget and has not finished cleaning it up.
  const widgetDir = "src/components/tools/widgets";

  const modules = [
    // The client boundary itself. If this ever imports widget-frame.tsx for its
    // skeleton, tailwind-merge crosses into every tool page at once.
    "src/components/tools/tool-widget.tsx",
    "src/components/tools/ui.tsx",
    "src/components/tools/copy-button.tsx",
    ...readdirSync(join(root, widgetDir))
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => `${widgetDir}/${f}`),
  ];

  it("finds every widget module to check", () => {
    // 17 widgets plus the three shared client modules above.
    expect(modules.length).toBeGreaterThanOrEqual(20);
  });

  /**
   * Import specifiers only — static `from "x"` and dynamic `import("x")`.
   *
   * A plain substring scan over the file flagged `ui.tsx` and `tool-widget.tsx`,
   * both of which name the forbidden modules in comments explaining why they do
   * not import them. Punishing a file for documenting the rule is the wrong
   * incentive, so the check reads what is actually imported.
   */
  const importsOf = (source: string): string[] => [
    ...[...source.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]),
    ...[...source.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]),
  ];

  const FORBIDDEN = ["@/lib/utils", "@/components/ui/", "tailwind-merge", "@radix-ui"];

  it.each(modules)("%s imports no tailwind-merge or Radix", (modulePath) => {
    const specifiers = importsOf(read(modulePath));
    const offending = specifiers.filter((s) =>
      FORBIDDEN.some((f) => s.startsWith(f))
    );
    expect(offending, `${modulePath} imports ${offending.join(", ")}`).toEqual([]);
  });

  it("actually detects a forbidden import when one is present", () => {
    // Without this, a regex that matched nothing would make every case above
    // pass vacuously.
    const specifiers = importsOf('import { cn } from "@/lib/utils";');
    expect(specifiers).toEqual(["@/lib/utils"]);
    expect(FORBIDDEN.some((f) => specifiers[0].startsWith(f))).toBe(true);
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
