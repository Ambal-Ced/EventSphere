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
      console.log('PKCE recovery token detected, attempting to verify...');
      
      // For PKCE recovery tokens, try setSession first (recovery tokens might work without refresh_token)
      // Then fall back to verifyOtp if needed
      try {
        // First, try setSession with the PKCE token (recovery tokens sometimes work this way)
        console.log('Trying setSession with PKCE recovery token...');
        const { data: sessionData, error: sessionError } = await supabaseAnon.auth.setSession({
          access_token: accessToken,
          refresh_token: '', // Empty refresh token - recovery tokens might work without it
        });

        if (!sessionError && sessionData?.user) {
          userId = sessionData.user.id;
          userEmail = sessionData.user.email || null;
          console.log('PKCE recovery token setSession successful for user:', userEmail);
        } else {
          // If setSession fails, try verifyOtp as fallback
          console.warn('setSession failed, trying verifyOtp...', sessionError?.message);
          
          // Try verifyOtp with the token (remove pkce_ prefix)
          const tokenHash = accessToken.replace(/^pkce_/, '');
          const { data: verifyData, error: verifyError } = await supabaseAnon.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });

          if (!verifyError && verifyData?.session?.user) {
            userId = verifyData.session.user.id;
            userEmail = verifyData.session.user.email || null;
            console.log('PKCE recovery token verified via verifyOtp for user:', userEmail);
          } else {
            throw new Error(sessionError?.message || verifyError?.message || 'PKCE token verification failed');
          }
        }
      } catch (pkceError: any) {
        console.error('PKCE token handling failed:', pkceError);
        return NextResponse.json(
          { 
            error: 'Invalid or expired password reset token. Please request a new password reset link.',
            details: pkceError?.message || 'Token verification failed'
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
      userEmail = userData.user.email || null;
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
