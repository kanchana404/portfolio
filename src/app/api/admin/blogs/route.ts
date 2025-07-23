import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../db';
import Blog from '../../../../../db/models/Blog';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, excerpt, featuredImage, generatedImageUrl, tags, isPublished } = body;

    // Validate required fields
    if (!title || !content || !excerpt || !featuredImage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if blog with same slug already exists
    const existingBlog = await Blog.findOne({ 
      slug: title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim() 
    });

    if (existingBlog) {
      return NextResponse.json(
        { error: 'A blog with this title already exists' },
        { status: 409 }
      );
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const blogData: any = {
      title,
      slug,
      content,
      excerpt,
      featuredImage,
      generatedImageUrl,
      tags: tags || [],
      isPublished: isPublished || false
    };

    // Only set publishedAt if the blog is being published
    if (isPublished) {
      blogData.publishedAt = new Date();
    }

    const blog = new Blog(blogData);

    await blog.save();

    return NextResponse.json({ 
      message: 'Blog created successfully',
      blog 
    }, { status: 201 });

  } catch (error) {
    console.error('Blog creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const published = searchParams.get('published');
    
    let query = {};
    if (published === 'true') {
      query = { isPublished: true };
    } else if (published === 'false') {
      query = { isPublished: false };
    }

    const blogs = await Blog.find(query).sort({ createdAt: -1 });
    
    return NextResponse.json({ blogs });

  } catch (error) {
    console.error('Blog fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 