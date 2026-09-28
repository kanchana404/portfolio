import { Icons } from "@/components/icons";
import { Braces, HomeIcon, NotebookIcon, WrenchIcon } from "lucide-react";
import { Docker } from "@/components/ui/svgs/docker";
import { NextjsIconDark } from "@/components/ui/svgs/nextjsIconDark";
import { Nodejs } from "@/components/ui/svgs/nodejs";
import { Postgresql } from "@/components/ui/svgs/postgresql";
import { ReactLight } from "@/components/ui/svgs/reactLight";
import { Typescript } from "@/components/ui/svgs/typescript";
import {
  SITE_CONTACT_EMAIL,
  SITE_NAME,
  SITE_PORTRAIT,
  SITE_URL,
} from "@/lib/site";

export const DATA = {
  // Identity primitives live in `@/lib/site` so that SEO plumbing can import
  // them without pulling this file's React icons into its module graph. Do not
  // inline them back here: the JSON-LD `@id` strings are derived from the same
  // constants and must not be able to drift.
  name: SITE_NAME,
  url: SITE_URL,
  location: "Sri Lanka",
  description:
    "I'm a software engineer at Cortana\u00a0AI and co\u2011founder of Ryzera Technologies. I build SaaS products, from micro SaaS to enterprise scale, plus AI automation with React, Next.js, and Node.js.",
  // The one phrase in `description` the hero underlines by hand: the current
  // role. The name above it already carries the page's strong mark.
  // "Cortana\u00a0AI": a non-breaking space so the brand never splits across
  // lines, and "co\u2011founder" a non-breaking hyphen so desktop widths do not
  // break it after "co-". The mark text must match `description` exactly.
  descriptionMarks: [{ text: "software engineer at Cortana\u00a0AI", action: "underline" }],
  // Markdown. Links are the "references" style of the Magic UI template:
  // in-page anchors for things shown further down, external links otherwise.
  summary:
    "I'm **Kavitha Kanchana** (he/him), pursuing my [B.Sc. in Software Engineering at Birmingham City University](/#education). I build SaaS products and AI automation as a software engineer at [Cortana AI](https://usecortana.ai), and I co-founded [Ryzera Technologies](https://www.ryzera.lk). I care about scalable architecture, subscription and payment systems, and clean REST APIs. My team [won two awards at IDEALIZE 2026](/#hackathons) with an AI voice agent, and I [contribute to open source](https://github.com/kanchana404).",
  // The round hero portrait. Structured data and the OG card keep using the
  // photographic headshot (SITE_AVATAR in @/lib/site).
  avatarUrl: SITE_PORTRAIT,
  // Shown as chips in the Skills section, in this order. Every chip has a
  // mark: `icon` is an inline SVG component (components/ui/svgs, from the
  // Magic UI template, or a lucide glyph for concepts that have no brand), and
  // `logo` is a file in public/skills (devicon, MIT; Simple Icons, CC0, with
  // the brand colour baked in). `invertOnDark` flips black marks to white on
  // the dark theme.
  skills: [
    { name: "JavaScript", logo: "/skills/javascript.svg" },
    { name: "TypeScript", icon: Typescript },
    { name: "React", icon: ReactLight },
    { name: "Next.js", icon: NextjsIconDark },
    { name: "Redux", logo: "/skills/redux.svg" },
    { name: "Three.js", logo: "/skills/threejs.svg", invertOnDark: true },
    // GSAP's current mark is its wordmark (Simple Icons, brand #0AE448), cropped
    // to the letters and drawn by height so it stays legible at chip size.
    { name: "GSAP", logo: "/skills/gsap.svg", logoWide: true },
    { name: "Tailwind CSS", logo: "/skills/tailwindcss.svg" },
    { name: "Node.js", icon: Nodejs },
    { name: "Express.js", logo: "/skills/express.svg", invertOnDark: true },
    { name: "MongoDB", logo: "/skills/mongodb.svg" },
    { name: "PostgreSQL", icon: Postgresql },
    { name: "REST APIs", icon: Braces },
    { name: "OpenAI API", logo: "/skills/openai.svg", invertOnDark: true },
    { name: "n8n", logo: "/skills/n8n.svg" },
    { name: "Make.com", logo: "/skills/make.svg" },
    { name: "Docker", icon: Docker },
    { name: "Git", logo: "/skills/git.svg" },
    // The site's own CI runs on GitHub Actions (.github/workflows/ci.yml).
    { name: "CI/CD", logo: "/skills/githubactions.svg" },
    { name: "Google Cloud", logo: "/skills/googlecloud.svg" },
    { name: "Microsoft Azure", logo: "/skills/azure.svg" },
    { name: "Heroku", logo: "/skills/heroku.svg" },
  ],
  navbar: [
    { href: "/", icon: HomeIcon, label: "Home" },
    { href: "/blog", icon: NotebookIcon, label: "Blog" },
    { href: "/tools", icon: WrenchIcon, label: "Tools" },
  ],
  contact: {
    email: SITE_CONTACT_EMAIL,
    workEmail: "kavitha@usecortana.ai",
    tel: "",
    social: {
      GitHub: {
        name: "GitHub",
        url: "https://github.com/kanchana404",
        icon: Icons.github,
        navbar: true,
      },
      LinkedIn: {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/kavitha-kanchana",
        icon: Icons.linkedin,
        navbar: true,
      },
      email: {
        name: "Send Email",
        url: "mailto:kanchanakavitha6@gmail.com",
        icon: Icons.email,
        navbar: false,
      },
    },
  },

  work: [
    {
      company: "Cortana AI",
      href: "https://usecortana.ai",
      badges: ["Full-time"],
      location: "Remote",
      title: "Software Engineer",
      // Two marks: the metallic one reads on the light theme, the violet one
      // on the dark theme. LogoImage swaps them with the theme class.
      logoUrl: "/cortana-light.webp",
      logoUrlDark: "/cortana-dark.webp",
      start: "Aug 2025",
      end: "Present",
      description:
        "Working as a Software Engineer at Cortana AI, building SaaS products and AI-powered automation, including intelligent agent development. Contributing to cutting-edge AI technologies and building scalable software solutions that enhance business processes.",
    },
    {
      company: "Ryzera Technologies",
      href: "https://www.ryzera.lk",
      badges: ["Co-Founder"],
      location: "Sri Lanka",
      title: "Co-Founder & Software Engineer",
      logoUrl: "/ryzera.jpg",
      start: "2023",
      end: "Present",
      description:
        "Founding and leading Ryzera Technologies, focusing on innovative software solutions and automation technologies. Driving product development, technical strategy, and business growth. Specializing in AI automation solutions using n8n and Make.com to streamline operations and improve efficiency.",
    },
    {
      company: "OpenMRS",
      href: "https://openmrs.org",
      badges: ["Open Source"],
      location: "Remote",
      title: "/dev/1 Developer",
      logoUrl: "/openmrs.png",
      start: "Jan 2026",
      end: "Present",
      description:
        "Contributing to OpenMRS, the open-source medical record system, as a /dev/1 developer in its developer community.",
    },
    {
      company: "University of Moratuwa",
      href: "https://uom.lk",
      badges: ["Mentor"],
      location: "Sri Lanka",
      title: "Software Development Project Mentor",
      logoUrl: "/university-of-moratuwa.png",
      start: "Aug 2025",
      end: "Sep 2026",
      description:
        "Mentored University of Moratuwa students through their software development project over a year and two months, from August 2025 to September 2026.",
    },
    {
      company: "Xleron",
      href: "https://xleron.io",
      badges: ["Full-time"],
      location: "Sri Lanka",
      title: "Associate Software Engineer",
      logoUrl: "/xleron.jpg",
      start: "Mar 2025",
      end: "Aug 2025",
      description:
        "Worked as an Associate Software Engineer at Xleron, a software product engineering company specializing in innovative solutions powered by AI, machine learning, and IoT. Contributed to full-stack development of applications, helping harness cutting-edge AI/ML technologies to build advanced software products. Gained industry experience working on intelligent systems and collaborative engineering projects in a startup-sized team environment.",
    },
    {
      company: "Xleron",
      href: "https://xleron.io",
      badges: ["Internship"],
      location: "Sri Lanka",
      title: "Software Engineer Intern",
      logoUrl: "/xleron.jpg",
      start: "Oct 2024",
      end: "Mar 2025",
      description:
        "Completed a 6-month internship as a Software Engineer Intern at Xleron, gaining hands-on experience in AI/ML solutions, IoT development, and full-stack software engineering. Worked on innovative projects involving intelligent systems and automation technologies.",
    },
    {
      company: "Upwork",
      href: "https://www.upwork.com",
      badges: ["Freelance"],
      location: "Remote",
      title: "Automation Engineer",
      logoUrl: "/upwork.png",
      start: "2021",
      end: "Present",
      description:
        "Specialized in workflow automation and system integration using n8n and Make.com platforms. Delivered automation solutions for various business processes, built custom integrations between different platforms and services. Experienced in reducing manual work and improving efficiency for clients through intelligent automation workflows.",
    },
    {
      company: "Fiverr",
      href: "https://www.fiverr.com",
      badges: ["Freelance", "Level 1 Seller"],
      location: "Remote",
      title: "Full-Stack Web Developer",
      logoUrl: "/fiver.png",
      start: "2021",
      end: "Present",
      description:
        "Full-stack web development and WordPress development specialist. Front-end development with modern frameworks and responsive design. Successfully completed multiple client projects with high satisfaction ratings. Level 1 seller with proven track record of delivering quality solutions and automation workflows.",
    },
  ],
  education: [
    {
      school: "Birmingham City University",
      href: "https://www.bcu.ac.uk",
      degree: "B.Sc. (Hons.) in Software Engineering",
      logoUrl: "/uni.png",
      start: "2023",
      end: "2027",
    },
    {
      school: "Hadunuwewa Central College",
      href: "#",
      degree: "GCE Advanced Level",
      logoUrl: "/hadunuwewa-central-college.jpg",
      start: "Jan 2019",
      end: "Aug 2022",
    },
  ],
  projects: [
    {
      title: "Kaidenz Clothing - Full-Stack E-commerce Platform",
      href: "https://kaidenz-clothing.vercel.app",
      dates: "2024",
      active: true,
      featured: true,
      description:
        "A full-stack e-commerce platform with a Next.js storefront, a Java EE6 backend, and secure Stripe checkout, built end to end.",
      technologies: [
        "Next.js",
        "Java EE6",
        "Stripe",
        "Full-Stack",
        "E-commerce",
        "Payment Integration",
      ],
      links: [
        {
          type: "Live Demo",
          href: "https://kaidenz-clothing.vercel.app",
          icon: <Icons.globe className="size-3" />,
        },
        {
          type: "GitHub",
          href: "https://github.com/kanchana404/kaidenz-clothing",
          icon: <Icons.github className="size-3" />,
        },
        {
          type: "LinkedIn",
          href: "https://www.linkedin.com/posts/kavitha-kanchana_%F0%9D%97%9D%F0%9D%98%82%F0%9D%98%80%F0%9D%98%81-%F0%9D%97%B9%F0%9D%97%AE%F0%9D%98%82%F0%9D%97%BB%F0%9D%97%B0%F0%9D%97%B5%F0%9D%97%B2%F0%9D%97%B1-%F0%9D%97%AE-%F0%9D%97%B3%F0%9D%98%82%F0%9D%97%B9%F0%9D%97%B9-%F0%9D%98%80%F0%9D%98%81%F0%9D%97%AE%F0%9D%97%B0%F0%9D%97%B8-activity-7361400455844818945-zRlb",
          icon: <Icons.linkedin className="size-3" />,
        },
      ],
      category: "E-commerce",
      // 16:9 covers made from the prompts in docs/project-covers.md.
      image: "/projects/kaidenz-clothing.webp",
      video: "",
    },
    {
      title: "GSAP Animation Project",
      href: "https://lnkd.in/gt4MJYJg",
      dates: "2024",
      active: true,
      description:
        "My inaugural GSAP animation endeavor! Delved into GSAP, crafting a web project adorned with seamless animations. Witnessing how animations breathe vitality into a website is truly remarkable. Built with React, Vite, GSAP, and Tailwind CSS to create engaging and smooth user experiences.",
      technologies: [
        "React",
        "Vite",
        "GSAP",
        "Tailwind CSS",
        "Animation",
        "Front-End",
      ],
      links: [
        {
          type: "Live Demo",
          href: "https://lnkd.in/gt4MJYJg",
          icon: <Icons.globe className="size-3" />,
        },
        {
          type: "GitHub",
          href: "https://github.com/kanchana404/gsap-project",
          icon: <Icons.github className="size-3" />,
        },
        {
          type: "LinkedIn",
          href: "https://www.linkedin.com/posts/kavitha-kanchana_webdevelopment-gsap-react-activity-7346758173195714561-aEH8",
          icon: <Icons.linkedin className="size-3" />,
        },
      ],
      category: "Animation",
      image: "/projects/gsap-animation.webp",
      video: "",
    },
    {
      title: "Google Business API Integration",
      href: "https://github.com/kanchana404/Google-bussiness-api-Get-reviews-and-Reply-reviews",
      dates: "2024",
      active: true,
      featured: true,
      description:
        "A Next.js integration for the Google Business Profile API: OAuth, multi-location management, and real-time review fetching with one-click replies.",
      technologies: [
        "Next.js 14",
        "TypeScript",
        "Google My Business API",
        "OAuth",
        "API Integration",
        "Review Management",
      ],
      links: [
        {
          type: "GitHub",
          href: "https://github.com/kanchana404/Google-bussiness-api-Get-reviews-and-Reply-reviews",
          icon: <Icons.github className="size-3" />,
        },
        {
          type: "LinkedIn",
          href: "https://www.linkedin.com/posts/kavitha-kanchana_nextjs-googlebusinessapi-react-activity-7343672817554493440-gYXK",
          icon: <Icons.linkedin className="size-3" />,
        },
      ],
      category: "Integration",
      image: "/projects/google-business-reviews.webp",
      video: "",
    },
    {
      title: "Fit For Hire - AI-Powered HR Platform",
      href: "https://github.com/kanchana404/Fit-For-Hire",
      dates: "2024",
      active: true,
      description:
        "MicroSaaS web application built for the JS Mastery Hackathon by Adrian Hajdin and JavaScript Mastery. This AI-powered platform replaces traditional HR managers by analyzing resumes and matching candidates with the best job opportunities available. Employers can post job openings, and candidates can easily apply - all seamlessly managed with AI technology.",
      technologies: [
        "AI/ML",
        "HR Tech",
        "OpenAI",
        "MicroSaaS",
        "Job Matching",
        "Resume Analysis",
      ],
      links: [
        {
          type: "GitHub",
          href: "https://github.com/kanchana404/Fit-For-Hire",
          icon: <Icons.github className="size-3" />,
        },
        {
          type: "LinkedIn",
          href: "https://www.linkedin.com/posts/kavitha-kanchana_ai-hrtech-openai-activity-7279273378153119744-K9M4",
          icon: <Icons.linkedin className="size-3" />,
        },
      ],
      category: "HR Tech",
      image: "/projects/fit-for-hire.webp",
      video: "",
    },
    {
      title: "AI-Powered Document Summarizer",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Built an AI-driven application leveraging OpenAI's GPT-4 to transform online documents into user-friendly summaries. Developed a React and Redux based web app that showcases ability to integrate cutting-edge AI APIs into practical solutions. Demonstrates initiative in exploring advanced technologies to solve real-world problems.",
      technologies: [
        "React",
        "Redux",
        "OpenAI API",
        "GPT-4",
        "AI Integration",
        "Document Processing",
      ],
      links: [
        {
          type: "View Project",
          href: "#",
          icon: <Icons.github className="size-3" />,
        },
      ],
      category: "AI Web App",
      image: "/projects/document-summarizer.webp",
      video: "",
    },
    {
      title: "n8n RAG Agent with Web UI",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Built an intelligent RAG (Retrieval Augmented Generation) agent using n8n platform. Developed custom web interface for seamless user interaction and AI-powered automation workflows. Advanced AI/ML integration for intelligent data processing and response generation.",
      technologies: [
        "n8n",
        "AI/ML",
        "RAG",
        "Web Development",
        "Automation",
        "Intelligent Systems",
      ],
      links: [
        {
          type: "View Project",
          href: "#",
          icon: <Icons.github className="size-3" />,
        },
      ],
      category: "AI Agent",
      image: "/projects/n8n-rag-agent.webp",
      video: "",
    },
    {
      title: "Interactive Travel Web Application",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Created an interactive travel web application featuring a 3D solar system simulation using Three.js. Combines creative design with technical depth, showcasing ability to build visually rich front-end experiences with advanced 3D graphics and animations.",
      technologies: [
        "React",
        "Three.js",
        "3D Graphics",
        "Interactive Design",
        "Web Development",
        "Animation",
      ],
      links: [
        {
          type: "View Project",
          href: "#",
          icon: <Icons.github className="size-3" />,
        },
      ],
      category: "3D Web",
      image: "/projects/travel-3d.webp",
      video: "",
    },
    {
      title: "AI-Enabled SaaS Image Editing Application",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Developed a comprehensive SaaS image editing application complete with payment and credit systems. Features AI-powered image processing capabilities and demonstrates full-stack development skills including payment integration and user management.",
      technologies: [
        "Next.js",
        "AI/ML",
        "Payment Integration",
        "SaaS",
        "Image Processing",
        "Full-Stack",
      ],
      links: [
        {
          type: "View Project",
          href: "#",
          icon: <Icons.github className="size-3" />,
        },
      ],
      category: "AI SaaS",
      image: "/projects/ai-image-editor.webp",
      video: "",
    },
  ],
  hackathons: [
    {
      title: "IDEALIZE 2026: 1st Place",
      // The words in `title` that carry the win get a Highlighter marker.
      titleMark: "1st Place",
      award: "🥇 \"Master of Agents\", the AI Mastery Award for Best AI Integration",
      dates: "2026",
      description:
        "Our team won with Amathum AI, our AI voice agent that answers and makes real phone calls for Sri Lankan businesses in Sinhala, Tamil and English. It books appointments, takes orders, checks live information and hands the call over to a person when it should. No menu trees, no \"press 1\". Best AI Integration means a lot to us, because that is exactly what Amathum AI is built for: AI that works on real phone lines, with real business systems.",
      // The brain mark on transparency for the light theme, on its black
      // badge for the dark theme.
      image: "/idealize-2026-light.png",
      imageDark: "/idealize-2026.jpg",
      links: [
        {
          title: "LinkedIn",
          icon: <Icons.linkedin className="h-4 w-4" />,
          href: "https://www.linkedin.com/feed/update/urn:li:activity:7509200657720156160",
        },
      ],
    },
    {
      title: "IDEALIZE 2026: 1st Runner-Up",
      titleMark: "1st Runner-Up",
      award: "🥈 Open Category",
      dates: "2026",
      description:
        "Amathum AI also placed 1st Runner-Up in the Open Category. It is an AI voice agent that answers and makes real phone calls for Sri Lankan businesses in Sinhala, Tamil and English, working on real phone lines with real business systems.",
      // The brain mark on transparency for the light theme, on its black
      // badge for the dark theme.
      image: "/idealize-2026-light.png",
      imageDark: "/idealize-2026.jpg",
      links: [
        {
          title: "LinkedIn",
          icon: <Icons.linkedin className="h-4 w-4" />,
          href: "https://www.linkedin.com/feed/update/urn:li:activity:7509200657720156160",
        },
      ],
    },
    {
      title: "IDEALIZE 2025 Web Development Competition - Finals",
      titleMark: "Finals",
      dates: "2025",
      location: "University of Moratuwa, Sri Lanka",
      description:
        "Thrilled to share that our team KSA Labs was selected for the finals of IDEALIZE 2025 Web Development Competition, organized by AIESEC in University of Moratuwa. Among 900+ applicants, we made it to the final stage and received recognition for building a real-world enterprise web system that goes beyond just a competition project. Our solution is already in the market with real customers. We developed Socyads, a platform that connects social media content creators (influencers) with advertisers. Features include AI-powered influencer-brand matching, multi-platform support (YouTube, Instagram, TikTok, etc.), dashboards for creators & advertisers, secure escrow payments & real-time messaging, and advanced analytics for campaign performance.",
      // The brain mark on transparency for the light theme, on its black
      // badge for the dark theme.
      image: "/idealize-2026-light.png",
      imageDark: "/idealize-2026.jpg",
      links: [
        {
          title: "LinkedIn",
          icon: <Icons.linkedin className="h-4 w-4" />,
          href: "https://www.linkedin.com/posts/kalanasandakelum_idealize2025-webdevelopment-startupjourney-activity-7379773403580370944-fGWJ",
        },
      ],
    },
    {
      title: "Open Source Contributions",
      titleMark: "Open Source",
      dates: "2023 - Present",
      location: "Global",
      description:
        "Avid open-source enthusiast with contributions to various projects. GitHub profile highlights status as 'Open Source Contributor' alongside work on micro SaaS projects. Demonstrated commitment to continuous learning and sharing knowledge within developer communities.",
      image: "/openmrs.png",
      links: [
        {
          title: "GitHub",
          icon: <Icons.github className="h-4 w-4" />,
          href: "https://github.com/kanchana404",
        },
      ],
    },
  ],
} as const;
