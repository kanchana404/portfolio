# Kavitha Kanchan - Portfolio & Blog

A modern, responsive portfolio website showcasing my work as a Software Engineer and Entrepreneur. Built with Next.js, TypeScript, and Tailwind CSS, featuring a blog section for sharing insights on software development, AI automation, and entrepreneurship.

## 🚀 Features

### Portfolio Section
- **Modern Design**: Clean, professional layout with smooth animations
- **Responsive**: Optimized for desktop, tablet, and mobile devices
- **Dark/Light Mode**: Toggle between themes with persistent preference
- **Interactive Elements**: Hover effects, smooth transitions, and animated components
- **SEO Optimized**: Meta tags, structured data, and performance optimized

### Blog Section
- **MDX Support**: Write blog posts using Markdown with React components
- **Syntax Highlighting**: Code blocks with syntax highlighting
- **Responsive Layout**: Card-based design for blog posts
- **Topic Categories**: Organized content by technology areas
- **Search & Filter**: Easy navigation through blog content

### Content Areas
- **Work Experience**: Detailed professional background with company logos
- **Projects**: Showcase of technical projects with technologies used
- **Skills**: Comprehensive list of technical skills and tools
- **Education**: Academic background and certifications
- **Hackathons**: Participation in innovation challenges
- **Contact Information**: Professional social links and contact details

## 🛠️ Technologies Used

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript development
- **Tailwind CSS**: Utility-first CSS framework
- **Framer Motion**: Smooth animations and transitions
- **React Markdown**: MDX rendering for blog posts

### UI Components
- **shadcn/ui**: Modern, accessible component library
- **Lucide React**: Beautiful, customizable icons
- **Magic UI**: Advanced animation components

### Development Tools
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

### Content Management
- **MDX**: Markdown with JSX support
- **Gray Matter**: Front matter parsing
- **Rehype**: Markdown processing plugins
- **Remark**: Markdown parsing and processing

## 📁 Project Structure

```
dillionverma-portfolio-f1bdbdb/
├── content/                    # Blog posts (MDX files)
│   ├── hello-world.mdx
│   ├── ai-automation-low-code.mdx
│   ├── building-scalable-web-apps.mdx
│   └── entrepreneurship-startup-journey.mdx
├── public/                     # Static assets
│   ├── me.png                  # Profile image
│   ├── uni.png                 # University logo
│   ├── xleron.jpg              # Company logo
│   ├── ryzera.jpg              # Company logo
│   └── ...                     # Other images
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── blog/               # Blog pages
│   │   │   ├── [slug]/         # Individual blog post
│   │   │   └── page.tsx        # Blog listing page
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   ├── components/             # React components
│   │   ├── magicui/            # Animation components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── hackathon-card.tsx
│   │   ├── project-card.tsx
│   │   ├── resume-card.tsx
│   │   └── ...
│   ├── data/                   # Data files
│   │   ├── blog.ts             # Blog utilities
│   │   └── resume.tsx          # Portfolio data
│   └── lib/                    # Utility functions
│       └── utils.ts
├── components.json             # shadcn/ui configuration
├── tailwind.config.ts          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kanchana404/portfolio.git
   cd portfolio
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

## 📝 Adding Content

### Adding Blog Posts

1. Create a new `.mdx` file in the `content/` directory
2. Add front matter with metadata:

```mdx
---
title: "Your Blog Post Title"
publishedAt: "2024-12-20"
summary: "Brief description of your post"
---

# Your Blog Post Content

Your markdown content here...
```

3. The post will automatically appear on the blog page

### Updating Portfolio Data

Edit `src/data/resume.tsx` to update:
- Personal information
- Work experience
- Projects
- Skills
- Education
- Contact information

### Adding Images

1. Place images in the `public/` directory
2. Reference them in your code as `/image-name.png`

## 🎨 Customization

### Styling
- **Colors**: Modify `tailwind.config.ts` for theme colors
- **Components**: Edit component files in `src/components/`
- **Animations**: Customize animation parameters in Magic UI components

### Layout
- **Sections**: Add/remove sections in `src/app/page.tsx`
- **Navigation**: Update navbar links in `src/data/resume.tsx`
- **Blog**: Modify blog layout in `src/app/blog/page.tsx`

### Content
- **Portfolio**: Update all content in `src/data/resume.tsx`
- **Blog**: Add new posts in `content/` directory
- **Images**: Replace images in `public/` directory

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file for any environment-specific variables:

```env
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

### SEO Configuration
Update metadata in:
- `src/app/layout.tsx` - Global metadata
- `src/app/page.tsx` - Home page metadata
- `src/app/blog/page.tsx` - Blog page metadata
- Individual blog posts - Post-specific metadata

## 📊 Performance

This portfolio is optimized for performance with:
- **Next.js Image Optimization**: Automatic image optimization
- **Code Splitting**: Automatic code splitting for better loading
- **Static Generation**: Pre-rendered pages for fast loading
- **CDN Ready**: Optimized for content delivery networks

## 🌐 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect Next.js and deploy
3. Custom domain can be added in Vercel dashboard

### Netlify
1. Build command: `npm run build`
2. Publish directory: `out`
3. Deploy from Git repository

### Other Platforms
The site can be deployed to any platform that supports static sites or Node.js applications.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 About Me

**Kavitha Kanchan** is a Software Engineer and Entrepreneur based in Birmingham, UK. Currently working as an Associate Software Engineer at Xleron and co-founder of Rayzera INC. Specializing in:

- **Web Development**: Next.js, React, TypeScript, Node.js
- **AI Automation**: Make.com, n8n, low-code platforms
- **Cloud Services**: AWS, Docker, PostgreSQL
- **Open Source**: Active contributor to developer tools

### Connect With Me
- **Portfolio**: [kavitakanchan.com](https://kavitakanchan.com)
- **GitHub**: [@kanchana404](https://github.com/kanchana404)
- **LinkedIn**: [Kavitha Kanchana](https://www.linkedin.com/in/kavitha-kanchana)

## 🙏 Acknowledgments

- **shadcn/ui** for the beautiful component library
- **Magic UI** for the amazing animation components
- **Next.js** team for the excellent framework
- **Tailwind CSS** for the utility-first styling approach
- **Framer Motion** for smooth animations

---

⭐ **Star this repository if you found it helpful!**
#   p o r t f o l i o  
 #   p o r t f o l i o  
 