import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = "1x1" } = await request.json();
    
    console.log('Image generation request:', { prompt, aspectRatio });

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.IDEOGRAM_API_KEY;
    if (!apiKey) {
      console.error('IDEOGRAM_API_KEY environment variable is not set');
      
      // For development, return a mock response
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: returning mock image URL');
        return NextResponse.json({ 
          imageUrl: 'https://via.placeholder.com/800x600/2563eb/ffffff?text=Generated+Image',
          note: 'Mock image for development. Set IDEOGRAM_API_KEY for real image generation.'
        });
      }
      
      return NextResponse.json(
        { error: 'Ideogram API key not configured. Please set IDEOGRAM_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('aspect_ratio', aspectRatio);
    formData.append('rendering_speed', 'DEFAULT');
    formData.append('magic_prompt', 'ON');

    const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ideogram API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to generate image: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Ideogram API response:', JSON.stringify(data, null, 2));
    
    // Extract the image URL from the response
    // Based on the actual Ideogram API response structure
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.image_url || data.image_url || data.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image URL in response' },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 