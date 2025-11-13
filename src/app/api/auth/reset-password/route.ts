export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const { password, refresh_token } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: 'Missing password' },
        { status: 400 }
      );
    }

    // Refresh token is optional - we can update password with just access token using admin API

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    let userId: string | null = null;
    let userEmail: string | null = null;

    // Check if token is a PKCE token (starts with 'pkce_')
    if (accessToken.startsWith('pkce_')) {
      console.log('PKCE token detected, attempting to exchange...');
      
      // Try to exchange PKCE token for session using anon key
      // Note: This will likely fail without code verifier, but we'll try
      try {
        // For PKCE tokens, we need to try a different approach
        // Since we don't have the code verifier, we'll try to use the admin API
        // to verify the token or extract user info
        
        // Try to set session with the PKCE token (might work for recovery tokens)
        const { data: sessionData, error: sessionError } = await supabaseAnon.auth.setSession({
          access_token: accessToken,
          refresh_token: '', // Empty refresh token
        });

        if (!sessionError && sessionData?.user) {
          userId = sessionData.user.id;
          userEmail = sessionData.user.email;
          console.log('PKCE token exchanged successfully for user:', userEmail);
        } else {
          // If setSession fails, the token might be expired or invalid
          // Try to decode the token or use admin API
          console.warn('PKCE token exchange failed, trying alternative method...');
          throw new Error('PKCE token cannot be verified without code verifier');
        }
      } catch (pkceError: any) {
        console.error('PKCE token handling failed:', pkceError);
        // For PKCE tokens, we can't verify them directly
        // Return a more helpful error message
        return NextResponse.json(
          { 
            error: 'This password reset token format is not supported. The token appears to be a PKCE token which requires additional verification. Please request a new password reset link.',
            details: 'PKCE tokens cannot be verified without the code verifier'
          },
          { status: 401 }
        );
      }
    } else {
      // Regular JWT token - verify normally
      const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
      
      if (userError || !userData.user) {
        console.error('Token verification failed:', userError);
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      userId = userData.user.id;
      userEmail = userData.user.email;
      console.log('Token verified for user:', userEmail);
    }

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'Could not identify user from token' },
        { status: 401 }
      );
    }

    // Update the user's password using admin API
    // This bypasses RLS by using the service role key
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updateError) {
      console.error('Password update failed:', updateError);
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    console.log('Password updated successfully for user:', userEmail);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
      user: {
        id: userId,
        email: userEmail
      }
    });

  } catch (error: any) {
    console.error('Password reset API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
