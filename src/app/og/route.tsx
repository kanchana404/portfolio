import { ImageResponse } from "next/og";

// Dynamic OG image for blog posts without a cover image. Blog metadata builds
// `${DATA.url}/og?title=...`; this route renders a 1200x630 card so that URL
// resolves (previously a 404).
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get("title") || "Kavitha Kanchana";
  const title = rawTitle.length > 110 ? `${rawTitle.slice(0, 110)}…` : rawTitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #1e293b 0%, #0a0a0a 60%)",
          padding: "80px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#7dd3fc",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          kavithakanchana.me/blog
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
          Kavitha Kanchana · Software Engineer at Cortana AI
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
