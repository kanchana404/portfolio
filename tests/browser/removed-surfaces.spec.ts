import { expect, test } from "@playwright/test";

/**
 * The admin area, its API and the /api/data ingest endpoint were deleted, not
 * hidden. Against a production build, every one of them must answer 404, and
 * an ordinary page view must set no cookie now that there are no sessions.
 *
 * The unit-level tombstones live in src/lib/security/route-surface.test.ts;
 * this checks what the deployed router actually does with the old URLs.
 */

const REMOVED_PAGES = ["/admin", "/admin/login", "/admin/create"];

const REMOVED_WRITE_APIS = [
  "/api/admin/login",
  "/api/admin/blogs",
  "/api/admin/generate-image",
  "/api/admin/optimize-content",
  "/api/data",
];

test.describe("removed surfaces", () => {
  test("the admin pages are gone", async ({ request }) => {
    for (const path of REMOVED_PAGES) {
      const response = await request.get(path);
      expect(response.status(), `GET ${path}`).toBe(404);
    }
  });

  test("the removed write APIs accept nothing", async ({ request }) => {
    for (const path of REMOVED_WRITE_APIS) {
      const response = await request.post(path, { data: {} });
      expect(response.status(), `POST ${path}`).toBe(404);
    }
  });

  test("the ingest endpoint does not answer reads either", async ({ request }) => {
    const response = await request.get("/api/data");
    expect(response.status(), "GET /api/data").toBe(404);
  });

  test("the homepage sets no cookie", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBe(true);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });
});
