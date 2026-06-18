import type { MetadataRoute } from "next";
import { DATA } from "@/data/resume";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${DATA.name} — Portfolio`,
    short_name: "Kavitha K.",
    description:
      "Software Engineer at Cortana AI — full-stack & SaaS developer, plus AI automation (Next.js, React, Node.js).",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
