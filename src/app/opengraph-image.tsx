import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Route-level social share image — Next.js auto-wires this as og:image AND
// twitter:image at 1200x630. Personal-brand card: headshot + name + role.
export const alt = "Kavitha Kanchana — Software Engineer at Cortana AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const photo = await readFile(
    join(process.cwd(), "public/kavitha-kanchana-software-engineer.jpg")
  );
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: "72px",
          backgroundColor: "#0a0a0a",
          backgroundImage:
            "radial-gradient(circle at 22% 30%, #1e293b 0%, #0a0a0a 60%)",
          padding: "80px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc}
          width={300}
          height={300}
          style={{
            width: 300,
            height: 300,
            borderRadius: 9999,
            objectFit: "cover",
            objectPosition: "center 20%",
            border: "4px solid rgba(255,255,255,0.15)",
            flexShrink: 0,
          }}
          alt=""
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#7dd3fc",
            }}
          >
            kavithakanchana.me
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              marginTop: 16,
              lineHeight: 1.05,
            }}
          >
            Kavitha Kanchana
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 38,
              fontWeight: 600,
              marginTop: 16,
              color: "#e2e8f0",
            }}
          >
            Software Engineer at Cortana AI
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              marginTop: 24,
              color: "#94a3b8",
            }}
          >
            Full-stack · SaaS · Next.js · React · Node.js
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
