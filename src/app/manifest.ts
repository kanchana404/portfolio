import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${DATA.name} Portfolio`,
    short_name: "Kavitha K.",
    description:
      "Software Engineer at Cortana AI: full-stack and SaaS developer, plus AI automation (Next.js, React, Node.js).",
    start_url: "/",
    display: "standalone",
    // The site opens in the light theme, so the splash and bar match it.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
