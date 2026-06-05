import { NextResponse } from "next/server";
import { REPO_DESCRIPTIONS } from "@/data/repo-descriptions";

// Cache for 1 hour so we don't hit the GitHub API on every page load.
export const revalidate = 3600;

const USERNAME = "kanchana404";

// Auto-generate a readable description for any repo we haven't hand-written
// one for (e.g. brand-new repos pushed after this was last edited).
function fallbackDescription(name: string, language: string | null) {
  const readable = name.replace(/[-_]/g, " ");
  return language
    ? `${readable} — a project built with ${language}.`
    : `${readable} — a personal project.`;
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured" },
      { status: 500 }
    );
  }

  try {
    const repos: any[] = [];
    // Page through every public repo (100 per page).
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(
        `https://api.github.com/users/${USERNAME}/repos?per_page=100&page=${page}&sort=pushed`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
          next: { revalidate: 3600 },
        }
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: `GitHub API error: ${res.status}` },
          { status: res.status }
        );
      }

      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      repos.push(...batch);
      if (batch.length < 100) break;
    }

    const data = repos
      .filter((r) => !r.fork)
      .sort(
        (a, b) =>
          new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
      )
      .map((r) => ({
        name: r.name,
        description:
          REPO_DESCRIPTIONS[r.name] ||
          r.description ||
          fallbackDescription(r.name, r.language),
        language: r.language as string | null,
        stars: r.stargazers_count as number,
        url: r.html_url as string,
        homepage: r.homepage ? (r.homepage as string) : null,
        pushedAt: r.pushed_at as string,
      }));

    return NextResponse.json({ count: data.length, repos: data });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
