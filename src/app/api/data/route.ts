import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../db';
import Blog from '../../../../db/models/Blog';

// Function to generate image using the existing image generation API
async function generateImage(prompt: string): Promise<string> {
  try {
    // Get the base URL for the current environment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   'https://kavithakanchana.me' ||
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                   'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/admin/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        aspectRatio: '3x2' // Consistent 3:2 aspect ratio for blog cards
      })
    });

    if (!response.ok) {
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result.imageUrl || result.url || '';
  } catch (error) {
    console.error('Error generating image:', error);
    // Return a placeholder image URL for production fallback
    if (process.env.NODE_ENV === 'production') {
      return 'https://via.placeholder.com/1200x800/2563eb/ffffff?text=AI+Generated+Image';
    }
    return '';
  }
}

// Function to analyze content and determine optimal image count
function analyzeContentForImages(content: string) {
  const wordCount = content.split(' ').length;
  const paragraphCount = content.split('.').filter((p: string) => p.trim().length > 10).length;
  
  // Determine optimal number of images based on content length
  // Enhanced to support more images for comprehensive content
  if (wordCount < 100 || paragraphCount < 3) {
    return 0; // No additional images for very short content
  } else if (wordCount < 300 || paragraphCount < 5) {
    return 2; // Two images for short content (enhanced)
  } else if (wordCount < 600 || paragraphCount < 8) {
    return 3; // Three images for medium content (enhanced)
  } else {
    return 4; // Four images for long content (enhanced)
  }
}

// Function to enhance content with better structure and writing
function enhanceContentStructure(originalContent: string, title: string, link: string) {
  const paragraphs = originalContent.split('. ').filter((p: string) => p.trim().length > 0);
  
  // Create enhanced content with better structure
  let enhancedContent = '';
  
  // Add title
  enhancedContent += `# ${title}\n\n`;
  
  // Add introduction section
  enhancedContent += `## Introduction\n\n`;
  if (paragraphs.length > 0) {
    enhancedContent += `${paragraphs[0]}.\n\n`;
  }
  
  // Add background context
  enhancedContent += `## Background & Context\n\n`;
  enhancedContent += `This development represents a significant milestone in the intersection of artificial intelligence and economic policy. As AI continues to reshape industries and economies worldwide, strategic frameworks like this blueprint provide essential guidance for nations seeking to harness AI's transformative potential while ensuring sustainable and inclusive growth. From my experience in AI/ML integration and automation solutions, I can see how these initiatives align with the broader trend of intelligent systems transforming business processes and decision-making frameworks.\n\n`;
  
  // Add main content section
  enhancedContent += `## Key Insights & Analysis\n\n`;
  
  // Add middle paragraphs with better flow
  const middleParagraphs = paragraphs.slice(1, Math.max(2, paragraphs.length - 1));
  for (let i = 0; i < middleParagraphs.length; i++) {
    enhancedContent += `${middleParagraphs[i]}.\n\n`;
  }
  
  // Add detailed analysis section
  enhancedContent += `## Detailed Analysis\n\n`;
  enhancedContent += `### Economic Impact\n\n`;
  enhancedContent += `The implementation of AI-driven economic strategies has the potential to significantly boost productivity across various sectors. By leveraging artificial intelligence for data analysis, automation, and decision-making processes, organizations can achieve unprecedented levels of efficiency and innovation.\n\n`;
  
  enhancedContent += `### Technological Considerations\n\n`;
  enhancedContent += `Modern AI systems require robust infrastructure, skilled workforce, and ethical frameworks to ensure responsible deployment. The blueprint addresses these critical aspects, providing a comprehensive roadmap for sustainable AI integration. Drawing from my experience with n8n and Make.com automation platforms, I can see how workflow automation and intelligent systems can significantly enhance the implementation of such AI-driven strategies.\n\n`;
  
  enhancedContent += `### Implementation Strategy\n\n`;
  enhancedContent += `Successful implementation requires collaboration between government entities, private sector organizations, and educational institutions. The blueprint outlines specific steps for fostering these partnerships and creating an ecosystem conducive to AI-driven growth. As a software engineer specializing in AI/ML solutions and automation, I believe the key to successful implementation lies in creating scalable, intelligent systems that can adapt to evolving requirements while maintaining efficiency and reliability.\n\n`;
  
  // Add future implications
  enhancedContent += `## Future Implications\n\n`;
  enhancedContent += `### Short-term Benefits\n\n`;
  enhancedContent += `In the immediate future, this initiative is expected to accelerate digital transformation efforts, improve operational efficiency, and create new opportunities for innovation across various industries. Based on my experience with AI-powered applications and automation workflows, I can see how these technologies can immediately enhance productivity and streamline complex business processes.\n\n`;
  
  enhancedContent += `### Long-term Vision\n\n`;
  enhancedContent += `Looking ahead, the comprehensive adoption of AI technologies promises to revolutionize how we approach economic development, problem-solving, and resource allocation. This blueprint serves as a foundational document for building a more intelligent and adaptive economic system. From my work on AI-powered SaaS applications and intelligent automation systems, I can envision how these technologies will continue to evolve and create new opportunities for innovation and growth.\n\n`;
  
  // Add conclusion section
  enhancedContent += `## Conclusion\n\n`;
  if (paragraphs.length > 1) {
    enhancedContent += `${paragraphs[paragraphs.length - 1]}.\n\n`;
  }
  enhancedContent += `This initiative represents a forward-thinking approach to economic development in the AI era. By providing clear guidelines and strategic frameworks, it enables stakeholders to navigate the complexities of AI integration while maximizing its benefits for society as a whole. As someone deeply involved in AI/ML development and automation solutions, I believe these frameworks will be crucial for building the next generation of intelligent systems and applications.\n\n`;
  
  // Add additional resources
  enhancedContent += `## Additional Resources\n\n`;
  enhancedContent += `For more information about AI implementation strategies and economic development frameworks, consider exploring:\n\n`;
  enhancedContent += `- **AI Policy Guidelines**: Best practices for responsible AI deployment\n`;
  enhancedContent += `- **Economic Impact Studies**: Research on AI's influence on various sectors\n`;
  enhancedContent += `- **Implementation Case Studies**: Real-world examples of successful AI integration\n`;
  enhancedContent += `- **Future Trends**: Emerging developments in AI technology and applications\n`;
  enhancedContent += `- **Automation Solutions**: Workflow automation with n8n and Make.com\n`;
  enhancedContent += `- **AI/ML Integration**: Building intelligent applications and systems\n\n`;
  
  // Add source attribution
  enhancedContent += `---\n\n`;
  enhancedContent += `**Source:** [Read the original article](${link})\n\n`;
  enhancedContent += `*This article was automatically generated and enhanced with AI-generated images and comprehensive analysis.*`;
  
  return enhancedContent;
}

