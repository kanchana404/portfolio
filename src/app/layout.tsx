import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import TrackingScript from "@/components/tracking-script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DATA } from "@/data/resume";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(DATA.url),
  title: {
    default: `${DATA.name} - Associate Software Engineer | Startup Founder | AI/ML & Automation Specialist`,
    template: `%s | ${DATA.name}`,
  },
  description: "Kavitha Kanchana is an Associate Software Engineer at Xleron and Startup Founder at Ryzera Technologies, specializing in AI/ML integration, workflow automation with n8n/Make.com, and full-stack development. Expert in React, Next.js, Three.js, and cutting-edge technologies. Based in Sri Lanka.",
  keywords: [
    "Kavitha Kanchana",
    "Associate Software Engineer",
    "Startup Founder",
    "Full-Stack Developer",
    "AI/ML Integration Specialist",
    "Automation Specialist",
    "MERN Stack Developer",
    "React Developer",
    "Next.js Developer",
    "Three.js Developer",
    "OpenAI API",
    "GPT-4 Integration",
    "n8n Automation",
    "Make.com",
    "Workflow Automation",
    "Sri Lanka Software Engineer",
    "Xleron",
    "Ryzera Technologies",
    "Birmingham City University",
    "Software Engineering",
    "AI-Powered Applications",
    "3D Web Development",
    "Open Source Contributor",
    "Generation ALPHA",
    "OpenMRS",
    "GSoC",
    "GSAP Animations",
    "Three.js 3D Effects",
    "Document Summarizer",
    "Image Editing SaaS",
    "Apple iPhone Clone",
    "Travel Web Application",
    "Healthcare IT",
    "Social Impact",
    "Upwork Automation Engineer",
    "Fiverr Web Developer",
    "Freelance Developer"
  ],
  authors: [{ name: DATA.name }],
  creator: DATA.name,
  publisher: DATA.name,
  openGraph: {
    title: `${DATA.name} - Associate Software Engineer | Startup Founder | AI/ML & Automation Specialist`,
    description: "Kavitha Kanchana is an Associate Software Engineer at Xleron and Startup Founder at Ryzera Technologies, specializing in AI/ML integration, workflow automation with n8n/Make.com, and full-stack development.",
    url: DATA.url,
    siteName: `${DATA.name} - Portfolio`,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/me.png",
        width: 1200,
        height: 630,
        alt: `${DATA.name} - Associate Software Engineer | Startup Founder | AI/ML & Automation Specialist`,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  twitter: {
    card: "summary_large_image",
    title: `${DATA.name} - Associate Software Engineer | Startup Founder | AI/ML & Automation Specialist`,
    description: "Kavitha Kanchana is an Associate Software Engineer at Xleron and Startup Founder at Ryzera Technologies, specializing in AI/ML integration and workflow automation.",
    images: ["/me.png"],
    creator: "@kanchana404",
  },
  verification: {
    google: "",
    yandex: "",
  },
  alternates: {
    canonical: DATA.url,
  },
  category: "technology",
  classification: "Software Engineer Portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased max-w-2xl mx-auto py-12 sm:py-24 px-6",
          fontSans.variable
        )}
      >
        {/* AgentKong pixel tracking script */}
        <TrackingScript />
        
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider delayDuration={0}>
            {children}
            <Navbar />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
