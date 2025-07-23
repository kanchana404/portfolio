import fs from "fs";
import matter from "gray-matter";
import path from "path";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { connectToDatabase } from "../../db";
import Blog from "../../db/models/Blog";

type Metadata = {
  title: string;
  publishedAt: string;
  summary: string;
  image?: string;
};

function getMDXFiles(dir: string) {
  return fs.readdirSync(dir).filter((file) => path.extname(file) === ".mdx");
}

export async function markdownToHTML(markdown: string) {
  const p = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      // https://rehype-pretty.pages.dev/#usage
      theme: {
        light: "min-light",
        dark: "min-dark",
      },
      keepBackground: false,
    })
    .use(rehypeStringify)
    .process(markdown);

  return p.toString();
}

export async function getPost(slug: string) {
  // First try to get from MongoDB
  try {
    await connectToDatabase();
    const blog = await Blog.findOne({ slug, isPublished: true });
    
    if (blog) {
      return {
        source: blog.content,
        metadata: {
          title: blog.title,
          publishedAt: blog.publishedAt.toISOString(),
          summary: blog.excerpt,
          image: blog.featuredImage,
          tags: blog.tags,
          author: blog.author,
        },
        slug: blog.slug,
      };
    }
  } catch (error) {
    console.error('Error fetching from MongoDB:', error);
  }

  // Only fallback to MDX files if there's no database blog found
  // This ensures database content takes priority
  return null;
}

async function getAllPosts(dir: string) {
  let mdxFiles = getMDXFiles(dir);
  return Promise.all(
    mdxFiles.map(async (file) => {
      let slug = path.basename(file, path.extname(file));
      let post = await getPost(slug);
      if (post) {
        return {
          metadata: post.metadata,
          slug: post.slug,
          source: post.source,
        };
      }
      return null;
    }),
  ).then(posts => posts.filter(Boolean));
}

export async function getBlogPosts() {
  // First try to get from MongoDB
  try {
    console.log('Attempting to connect to database...');
    await connectToDatabase();
    console.log('Database connected successfully');
    
    const blogs = await Blog.find({ isPublished: true }).sort({ publishedAt: -1 });
    console.log(`Found ${blogs.length} published blogs in database`);
    
    // Always return database blogs if they exist, even if empty
    const result = blogs.map(blog => ({
      metadata: {
        title: blog.title,
        publishedAt: blog.publishedAt.toISOString(),
        summary: blog.excerpt,
        image: blog.featuredImage,
        tags: blog.tags,
        author: blog.author,
      },
      slug: blog.slug,
      source: blog.content,
    }));
    
    console.log('Returning database blogs:', result.length);
    return result;
  } catch (error) {
    console.error('Error fetching from MongoDB:', error);
    console.log('Falling back to MDX files due to database error');
    // Only fallback to MDX files if there's a database error
    return getAllPosts(path.join(process.cwd(), "content"));
  }
}

export async function getBlogs() {
  try {
    console.log('Attempting to connect to database...');
    await connectToDatabase();
    console.log('Database connected successfully');
    
    const blogs = await Blog.find({ isPublished: true }).sort({ publishedAt: -1 });
    console.log(`Found ${blogs.length} published blogs in database`);
    
    // Return blogs in the format expected by the client component
    const result = blogs.map(blog => ({
      id: blog._id.toString(),
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      content: blog.content,
      featuredImage: blog.featuredImage,
      generatedImageUrl: blog.generatedImageUrl,
      tags: blog.tags,
      author: blog.author,
      publishedAt: blog.publishedAt.toISOString(),
      isPublished: blog.isPublished,
    }));
    
    console.log('Returning database blogs:', result.length);
    return result;
  } catch (error) {
    console.error('Error fetching from MongoDB:', error);
    console.log('Returning empty array due to database error');
    return [];
  }
}
