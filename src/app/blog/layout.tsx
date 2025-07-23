import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Blog - Kavitha Kanchan | Software Development, AI Automation & Technology Insights",
  description: "Insights on software development, AI automation, n8n workflows, MERN stack development, and technology innovation. Expert perspectives on web development, automation solutions, and emerging technologies.",
  keywords: [
    "Software Development Blog",
    "AI Automation",
    "n8n Workflows",
    "MERN Stack",
    "React.js Development",
    "Node.js Development",
    "Workflow Automation",
    "Technology Insights",
    "Web Development",
    "Automation Solutions",
    "Sri Lanka Tech Blog",
    "Software Engineering",
    "Full-Stack Development",
    "Java Development",
    "Spring Boot",
    "Government Systems",
    "Digital Transformation"
  ],
  openGraph: {
    title: "Blog - Kavitha Kanchan | Software Development & AI Automation",
    description: "Expert insights on software development, AI automation, n8n workflows, and technology innovation.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog - Kavitha Kanchan | Software Development & AI Automation",
    description: "Expert insights on software development, AI automation, n8n workflows, and technology innovation.",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 