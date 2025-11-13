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
      console.log('PKCE recovery token detected, using admin API to verify...');
      
      // For PKCE recovery tokens, we can't verify them directly without code verifier
      // However, we can try to use the admin API to verify the recovery token
      // by attempting to exchange it or by using the token hash
      try {
        // For PKCE recovery tokens, try multiple approaches
        // First, try verifyOtp with the full token (including pkce_ prefix)
        let verifyData: any = null;
        let verifyError: any = null;
        
        // Try with full token first
        const result1 = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: accessToken,
        });
        verifyData = result1.data;
        verifyError = result1.error;
        
        // If that fails, try without pkce_ prefix
        if (verifyError) {
          const tokenHash = accessToken.replace(/^pkce_/, '');
          const result2 = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });
          verifyData = result2.data;
          verifyError = result2.error;
        }

        if (!verifyError && verifyData?.session?.user) {
          userId = verifyData.session.user.id;
          userEmail = verifyData.session.user.email || null;
          console.log('PKCE recovery token verified via admin verifyOtp for user:', userEmail);
        } else {
          // If verifyOtp fails, try setSession with admin client
          console.warn('verifyOtp failed, trying setSession with admin client...', verifyError?.message);
          
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: '',
          });

          if (!sessionError && sessionData?.user) {
            userId = sessionData.user.id;
            userEmail = sessionData.user.email || null;
            console.log('PKCE recovery token setSession successful with admin client for user:', userEmail);
          } else {
            // Last resort: try to use the token hash to find user via admin API
            // This is a workaround - we'll try to verify the token by attempting password reset
            // Note: This might not work, but it's worth trying
            throw new Error(verifyError?.message || sessionError?.message || 'PKCE token cannot be verified');
          }
        }
      } catch (pkceError: any) {
        console.error('PKCE token handling failed:', pkceError);
        
        // PKCE tokens cannot be verified without the code verifier
        // The solution is to configure Supabase to not use PKCE for password reset
        // OR update the email template to use the correct variables
        return NextResponse.json(
          { 
            error: 'Password reset token verification failed. This is likely because Supabase is generating PKCE tokens which require additional verification. Please update your Supabase email template to use: <a href="{{ .ConfirmationURL }}">Reset Password</a> (without adding #access_token manually), or configure Supabase to disable PKCE for password reset in Authentication → Advanced settings.',
            code: 'PKCE_VERIFICATION_FAILED',
            details: pkceError?.message || 'Token verification failed',
            solution: 'Update your password reset email template in Supabase Dashboard → Authentication → Email Templates → Reset Password to use: <a href="{{ .ConfirmationURL }}">Reset Password</a>'
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
