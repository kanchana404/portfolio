import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { generateImage } from '@/lib/ideogram';

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { prompt, aspectRatio = "1x1" } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Said plainly instead of answering with a placeholder URL that the
    // editor would then save into the post.
    if (!process.env.IDEOGRAM_API_KEY) {
      return NextResponse.json(
        { error: 'Image generation is not configured (IDEOGRAM_API_KEY is not set).' },
        { status: 503 }
      );
    }

    const imageUrl = await generateImage(prompt, aspectRatio);
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
