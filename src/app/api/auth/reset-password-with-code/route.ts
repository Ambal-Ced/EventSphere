import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { code, password } = await request.json();

    if (!code || !password) {
      return NextResponse.json(
        { error: 'Missing code or password' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Create a Supabase client with anon key to try code exchange
    // Note: PKCE codes require a code verifier which we don't have from email links
    const supabaseAnon = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Try to exchange the code for a session
    // This will fail for PKCE codes without the code verifier
    const { data: exchangeData, error: exchangeError } = await supabaseAnon.auth.exchangeCodeForSession(code);

    if (exchangeError || !exchangeData?.session?.user) {
      console.error('Code exchange failed:', exchangeError);
      console.error('Error details:', {
        message: exchangeError?.message,
        status: exchangeError?.status,
        code: exchangeError?.code
      });
      
      // Check if it's a PKCE code verifier error
      // PKCE errors typically mention "code verifier" or "both auth code and code verifier"
      const errorMessage = exchangeError?.message || '';
      const isPkceError = errorMessage.includes('code verifier') || 
                         errorMessage.includes('PKCE') ||
                         errorMessage.includes('both auth code and code verifier') ||
                         (exchangeError?.status === 400 && errorMessage.includes('invalid request'));
      
      if (isPkceError) {
        return NextResponse.json(
          { 
            error: 'This password reset link format is not supported. Password reset links with codes (?code=...) require a code verifier that is not available from email links. Please configure Supabase to use hash fragments (#access_token=...) instead, or request a new password reset link.',
            code: 'PKCE_NOT_SUPPORTED',
            details: exchangeError?.message,
            solution: 'To fix this permanently, go to Supabase Dashboard → Authentication → URL Configuration and enable "Use hash-based redirects" for password reset emails.'
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Invalid or expired password reset link. Please request a new one.',
          details: exchangeError?.message 
        },
        { status: 400 }
      );
    }

    const userId = exchangeData.session.user.id;
    const userEmail = exchangeData.session.user.email;

    console.log('Code exchanged successfully for user:', userEmail);

    // Now use service role to update password (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
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

    // Return success - user is NOT logged in (we used persistSession: false)
    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
      user: {
        id: userId,
        email: userEmail
      }
    });

  } catch (error: any) {
    console.error('Password reset with code API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

