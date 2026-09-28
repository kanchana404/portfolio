import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectToDatabase } from "@db";
import Blog from "@db/models/Blog";
import { requireAdmin } from '@/lib/auth/admin';
import { generateImage } from '@/lib/ideogram';
import { revalidateBlog } from '@/lib/revalidate-blog';
import { slugify } from '@/lib/slug';

// `enhanceContentStructure` used to live here. It spliced incoming feed text
// into a fixed heading template and appended ~700 words of hardcoded prose,
// including a first-person sentence claiming personal experience that was
// byte-identical across every post it generated — on posts about Broadcom,
// Greece, Argentina, Australia, GPT-5 and AMD alike.
//
// Content now arrives finished from the caller. This route stores and
// attributes it; it does not write it.
//
// It also no longer generates up to four extra in-body images one after
// another. Nothing inserted them (the headings they keyed on came from the
// removed template), and five sequential generations did not fit the 15 s
// function limit. One featured image is generated; without one the post uses
// its /og card.

async function createBlogFromNews(newsData: any, slug: string) {
  const { title, link, content, date } = newsData;

  const featuredImage = await generateImage(
    `Professional news article image for: ${title}. High quality, modern, business style`,
    '3x2' // Consistent 3:2 aspect ratio for blog cards
  );

  // Stored as supplied. The caller is responsible for the words.
  let enhancedContent = content;

  // Add featured image at the top
  if (featuredImage) {
    enhancedContent = `![${title} - Featured Image](${featuredImage})\n\n` + enhancedContent;
  }

  // Create excerpt - force it to be under 300 characters for current schema
  let excerpt = content;
  if (content.length > 250) {
    excerpt = content.substring(0, 250) + '...';
  }
  // Ensure it's definitely under 300 characters
  if (excerpt.length > 300) {
    excerpt = excerpt.substring(0, 297) + '...';
  }
  
  console.log('Excerpt length:', excerpt.length);
  console.log('Excerpt:', excerpt);

  // Parse date
  const publishedDate = new Date(date);

  return {
    title,
    slug,
    content: enhancedContent,
    excerpt,
    featuredImage: featuredImage ?? undefined,
    generatedImageUrl: featuredImage ?? undefined,
    tags: ['AI', 'Technology', 'News', 'OpenAI', 'Automation', 'Software Engineering'],
    author: 'Kavitha Kanchana',
    publishedAt: publishedDate,
    // Opt in, never default. A post reaches the public because something asked
    // for it, not because nothing stopped it.
    isPublished: newsData.publish === true,
    sourceUrl: link,
    originalDate: date
  };
}

