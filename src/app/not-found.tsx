import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60dvh] text-center space-y-4">
      <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
        404 — Page not found
      </h1>
      <p className="max-w-[500px] text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <div className="flex gap-4">
        <Link href="/" className="text-foreground link-underline">
          Back to home
        </Link>
        <Link href="/blog" className="text-foreground link-underline">
          Read the blog
        </Link>
      </div>
    </main>
  );
}
