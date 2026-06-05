"use client";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ExternalLink, Star } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

type Repo = {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  url: string;
  homepage: string | null;
  pushedAt: string;
};

const PER_PAGE = 6;

function humanize(name: string) {
  return name
    .replace(/\.github\.io$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function GithubRepos() {
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("/api/github-repos")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setRepos(json.repos);
      })
      .catch(() => setError("Failed to load repositories"));
  }, []);

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load repositories right now.
      </p>
    );
  }

  if (!repos) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const totalPages = Math.ceil(repos.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;
  const current = repos.slice(start, start + PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {current.map((repo) => (
          <div
            key={repo.name}
            className="flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-tight">
                {humanize(repo.name)}
              </h3>
              {repo.stars > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3" />
                  {repo.stars}
                </span>
              )}
            </div>
            <p className="flex-1 text-xs text-muted-foreground">
              {repo.description}
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {repo.language ?? ""}
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${repo.name} on GitHub`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icons.github className="size-4" />
                </Link>
                {repo.homepage && (
                  <Link
                    href={repo.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${repo.name} live demo`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="size-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages} • {repos.length} repos
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
