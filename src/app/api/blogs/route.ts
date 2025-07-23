import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../db';
import Blog from '../../../../db/models/Blog';

export async function GET() {
  try {
    console.log('API: Attempting to connect to database...');
    await connectToDatabase();
    console.log('API: Database connected successfully');
    
    const blogs = await Blog.find({ isPublished: true }).sort({ publishedAt: -1 });
    console.log(`API: Found ${blogs.length} published blogs in database`);
    
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
    
    console.log('API: Returning database blogs:', result.length);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API: Error fetching from MongoDB:', error);
    return NextResponse.json({ error: 'Failed to fetch blogs' }, { status: 500 });
  }
} 