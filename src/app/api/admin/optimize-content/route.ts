import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { content, type = 'general' } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    // Define optimization prompts based on type
    const optimizationPrompts = {
      general: `Please optimize the following blog content for better readability, SEO, and engagement. Make it more engaging, fix any grammar issues, and improve the overall flow while maintaining the original message:

Content: "${content}"

Please return only the optimized content without any additional explanations.`,
      
      technical: `Please optimize the following technical blog content for clarity, accuracy, and better explanation. Make it more accessible to readers while maintaining technical accuracy:

Content: "${content}"

Please return only the optimized content without any additional explanations.`,
      
      seo: `Please optimize the following blog content for SEO. Improve keyword usage, readability, and structure while maintaining the original message:

Content: "${content}"

Please return only the optimized content without any additional explanations.`
    };

    const prompt = optimizationPrompts[type as keyof typeof optimizationPrompts] || optimizationPrompts.general;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to optimize content: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const optimizedContent = data.choices?.[0]?.message?.content;

    if (!optimizedContent) {
      return NextResponse.json(
        { error: 'No optimized content in response' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      optimizedContent,
      originalLength: content.length,
      optimizedLength: optimizedContent.length
    });

  } catch (error) {
    console.error('Content optimization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 