export async function POST(request: NextRequest) {
  // This endpoint writes blogs and calls the image generator, so it is
  // privileged despite not living under /api/admin.
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let body: any;

  try {
    // Parse the request body - accept any data
    body = await request.json();
    
    console.log('API: POST request received with data:', body);

    // Connect to database
    await connectToDatabase();
    console.log('API: Database connected successfully');

    // Check if this is news data (has title, link, content, date)
    if (body.title && body.link && body.content && body.date) {
      console.log('API: Detected news data, creating blog post...');
      
      try {
        const slug = slugify(String(body.title));
        if (!slug) {
          return NextResponse.json({
            success: false,
            error: 'The title has no letters or digits to build a URL from',
          }, { status: 400 });
        }

        // Checked before generating an image, so a duplicate costs nothing.
        const existingBlog = await Blog.findOne({ slug });
        if (existingBlog) {
          return NextResponse.json({
            success: false,
            error: 'Blog with this title already exists',
            slug,
            receivedData: body
          }, { status: 409 });
        }

        const blogData = await createBlogFromNews(body, slug);

        // Create and save the blog
        const newBlog = new Blog(blogData);
        const savedBlog = await newBlog.save();

        revalidateBlog();
        
        console.log('API: Blog created successfully:', savedBlog.title);
        
        return NextResponse.json({
          success: true,
          message: 'Blog created and published successfully',
          blog: {
            id: String(savedBlog._id),
            title: savedBlog.title,
            slug: savedBlog.slug,
            excerpt: savedBlog.excerpt,
            featuredImage: savedBlog.featuredImage,
            generatedImageUrl: savedBlog.generatedImageUrl,
            tags: savedBlog.tags,
            author: savedBlog.author,
            publishedAt: savedBlog.publishedAt.toISOString(),
            isPublished: savedBlog.isPublished,
            sourceUrl: savedBlog.sourceUrl
          },
          receivedData: body,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('API: Error creating blog from news data:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to create blog from news data',
          details: error instanceof Error ? error.message : 'Unknown error',
          receivedData: body
        }, { status: 500 });
      }
    }
    
    // If action is specified, handle specific actions
    if (body.action) {
      let result;

      switch (body.action) {
        case 'get_blogs':
          // Get blogs with optional filters
          const blogQuery: any = { isPublished: true };
          
          if (body.filters?.tags && body.filters.tags.length > 0) {
            blogQuery.tags = { $in: body.filters.tags };
          }
          
          if (body.filters?.author) {
            blogQuery.author = body.filters.author;
          }
          
          if (body.filters?.search) {
            blogQuery.$or = [
              { title: { $regex: body.filters.search, $options: 'i' } },
              { content: { $regex: body.filters.search, $options: 'i' } },
              { excerpt: { $regex: body.filters.search, $options: 'i' } }
            ];
          }

          const blogs = await Blog.find(blogQuery)
            .sort({ publishedAt: -1 })
            .limit(body.limit || 10)
            .skip(body.offset || 0);

          result = blogs.map(blog => ({
            id: String(blog._id),
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
          break;

        case 'get_blog_count':
          const count = await Blog.countDocuments({ isPublished: true });
          result = { count };
          break;

        case 'get_tags':
          const tags = await Blog.distinct('tags', { isPublished: true });
          result = { tags };
          break;

        case 'get_authors':
          const authors = await Blog.distinct('author', { isPublished: true });
          result = { authors };
          break;

        case 'get_recent_blogs':
          const recentBlogs = await Blog.find({ isPublished: true })
            .sort({ publishedAt: -1 })
            .limit(5);
          
          result = recentBlogs.map(blog => ({
            id: String(blog._id),
            title: blog.title,
            slug: blog.slug,
            excerpt: blog.excerpt,
            featuredImage: blog.featuredImage,
            author: blog.author,
            publishedAt: blog.publishedAt.toISOString(),
          }));
          break;

        default:
          // For unknown actions, just return the received data
          result = body;
      }

      return NextResponse.json({
        success: true,
        data: result,
        action: body.action,
        receivedData: body,
        timestamp: new Date().toISOString()
      });
    } else {
      // No action specified - just echo back the received data
      return NextResponse.json({
        success: true,
        message: 'Data received successfully',
        receivedData: body,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('API: Error processing POST request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error',
        receivedData: body || 'Could not parse request body'
      },
      { status: 500 }
    );
  }
}

// Also support GET requests for basic data retrieval
export async function GET(request: NextRequest) {
  // Guarded despite returning no records: it documents the POST action surface
  // above, which is now admin-only. An endpoint directory for a privileged API
  // is not something to hand to anonymous callers.
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    await connectToDatabase();

    // Return basic info about available endpoints
    return NextResponse.json({
      message: 'Data API endpoint',
      available_actions: [
        'get_blogs',
        'get_blog_count', 
        'get_tags',
        'get_authors',
        'get_recent_blogs'
      ],
      usage: 'Send POST request with { action: "action_name", filters: {}, limit: 10, offset: 0 }',
      example: {
        action: 'get_blogs',
        filters: { tags: ['technology'], search: 'web' },
        limit: 5,
        offset: 0
      }
    });
  } catch (error) {
    console.error('API: Error in GET request:', error);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
} 