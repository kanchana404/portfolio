import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../db';
import Blog from '../../../../../db/models/Blog';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    console.log('API: Attempting to connect to database...');
    await connectToDatabase();
    console.log('API: Database connected successfully');
    
    const blog = await Blog.findOne({ slug: params.slug, isPublished: true });
    
    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }
    
    console.log(`API: Found blog: ${blog.title}`);
    
    // Return blog in the format expected by the client component
    const result = {
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
    };
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('API: Error fetching blog from MongoDB:', error);
    return NextResponse.json({ error: 'Failed to fetch blog' }, { status: 500 });
  }
} 