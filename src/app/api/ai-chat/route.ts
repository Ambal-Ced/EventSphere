export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { CohereClientV2 } from 'cohere-ai';

export async function POST(request: NextRequest) {
  try {
    const { message, context, eventId } = await request.json();

    if (!message || !context) {
      return NextResponse.json(
        { error: 'Message and context are required' },
        { status: 400 }
      );
    }

    // Get Cohere API key from environment variables
    const cohereApiKey = process.env.NEXT_PUBLIC_COHERE_API_KEY;
    
    if (!cohereApiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Initialize Cohere client
    const cohere = new CohereClientV2({
      token: cohereApiKey,
    });

    // Prepare the prompt
    const fullPrompt = `${context}\n\nUser Question: ${message}\n\nPlease provide a helpful response about this event. Keep it concise and relevant.`;

    // Call Cohere API using the SDK
    const cohereResponse = await cohere.chat({
      model: 'command-a-03-2025',
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      maxTokens: 300,
      temperature: 0.7
    });

    // Extract text from the correct nested structure
    let responseText = '';
    
    if ((cohereResponse as any).message && (cohereResponse as any).message.content) {
      const content = (cohereResponse as any).message.content;
      if (Array.isArray(content) && content.length > 0) {
        responseText = content[0].text || '';
      }
    }
    
    // Fallback to other possible locations
    if (!responseText) {
      responseText = (cohereResponse as any).text || (cohereResponse as any).content || (cohereResponse as any).response || '';
    }

    if (!responseText || typeof responseText !== 'string') {
      return NextResponse.json({ 
        response: "I received an empty response from the AI service. Please try rephrasing your question." 
      });
    }

    const response = responseText.trim();

    return NextResponse.json({ response });

  } catch (error) {
    console.error('AI chat API error:', error);
    return NextResponse.json({ 
      response: "I'm experiencing technical difficulties. Please try again in a moment." 
    });
  }
}
