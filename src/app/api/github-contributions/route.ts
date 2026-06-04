import { NextResponse } from "next/server";

// Cache the GitHub response for 1 hour so we don't hit the API on every page load.
export const revalidate = 3600;

const USERNAME = "kanchana404";

const QUERY = `
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${res.status}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    if (json.errors?.length) {
      return NextResponse.json(
        { error: json.errors[0]?.message ?? "GraphQL error" },
        { status: 500 }
      );
    }

    const calendar =
      json.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
      return NextResponse.json(
        { error: "No contribution data found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      totalContributions: calendar.totalContributions,
      weeks: calendar.weeks,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch contributions" },
      { status: 500 }
    );
  }
}
