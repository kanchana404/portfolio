import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../db';
import Blog from '../../../../../db/models/Blog';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Find the blog with slug "ai-innovators-summit"
    const blog = await Blog.findOne({ slug: 'ai-innovators-summit' });
    
    if (!blog) {
      return NextResponse.json(
        { success: false, error: 'Blog not found' },
        { status: 404 }
      );
    }
    
    // Update the blog to be published
    blog.isPublished = true;
    blog.publishedAt = new Date();
    await blog.save();
    
    return NextResponse.json({
      success: true,
      message: 'Blog published successfully',
      blog: {
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        isPublished: blog.isPublished,
        publishedAt: blog.publishedAt
      }
    });

  } catch (error) {
    console.error('Publish blog error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 