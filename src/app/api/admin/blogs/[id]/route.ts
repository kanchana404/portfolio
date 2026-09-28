import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from "@db";
import Blog from "@db/models/Blog";
import { requireAdmin } from '@/lib/auth/admin';
import { revalidateBlog } from '@/lib/revalidate-blog';
import { slugify } from '@/lib/slug';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

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
    const denied = await requireAdmin(request);
    if (denied) return denied;

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

    // A new slug only when the title actually changed, so an edit that keeps
    // the title never moves a post's URL.
    const slug = title === existingBlog.title ? existingBlog.slug : slugify(String(title));
    if (!slug) {
      return NextResponse.json(
        { error: 'The title has no letters or digits to build a URL from' },
        { status: 400 }
      );
    }

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
    // Covers the old URL when the slug changed, and an unpublish.
    revalidateBlog();

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
    const denied = await requireAdmin(request);
    if (denied) return denied;

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
    revalidateBlog();

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