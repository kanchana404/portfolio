import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../db';
import Blog from '../../../../../db/models/Blog';

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    // Get all blogs (published and unpublished)
    const allBlogs = await Blog.find({}).sort({ createdAt: -1 });
    
    // Get only published blogs
    const publishedBlogs = await Blog.find({ isPublished: true }).sort({ publishedAt: -1 });
    
    return NextResponse.json({
      success: true,
      totalBlogs: allBlogs.length,
      publishedBlogs: publishedBlogs.length,
      allBlogs: allBlogs.map(blog => ({
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        isPublished: blog.isPublished,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        author: blog.author,
        tags: blog.tags
      })),
      publishedBlogsData: publishedBlogs.map(blog => ({
        id: blog._id,
        title: blog.title,
        slug: blog.slug,
        isPublished: blog.isPublished,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        author: blog.author,
        tags: blog.tags
      }))
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 