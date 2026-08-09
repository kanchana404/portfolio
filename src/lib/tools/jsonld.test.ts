import { describe, expect, it } from "vitest";
import { PERSON_ID, SITE_URL, WEBSITE_ID } from "@/lib/site";
import { TOOLS, publicTools } from "./registry";
import {
  categoryUrl,
  toolCategoryJsonLd,
  toolJsonLd,
  toolUrl,
  toolsHubJsonLd,
} from "./jsonld";
import type { ToolDef } from "./types";

type Node = Record<string, unknown>;

function graphOf(doc: Record<string, unknown>): Node[] {
  return doc["@graph"] as Node[];
}

/** Every `@id` the graph defines. */
function definedIds(graph: Node[]): Set<string> {
  return new Set(
    graph
      .map((n) => n["@id"])
      .filter((v): v is string => typeof v === "string")
  );
}

/**
 * Every `@id` the graph *points at* — i.e. objects of the shape `{"@id": "..."}`
 * used as a reference rather than as a node definition.
 */
function referencedIds(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) referencedIds(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    const obj = value as Node;
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === "@id" && typeof obj["@id"] === "string") {
      out.push(obj["@id"] as string);
      return out;
    }
    for (const key of keys) {
      if (key === "@id") continue; // a definition, not a reference
      referencedIds(obj[key], out);
    }
  }
  return out;
}

/** Nodes the root layout owns. Referencing them is the entire point. */
const EXTERNAL_IDS = new Set([PERSON_ID, WEBSITE_ID]);

function expectNoDanglingReferences(doc: Record<string, unknown>): void {
  const graph = graphOf(doc);
  const defined = definedIds(graph);
  for (const ref of referencedIds(graph)) {
    expect(
      defined.has(ref) || EXTERNAL_IDS.has(ref),
      `@id "${ref}" is referenced but neither defined in this graph nor owned by the root layout`
    ).toBe(true);
  }
}

function nodeOfType(graph: Node[], type: string): Node {
  const node = graph.find((n) => n["@type"] === type);
  expect(node, `expected a ${type} node`).toBeDefined();
  return node as Node;
}

const SAMPLE: ToolDef = TOOLS[0];

describe("toolJsonLd", () => {
  const doc = toolJsonLd(SAMPLE);
  const graph = graphOf(doc);

  it("emits WebPage, SoftwareApplication, FAQPage and BreadcrumbList", () => {
    const types = graph.map((n) => n["@type"]);
    expect(types).toEqual(
      expect.arrayContaining([
        "WebPage",
        "SoftwareApplication",
        "FAQPage",
        "BreadcrumbList",
      ])
    );
  });

  it("has no dangling @id references", () => {
    expectNoDanglingReferences(doc);
  });

  it("attributes the tool to the root layout's Person node", () => {
    // The whole reason the tools live on this domain. If these drift, Google
    // resolves the tools as an unrelated entity and they do nothing for the
    // personal brand.
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.author).toEqual({ "@id": PERSON_ID });
    expect(app.publisher).toEqual({ "@id": PERSON_ID });
    expect(app.isPartOf).toEqual({ "@id": WEBSITE_ID });
  });

  it("uses the canonical absolute tool URL", () => {
    const webpage = nodeOfType(graph, "WebPage");
    expect(webpage.url).toBe(`${SITE_URL}/tools/${SAMPLE.slug}`);
    expect(webpage.url).toBe(toolUrl(SAMPLE.slug));
  });

  it("mirrors every FAQ into the FAQPage node", () => {
    const faq = nodeOfType(graph, "FAQPage");
    const questions = faq.mainEntity as Node[];
    expect(questions).toHaveLength(SAMPLE.faqs.length);
    questions.forEach((q, i) => {
      expect(q.name).toBe(SAMPLE.faqs[i].q);
      expect((q.acceptedAnswer as Node).text).toBe(SAMPLE.faqs[i].a);
    });
  });

  it("numbers breadcrumb positions from 1 with no gaps", () => {
    const crumbs = nodeOfType(graph, "BreadcrumbList").itemListElement as Node[];
    expect(crumbs.length).toBeGreaterThanOrEqual(3);
    crumbs.forEach((c, i) => expect(c.position).toBe(i + 1));
    expect(crumbs[crumbs.length - 1].item).toBe(toolUrl(SAMPLE.slug));
  });

  it("declares the tool free rather than omitting price", () => {
    const app = nodeOfType(graph, "SoftwareApplication");
    expect(app.isAccessibleForFree).toBe(true);
    expect((app.offers as Node).price).toBe("0");
  });

  it("invents no ratings or reviews", () => {
    // Fabricated aggregateRating is a structured-data manual action, and a
    // manual action here would take the blog and homepage with it.
    const serialised = JSON.stringify(doc).toLowerCase();
    for (const banned of ["aggregaterating", "ratingvalue", '"review"']) {
      expect(serialised).not.toContain(banned);
    }
  });

  it("serialises to valid JSON with no undefined leaking in", () => {
    const serialised = JSON.stringify(doc);
    expect(() => JSON.parse(serialised)).not.toThrow();
    expect(serialised).not.toContain("undefined");
  });

  it("produces a clean graph for every tool in the registry", () => {
    for (const tool of TOOLS) {
      expectNoDanglingReferences(toolJsonLd(tool));
    }
  });
});

describe("toolsHubJsonLd", () => {
  const doc = toolsHubJsonLd(publicTools());
  const graph = graphOf(doc);

  it("has no dangling @id references", () => {
    expectNoDanglingReferences(doc);
  });

  it("counts the list correctly", () => {
    const list = nodeOfType(graph, "ItemList");
    expect(list.numberOfItems).toBe(publicTools().length);
    expect((list.itemListElement as Node[]).length).toBe(publicTools().length);
  });

  it("links every listed tool at its canonical URL", () => {
    const items = nodeOfType(graph, "ItemList").itemListElement as Node[];
    const expected = publicTools().map((t) => toolUrl(t.slug));
    expect(items.map((i) => i.url)).toEqual(expected);
  });
});

describe("toolCategoryJsonLd", () => {
  const category = SAMPLE.category;
  const doc = toolCategoryJsonLd(category, [SAMPLE]);

  it("has no dangling @id references", () => {
    expectNoDanglingReferences(doc);
  });

  it("uses the canonical category URL", () => {
    const page = nodeOfType(graphOf(doc), "CollectionPage");
    expect(page.url).toBe(categoryUrl(category));
  });
});

describe("graph ids are unique within a document", () => {
  it.each([
    ["tool", toolJsonLd(SAMPLE)],
    ["hub", toolsHubJsonLd(publicTools())],
    ["category", toolCategoryJsonLd(SAMPLE.category, [SAMPLE])],
  ])("%s graph defines each @id once", (_name, doc) => {
    const ids = graphOf(doc as Record<string, unknown>)
      .map((n) => n["@id"])
      .filter((v): v is string => typeof v === "string");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
