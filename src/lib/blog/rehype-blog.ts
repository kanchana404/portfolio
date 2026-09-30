import { slugify } from "../slug";
import { proseProblem } from "./validate";

/**
 * The slice of hast this plugin reads and writes. Local rather than imported:
 * @types/hast is only a transitive dependency and is not reachable at the top
 * of node_modules.
 */
export interface HNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
  value?: string;
  position?: { start: { line: number } };
}

export interface RehypeBlogOptions {
  /** Named in errors. */
  slug: string;
  /** The file line the body starts on, so errors point into the post's file. */
  firstLine: number;
  /** Ids the page renders around the body. A heading never takes one. */
  reservedIds: readonly string[];
}

const isElement = (node: HNode, tagName: string) =>
  node.type === "element" && node.tagName === tagName;

function textOf(node: HNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** The text a reader sees as prose: code left out, a hard break as a new line. */
function proseOf(node: HNode): string {
  if (node.type === "text") return node.value ?? "";
  if (isElement(node, "code") || isElement(node, "pre")) return "";
  if (isElement(node, "br")) return "\n";
  return (node.children ?? []).map(proseOf).join("");
}

/** Blocks whose text is checked against the gate's placeholder rules. */
const PROSE_BLOCKS = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "th", "td", "figcaption"]);

const HEADING = /^h([1-6])$/;

/** A table's header cells, for the name of the region it scrolls in. */
export function tableName(table: HNode | undefined): string {
  const head = table?.children?.find((child) => isElement(child, "thead"));
  const row = head?.children?.find((child) => isElement(child, "tr"));
  const cells = (row?.children ?? [])
    .filter((cell) => isElement(cell, "th"))
    .map((cell) => textOf(cell).trim())
    .filter(Boolean);
  return cells.length > 0 ? `Table: ${cells.join(", ")}` : "Table";
}

/** A paragraph holding one image and nothing but whitespace around it. */
function loneImage(node: HNode): HNode | undefined {
  if (!isElement(node, "p")) return undefined;
  const children = node.children ?? [];
  const elements = children.filter((child) => child.type === "element");
  const onlyWhitespace = children.every(
    (child) => child.type === "element" || (child.type === "text" && (child.value ?? "").trim() === "")
  );
  return elements.length === 1 && isElement(elements[0], "img") && onlyWhitespace
    ? elements[0]
    : undefined;
}

/** `<figure><img><figcaption>title</figcaption></figure>`, the caption only when the title has text. */
function toFigure(img: HNode): HNode {
  const properties = { ...img.properties };
  const title = typeof properties.title === "string" ? properties.title.trim() : "";
  delete properties.title;
  const children: HNode[] = [{ ...img, properties }];
  if (title) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: {},
      children: [{ type: "text", value: title }],
      position: img.position,
    });
  }
  return { type: "element", tagName: "figure", properties: {}, children, position: img.position };
}

/** Every id already in the tree, such as the ones GFM gives footnotes. */
function collectIds(node: HNode, ids: Set<string>): void {
  const id = node.properties?.id;
  if (typeof id === "string") ids.add(id);
  for (const child of node.children ?? []) collectIds(child, ids);
}

/**
 * Rehype plugin for posts, with no dependency. In one pass, in document order:
 *
 * 1. A paragraph that is only an image becomes a `<figure>`, and the image's
 *    Markdown title becomes its `<figcaption>`. The figure replaces the
 *    paragraph, so there is never a `<p><figure>` (invalid HTML).
 * 2. `h2` and `h3` get an id from their text, so a digest item can be linked
 *    to directly. Repeats get -2, -3 and so on, and no heading takes an id
 *    the page or GFM already uses (the footnotes' ids keep theirs).
 * 3. It throws on what the publish gate exists to stop, in case the gate's
 *    line-by-line reading of the Markdown missed it: raw HTML, which
 *    react-markdown would print as text; a placeholder in the prose; an H1;
 *    and a heading that skips a level. The throw fails the gate's render
 *    test and `next build`.
 *
 * react-markdown runs rehype plugins before its URL transform and before it
 * turns raw HTML into text, so both still apply to what this produces, and
 * raw HTML reaches this plugin as `raw` nodes wherever it sits.
 */
export function rehypeBlog({ slug, firstLine, reservedIds }: RehypeBlogOptions) {
  return (tree: HNode): void => {
    const used = new Set(reservedIds);
    collectIds(tree, used);
    // The page title is the H1.
    let level = 1;

    const fail = (node: HNode, message: string): never => {
      const line = node.position ? `:${firstLine + node.position.start.line - 1}` : "";
      throw new Error(`blog prose: ${slug}${line}: ${message}`);
    };

    const visit = (node: HNode): void => {
      const children = node.children;
      if (!children) return;
      for (let i = 0; i < children.length; i++) {
        if (children[i].type === "raw") {
          fail(children[i], "raw HTML or an HTML comment, which the page would print as text");
        }
        const img = loneImage(children[i]);
        if (img) children[i] = toFigure(img);
        const child = children[i];

        const heading = HEADING.exec(child.type === "element" ? child.tagName ?? "" : "");
        if (heading) {
          const n = Number(heading[1]);
          if (n === 1) fail(child, "an H1 in the body; the title is the only H1, so start at ##");
          if (n > level + 1) fail(child, `an h${n} after an h${level} skips a heading level`);
          level = n;
          const base = n <= 3 && child.properties?.id === undefined ? slugify(textOf(child)) : null;
          if (base) {
            let id = base;
            for (let k = 2; used.has(id); k++) id = `${base}-${k}`;
            used.add(id);
            child.properties = { ...child.properties, id };
          }
        }

        if (child.type === "element" && PROSE_BLOCKS.has(child.tagName ?? "")) {
          const problem = proseProblem(proseOf(child));
          if (problem) fail(child, problem);
        }

        visit(child);
      }
    };

    visit(tree);
  };
}
