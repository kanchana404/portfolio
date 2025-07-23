import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../db';
import Blog from '../../../../../../db/models/Blog';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Blog ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const blog = await Blog.findById(id);

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ blog });

  } catch (error) {
    console.error('Blog fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, content, excerpt, featuredImage, generatedImageUrl, tags, isPublished } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Blog ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!title || !content || !excerpt || !featuredImage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Generate new slug if title changed
    const existingBlog = await Blog.findById(id);
    if (!existingBlog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check if new slug conflicts with other blogs
    if (slug !== existingBlog.slug) {
      const slugConflict = await Blog.findOne({ slug, _id: { $ne: id } });
      if (slugConflict) {
        return NextResponse.json(
          { error: 'A blog with this title already exists' },
          { status: 409 }
        );
      }
    }

    const updateData: any = {
      title,
      slug,
      content,
      excerpt,
      featuredImage,
      generatedImageUrl,
      tags: tags || [],
      isPublished: isPublished || false
    };

    // Handle publishedAt field
    if (isPublished && !existingBlog.isPublished) {
      updateData.publishedAt = new Date();
    } else if (!isPublished && existingBlog.isPublished) {
      updateData.publishedAt = undefined;
    }

    const blog = await Blog.findByIdAndUpdate(id, updateData, { new: true });

    return NextResponse.json({ 
      message: 'Blog updated successfully',
      blog 
    });

  } catch (error) {
    console.error('Blog update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Blog ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const blog = await Blog.findByIdAndDelete(id);

    if (!blog) {
      return NextResponse.json(
        { error: 'Blog not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Blog deleted successfully' 
    });

  } catch (error) {
    console.error('Blog deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 