import { Icons } from "@/components/icons";
import { HomeIcon, NotebookIcon } from "lucide-react";

export const DATA = {
  name: "Kavitha Kanchana",
  initials: "KK",
  url: "https://kavithakanchana.me",
  location: "Sri Lanka",
  locationLink: "https://www.google.com/maps/place/sri+lanka",
  description:
    "Associate Software Engineer at Xleron | Startup Founder at Ryzera Technologies | Full-Stack Developer | AI/ML & Automation Specialist | Building innovative solutions with cutting-edge technologies.",
  summary:
    "I'm Kavitha Kanchana, a Sri Lankan software engineering professional currently pursuing my undergraduate degree in Software Engineering at Birmingham City University. I work as an Associate Software Engineer at Xleron, specializing in AI/ML and IoT solutions, while also founding Ryzera Technologies to focus on innovative software solutions. I have extensive experience in full-stack development, AI automation using n8n and Make.com, and building AI-powered applications. My expertise spans from creating interactive 3D web experiences to developing comprehensive automation workflows that streamline business processes. I'm also an active member of Generation ALPHA, a Sri Lankan tech community initiative, and contribute to open-source projects.",
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
      company: "Xleron",
      href: "https://xleron.io",
      badges: ["Full-time"],
      location: "Sri Lanka",
      title: "Associate Software Engineer",
      logoUrl: "/xleron.jpg",
      start: "2023",
      end: "Present",
      description:
        "Working at Xleron, a software product engineering company specializing in innovative solutions powered by AI, machine learning, and IoT. Contributing to full-stack development of applications, helping harness cutting-edge AI/ML technologies to build advanced software products. Gaining industry experience working on intelligent systems and collaborative engineering projects in a startup-sized team environment.",
    },
    {
      company: "Ryzera Technologies",
      href: "https://ryzera.io",
      badges: ["Startup Founder"],
      location: "Sri Lanka",
      title: "Startup Founder / Software Engineer",
      logoUrl: "/ryzera.jpg",
      start: "2023",
      end: "Present",
      description:
        "Founding and leading Ryzera Technologies, focusing on innovative software solutions and automation technologies. Driving product development, technical strategy, and business growth. Specializing in AI automation solutions using n8n and Make.com to streamline operations and improve efficiency.",
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
    {
      title: "n8n Booking System Automation",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Automated booking system with voice AI capabilities for streamlined appointment scheduling and management processes. Integrated voice recognition and AI-powered automation for enhanced user experience using n8n workflows.",
      technologies: [
        "n8n",
        "Voice AI",
        "Automation",
        "Booking Systems",
        "AI Integration",
        "Process Optimization",
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
      title: "Apple iPhone 15 Pro Clone",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Created a dynamic clone of Apple's iPhone 15 Pro product page featuring GSAP animations and Three.js 3D effects. Demonstrates advanced front-end skills with complex animations and 3D visual effects, showcasing attention to detail and modern web development techniques.",
      technologies: [
        "GSAP",
        "Three.js",
        "3D Effects",
        "Animation",
        "Front-End",
        "Product Design",
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
      title: "OpenMRS Healthcare Software",
      href: "#",
      dates: "2024",
      active: true,
      description:
        "Participated in the OpenMRS open-source health IT community, applying for Google Summer of Code (GSoC) 2024. Worked on improving healthcare software modules, reflecting dedication to collaborative projects and open-source initiatives. Demonstrates commitment to using code for social impact.",
      technologies: [
        "Open Source",
        "Healthcare IT",
        "Java",
        "Collaboration",
        "Social Impact",
        "GSoC",
      ],
      links: [
        {
          type: "OpenMRS",
          href: "https://talk.openmrs.org",
          icon: <Icons.globe className="size-3" />,
        },
      ],
      image: "",
      video: "",
    },
    {
      title: "Automation Solutions Portfolio",
      href: "#",
      dates: "2021 - Present",
      active: true,
      description:
        "Custom workflow automation solutions using n8n and Make.com for various clients. System integrations and process optimization that reduced manual work and improved efficiency significantly. Comprehensive automation portfolio showcasing diverse business process improvements.",
      technologies: [
        "n8n",
        "Make.com",
        "Workflow Automation",
        "System Integration",
        "Process Optimization",
        "Business Automation",
      ],
      links: [
        {
          type: "Portfolio",
          href: "#",
          icon: <Icons.globe className="size-3" />,
        },
      ],
      image: "",
      video: "",
    },
  ],
  hackathons: [
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