// Function to create a blog from news data
async function createBlogFromNews(newsData: any) {
  const { title, link, content, date } = newsData;
  
  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  // Analyze content to determine optimal image count
  const optimalImageCount = analyzeContentForImages(content);
  console.log(`Content analysis: ${content.split(' ').length} words, ${content.split('.').filter((p: string) => p.trim().length > 10).length} paragraphs, ${optimalImageCount} images needed`);
  
  // Generate main featured image
  const featuredImage = await generateImage(`Professional news article image for: ${title}. High quality, modern, business style`);
  
  // Generate additional images only if needed
  const additionalImages = [];
  if (optimalImageCount > 0) {
    const imagePrompts = [
      `Illustration showing AI technology and economic growth for: ${title}`,
      `Modern business and technology concept for: ${title}`,
      `Professional corporate image representing: ${title}`,
      `Data visualization and analytics concept for: ${title}`,
      `Collaboration and partnership visualization for: ${title}`,
      `Future technology and innovation concept for: ${title}`
    ];
    
    // Only generate the number of images we actually need
    for (let i = 0; i < optimalImageCount; i++) {
      const imageUrl = await generateImage(imagePrompts[i]);
      if (imageUrl) {
        additionalImages.push(imageUrl);
      }
    }
  }
  
  // Enhance content structure first
  let enhancedContent = enhanceContentStructure(content, title, link);
  
  // Insert images at strategic points based on content length
  if (additionalImages.length > 0) {
    const paragraphs = content.split('. ').filter((p: string) => p.trim().length > 0);
    const insertionPoints = [];
    
    // Calculate strategic insertion points
    if (additionalImages.length === 1) {
      insertionPoints.push(Math.floor(paragraphs.length / 2));
    } else if (additionalImages.length === 2) {
      insertionPoints.push(Math.floor(paragraphs.length / 3));
      insertionPoints.push(Math.floor((paragraphs.length * 2) / 3));
    } else if (additionalImages.length === 3) {
      insertionPoints.push(Math.floor(paragraphs.length / 4));
      insertionPoints.push(Math.floor(paragraphs.length / 2));
      insertionPoints.push(Math.floor((paragraphs.length * 3) / 4));
    }
    
    // Insert images at strategic points in the enhanced content
    let currentImageIndex = 0;
    const contentParts = enhancedContent.split('\n\n');
    const newContentParts = [];
    
    for (let i = 0; i < contentParts.length; i++) {
      newContentParts.push(contentParts[i]);
      
      // Insert images after specific sections
      if (contentParts[i].startsWith('## Key Insights & Analysis') && additionalImages.length > 0) {
        newContentParts.push(`![${title} - AI Technology Impact](${additionalImages[0]})\n`);
        currentImageIndex++;
      } else if (contentParts[i].startsWith('### Economic Impact') && additionalImages.length > 1) {
        newContentParts.push(`![${title} - Economic Growth](${additionalImages[1]})\n`);
        currentImageIndex++;
      } else if (contentParts[i].startsWith('### Implementation Strategy') && additionalImages.length > 2) {
        newContentParts.push(`![${title} - Collaboration & Partnership](${additionalImages[2]})\n`);
        currentImageIndex++;
      } else if (contentParts[i].startsWith('## Future Implications') && additionalImages.length > 3) {
        newContentParts.push(`![${title} - Future Technology](${additionalImages[3]})\n`);
        currentImageIndex++;
      }
    }
    
    enhancedContent = newContentParts.join('\n\n');
  }
  
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
    featuredImage,
    generatedImageUrl: featuredImage,
    tags: ['AI', 'Technology', 'News', 'OpenAI', 'Automation', 'Software Engineering'],
    author: 'Kavitha Kanchana',
    publishedAt: publishedDate,
    isPublished: true,
    sourceUrl: link,
    originalDate: date
  };
}

export async function POST(request: Request) {
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
        // Create blog from news data
        const blogData = await createBlogFromNews(body);
        
        // Check if blog with same slug already exists
        const existingBlog = await Blog.findOne({ slug: blogData.slug });
        if (existingBlog) {
          return NextResponse.json({
            success: false,
            error: 'Blog with this title already exists',
            slug: blogData.slug,
            receivedData: body
          }, { status: 409 });
        }
        
        // Create and save the blog
        const newBlog = new Blog(blogData);
        const savedBlog = await newBlog.save();
        
        console.log('API: Blog created successfully:', savedBlog.title);
        
        return NextResponse.json({
          success: true,
          message: 'Blog created and published successfully',
          blog: {
            id: savedBlog._id.toString(),
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
            id: blog._id.toString(),
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
export async function GET() {
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