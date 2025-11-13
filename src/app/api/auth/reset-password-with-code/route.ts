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
      
      // Check if it's a PKCE code verifier error
      const isPkceError = exchangeError?.message?.includes('code verifier') || 
                         exchangeError?.message?.includes('PKCE') ||
                         exchangeError?.status === 400;
      
      if (isPkceError) {
        return NextResponse.json(
          { 
            error: 'This password reset link uses a format that is not supported. Please configure Supabase to use hash fragments (#access_token=...) instead of PKCE codes (?code=...) for password reset emails. Alternatively, please request a new password reset link.',
            code: 'PKCE_NOT_SUPPORTED',
            details: exchangeError?.message 
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

