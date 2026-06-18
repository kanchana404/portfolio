import { ImageResponse } from "next/og";

// Route-level social share image. Next.js auto-wires this as og:image AND
// twitter:image at the correct 1200x630 dimensions (fixes the old portrait
// photo that was falsely declared as 1200x630).
export const alt = "Kavitha Kanchana — Software Engineer at Cortana AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
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
            fontSize: 30,
            color: "#7dd3fc",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          kavithakanchana.me
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 84,
            fontWeight: 700,
            marginTop: 24,
            lineHeight: 1.05,
          }}
        >
          Kavitha Kanchana
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 600,
            marginTop: 20,
            color: "#e2e8f0",
          }}
        >
          Software Engineer at Cortana AI
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            marginTop: 28,
            color: "#94a3b8",
            maxWidth: 900,
          }}
        >
          SaaS · Micro SaaS to Enterprise · AI Automation · Next.js · React
        </div>
      </div>
    ),
    { ...size }
  );
}
