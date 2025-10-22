import { Icons } from "@/components/icons";
import { HomeIcon, NotebookIcon } from "lucide-react";

export const DATA = {
  name: "Kavitha Kanchana",
  initials: "KK",
  url: "https://kavithakanchana.me",
  location: "Sri Lanka",
  locationLink: "https://www.google.com/maps/place/sri+lanka",
  description:
    "Software Engineer at AgentKong | Startup Founder at Ryzera Technologies | Full-Stack Developer | AI/ML & Automation Specialist | Building innovative solutions with cutting-edge technologies.",
  summary:
    "I'm Kavitha Kanchana, a Sri Lankan software engineering professional currently pursuing my undergraduate degree in Software Engineering at Birmingham City University. I work as a Software Engineer at AgentKong, specializing in AI/ML and automation solutions, while also founding Ryzera Technologies to focus on innovative software solutions. I have extensive experience in full-stack development, AI automation using n8n and Make.com, and building AI-powered applications. My expertise spans from creating interactive 3D web experiences to developing comprehensive automation workflows that streamline business processes. I'm also an active member of Generation ALPHA, a Sri Lankan tech community initiative, and contribute to open-source projects.",
  avatarUrl: "/me.png",
  skills: [
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Express.js",
    "MongoDB",
    "PostgreSQL",
    "Redux",
    "Three.js",
    "GSAP",
    "Tailwind CSS",
    "Docker",
    "Git",
    "GitHub",
    "OpenAI API",
    "GPT-4",
    "AI/ML Integration",
    "n8n",
    "Make.com",
    "Workflow Automation",
    "Full-Stack Development",
    "UI/UX Design",
    "RESTful APIs",
    "Cloud Deployment",
    "Open Source",
    "Google Cloud",
    "Microsoft Azure",
    "Heroku",
    "CI/CD",
  ],
  navbar: [
    { href: "/", icon: HomeIcon, label: "Home" },
    { href: "/blog", icon: NotebookIcon, label: "Blog" },
  ],
  contact: {
    email: "kavitha.kanchana@example.com",
    tel: "+94 123 456 7890",
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
        url: "mailto:kavitha.kanchana@example.com",
        icon: Icons.email,
        navbar: false,
      },
    },
  },

  work: [
    {
      company: "AgentKong",
      href: "https://agentkong.com",
      badges: ["Full-time"],
      location: "Remote",
      title: "Software Engineer",
      logoUrl: "/agentkong.jfif",
      start: "Aug 2025",
      end: "Present",
      description:
        "Working as a Software Engineer at AgentKong, focusing on AI-powered automation solutions and intelligent agent development. Contributing to cutting-edge AI technologies and building scalable software solutions that enhance business processes through intelligent automation.",
    },
    {
      company: "Ryzera Technologies",
      href: "https://ryzera.io",
      badges: ["Co-Founder"],
      location: "Sri Lanka",
      title: "Startup Founder / Software Engineer",
      logoUrl: "/ryzera.jpg",
      start: "2023",
      end: "Present",
      description:
        "Founding and leading Ryzera Technologies, focusing on innovative software solutions and automation technologies. Driving product development, technical strategy, and business growth. Specializing in AI automation solutions using n8n and Make.com to streamline operations and improve efficiency.",
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
      company: "PulseOpes Ai",
      href: "https://pulseopsai.com/",
      badges: ["Co-Founder"],
      location: "Sri Lanka",
      title: "Startup Founder / Product Designer",
      logoUrl: "/pulseai.jpg",
      start: "2025",
      end: "Present",
      description:
        "Co-founding and leading PulseOpes Ai, an AI automation platform that connects social media accounts and enables intelligent post scheduling. Driving product development, technical strategy, and business growth. Specializing in AI-powered automation solutions to streamline social media management and improve content scheduling efficiency.",
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
        "Specialized in workflow automation and system integration using n8n and Make.com platforms. Delivered automation solutions for various business processes, built custom integrations between different platforms and services. 3+ years of experience in reducing manual work and improving efficiency for clients through intelligent automation workflows.",
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
      logoUrl: "/school.png",
      start: "January 2019",
      end: "August 2022",
    },
  ],
  projects: [
    {
      title: "Kaidenz Clothing - Full-Stack E-commerce Platform",
      href: "https://kaidenz-clothing.vercel.app",
      dates: "2024",
      active: true,
      description:
        "Built a complete full-stack e-commerce platform from the ground up with cutting-edge technology. Features lightning-fast responsive user experience with Next.js frontend, enterprise-grade Java EE6 backend architecture, and secure Stripe payment integration. This project showcases end-to-end development expertise from crafting intuitive user interfaces to implementing robust backend systems and secure payment processing.",
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
      image: "",
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
      image: "",
      video: "",
    },
    {
      title: "Google Business API Integration",
      href: "https://github.com/kanchana404/Google-bussiness-api-Get-reviews-and-Reply-reviews",
      dates: "2024",
      active: true,
      description:
        "Built a complete solution for Google Business API integration in Next.js that handles OAuth authentication, review fetching and replies, multi-location management, and token handling. Features secure authentication, real-time review management, direct reply system, and advanced filtering capabilities. Ready to use with step-by-step setup guide.",
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
      image: "",
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
      image: "",
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
      image: "",
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
      image: "",
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
      image: "",
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
      image: "",
      video: "",
    },
  ],
  hackathons: [
    {
      title: "IDEALIZE 2025 Web Development Competition - Finals",
      dates: "2025",
      location: "University of Moratuwa, Sri Lanka",
      description:
        "Thrilled to share that our team KSA Labs was selected for the finals of IDEALIZE 2025 Web Development Competition, organized by AIESEC in University of Moratuwa. Among 900+ applicants, we made it to the final stage and received recognition for building a real-world enterprise web system that goes beyond just a competition project. Our solution is already in the market with real customers. We developed Socyads, a platform that connects social media content creators (influencers) with advertisers. Features include AI-powered influencer-brand matching, multi-platform support (YouTube, Instagram, TikTok, etc.), dashboards for creators & advertisers, secure escrow payments & real-time messaging, and advanced analytics for campaign performance.",
      image: "",
      links: [
        {
          title: "LinkedIn",
          icon: <Icons.linkedin className="h-4 w-4" />,
          href: "https://www.linkedin.com/posts/kalanasandakelum_idealize2025-webdevelopment-startupjourney-activity-7379773403580370944-fGWJ",
        },
      ],
    },
    {
      title: "Generation ALPHA Tech Community",
      dates: "2023 - Present",
      location: "Sri Lanka",
      description:
        "Active member of Generation ALPHA, a Sri Lankan tech community initiative connecting undergraduates with the industry and startup ecosystem. Engaged in networking with peers and industry professionals, reflecting enthusiasm for continuous learning and community collaboration in the tech sector.",
      image: "",
      links: [
        {
          title: "LinkedIn",
          icon: <Icons.linkedin className="h-4 w-4" />,
          href: "https://www.linkedin.com/in/kavitha-kanchana",
        },
      ],
    },
    {
      title: "Open Source Contributions",
      dates: "2023 - Present",
      location: "Global",
      description:
        "Avid open-source enthusiast with contributions to various projects. GitHub profile highlights status as 'Open Source Contributor' alongside work on micro SaaS projects. Demonstrated commitment to continuous learning and sharing knowledge within developer communities.",
      image: "",
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
