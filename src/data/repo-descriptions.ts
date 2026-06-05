// Hand-written descriptions for my public GitHub repositories, based on each
// repo's actual README and dependencies (real tech stack + functionality).
// The /api/github-repos route merges these with live GitHub data, so the
// repo list updates itself as I push new projects. Any repo not listed here
// falls back to its GitHub description (or an auto-generated one).
export const REPO_DESCRIPTIONS: Record<string, string> = {
  portfolio:
    "My personal portfolio and blog built with Next.js, TypeScript, Tailwind CSS, and Framer Motion, with a MongoDB-backed blog for sharing my work.",
  "Combank-Automation":
    "A FastAPI web scraper that automates login to ComBank Digital with Selenium and extracts account balances and transaction history — containerized with Docker.",
  "todo-app2":
    "A React Native (Expo) to-do app with full authentication — signup, login, and persistent sessions via AsyncStorage.",
  "signal-WebSocket":
    "A Telegram trading-signal detector bot that logs signals from groups, saves images, serves them over HTTP, and broadcasts events via WebSocket — Dockerized for VPS hosting.",
  "shop-management-python-tg-bot":
    "A Telegram bot in Python for managing shop inventory, orders, and sales directly from chat.",
  "React-Native-Learning-2":
    "Hands-on React Native (Expo) practice exploring mobile UI, navigation, and reusable components.",
  "React-Native-Learning-1":
    "An introductory React Native (Expo) project covering core mobile fundamentals, including image picking.",
  "python-wallet":
    "A Python Telegram bot that shares airdrop information through interactive web-app buttons.",
  "offset-dashboard-new-feature-test":
    "A feature-test build of the Offset analytics dashboard — Next.js with MongoDB, JWT auth, UploadThing uploads, and Recharts visualizations.",
  kanchana404: "My GitHub profile README repository.",
  "kaidenz-with-firebase":
    "A Next.js 15 admin dashboard for managing products, orders, customers, and analytics — powered by Firebase, UploadThing, and Recharts.",
  "image-audio-subtitle":
    "A Python/FastAPI tool that auto-generates subtitles and short-video effects from audio and images using ffmpeg.",
  "First-android-project":
    "My first native Android application, exploring the Android SDK.",
  "Google-bussiness-api-Get-reviews-and-Reply-reviews":
    "A Next.js app to manage Google Business Profile reviews — OAuth login, real-time review fetching, and one-click replies.",
  "gsap-project":
    "An animated landing page built with React, Vite, and GSAP for smooth, timeline-based motion.",
  "kaidenz-clothing":
    "A fully responsive e-commerce storefront built with Next.js 15, React 19, and Tailwind CSS 4, with Clerk auth and Stripe checkout.",
  "food-app":
    "A food-ordering mobile app built with Expo Router and React Native.",
  web: "A full-stack product-management system built with Next.js 15, React 19, MongoDB, and JWT/bcrypt authentication.",
  "react-chat-app":
    "A real-time mobile chat app built with React Native (Expo) and NativeWind.",
  "Fit-For-Hire":
    "A micro-SaaS that uses AI (OpenAI) to analyze CVs and match candidates to jobs — Next.js, Clerk, Stripe, MongoDB, and UploadThing.",
  "Real-state-mobile-app":
    "A real estate listings mobile app built with Expo Router and React Native.",
  "expo-Starter-pack-with-native-Wind":
    "An Expo + NativeWind starter template for quickly bootstrapping React Native apps.",
  "Nextjs-starter-pack-with-clerk-postgress":
    "A Next.js starter preconfigured with Clerk authentication and a Drizzle ORM + PostgreSQL backend.",
  "telegram-mini-app-next-js-starter":
    "A Telegram Mini App boilerplate built on Next.js with MongoDB, UploadThing, and Recharts to jump-start mini-app development.",
  "data-scrapper":
    "A web-scraping app built with Next.js and MongoDB that extracts and stores structured data.",
  "product-manage":
    "A product-management dashboard built with Next.js and MongoDB for tracking catalog and inventory.",
  "Uber-Clone":
    "A ride-hailing app clone built with Expo Router and NativeWind, replicating Uber's booking and map flow.",
  xora: "A modern SaaS landing page built with React, Vite, and Tailwind CSS.",
  podcast:
    "An AI podcast platform built with Next.js, Clerk, and OpenAI — create and stream episodes with AI-generated voices.",
  Fashion:
    "A fashion e-commerce store built with Next.js, Clerk authentication, and MongoDB.",
  "Openai-sdk-chatApp":
    "An AI chat app built with Next.js and the Vercel AI SDK, streaming responses from OpenAI.",
  Pricewise:
    "A price-tracking app built with Next.js that monitors product prices and alerts on drops.",
  "ameliya-pos":
    "A point-of-sale system for retail sales and inventory management.",
  "Fashion-Admin":
    "An admin dashboard for the Fashion store — Next.js with Clerk auth, MongoDB, and UploadThing media uploads.",
  "skill-test":
    "A skills-assessment app built with Next.js, Clerk, and MongoDB for testing and scoring users.",
  auth: "An authentication demo built with Next.js, Clerk, and MongoDB.",
  election:
    "An online election platform built with Next.js, Clerk, and MongoDB, with live results charts via Recharts.",
  "mern-forum":
    "A discussion forum built on the MERN stack with JWT authentication and bcrypt-secured accounts.",
  clerk:
    "A Next.js demo integrating Clerk authentication with a MongoDB backend.",
  Forum:
    "A community forum built with Next.js, Clerk, and MongoDB for threaded discussions.",
  crud: "A CRUD app built with Next.js and MongoDB demonstrating full create/read/update/delete flows.",
  Travel_app:
    "A travel landing page built with Next.js showcasing destinations and tour packages.",
  Brainwave:
    "A modern AI-product landing page built with React, Vite, and Tailwind, featuring parallax and scroll-driven animations.",
  bing: "A search-engine-style interface built with Next.js and shadcn/ui.",
  Portfolio_super:
    "An interactive 3D portfolio built with Next.js, React Three Fiber, and three-globe, with Framer Motion animations.",
  siboria: "A modern marketing website built with Next.js and Tailwind CSS.",
  Promptophia:
    "An AI prompt-sharing community built with Next.js, MongoDB, and NextAuth for discovering and posting prompts.",
  gigdrift_pro:
    "A freelance gig marketplace connecting clients and freelancers.",
  "Case-Cobra":
    "A custom phone-case e-commerce app built with Next.js, featuring a live in-browser case designer.",
  Cypress:
    "A Notion-style collaborative SaaS workspace with real-time cursors — built with Next.js 13, Supabase, Drizzle ORM, Stripe, and Socket.io.",
  FoodieLand:
    "A recipe and food-blog landing page built with Next.js and Tailwind CSS.",
  Zoom: "A Zoom-style video-conferencing app built with Next.js, Clerk, and the Stream Video SDK — meetings, recordings, and screen sharing.",
  Evently:
    "An event-management and ticketing platform built with Next.js, Clerk, Stripe payments, and MongoDB.",
  Flexible:
    "A designer portfolio-sharing platform built with Next.js, NextAuth, and a GraphQL backend.",
  eshop: "An e-commerce shop built with PHP and JavaScript.",
  Imaginify:
    "An AI image-editing SaaS built with Next.js, Clerk, and MongoDB — generative fill, restore, and background removal with a credits system.",
  Apple_clone:
    "A pixel-perfect Apple website clone built with React, Three.js, and GSAP, featuring 3D models and scroll-driven animations.",
  RealState: "A real estate listings website built with Next.js.",
  Summarizer:
    "An AI article summarizer built with React and Redux Toolkit (RTK Query) that condenses any URL into key points.",
  Nike_web: "A Nike-inspired e-commerce landing page built with React and Vite.",
  Amelia:
    "A business website built with Next.js and MongoDB, with JWT auth and Nodemailer email integration.",
  Cipherspark: "A cybersecurity-themed landing page built with HTML and CSS.",
  Recipe_Finder:
    "A recipe-finder web app built with vanilla JavaScript, searching meals by ingredient via a public API.",
  Image_Search_Engine:
    "An image search engine built with vanilla JavaScript using a public images API.",
  Country_Info:
    "A country-info app built with vanilla JavaScript using the REST Countries API.",
  ICET_Final_Web_Project:
    "A final web project built with HTML, CSS, and JavaScript for an ICET course.",
  Firs_Web_Animation:
    "An early web-animation experiment built with HTML, CSS, and JavaScript.",
  Email_Subscription:
    "An email subscription page that stores signups to Google Sheets via a web-app URL.",
  Wether_App:
    "A weather app built with HTML, CSS, and JavaScript showing live conditions by city.",
  QR_Code_Generator:
    "A QR-code generator built with HTML, CSS, and JavaScript.",
  Password_Strength_Checker:
    "A password-strength checker built with JavaScript that rates passwords in real time.",
  "Prabashwara.github.io": "A personal website hosted on GitHub Pages.",
  "Prabashwara-s-Website":
    "A personal portfolio website built with HTML, CSS, and JavaScript.",
  story: "A collection of my learning milestones and notes.",
  SMS_Spam: "An SMS spam-detection model built in Python.",
};
