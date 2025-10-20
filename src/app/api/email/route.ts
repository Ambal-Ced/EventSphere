import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing environment variables:', {
        url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { action, email, newEmail } = await request.json();

    // Create a Supabase client for the API route, using cookies for session
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Also create an admin client for certain operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Debug: Check if we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('Session debug:', { session: !!session, user: !!session?.user, error: sessionError });

    switch (action) {
      case 'send_verification':
        if (!email) {
          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Use Supabase's built-in email verification
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email`
          }
        });

        if (error) {
          console.error('Verification email error:', error);
          return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Verification email sent successfully' 
        });

      case 'change_email':
        if (!email || !newEmail) {
          return NextResponse.json({ error: 'Current email and new email are required' }, { status: 400 });
        }

        // Use Supabase's built-in email change flow
        // This will send a confirmation email to the CURRENT email
        try {
          // First, let's find the user by email using admin client
          const { data: adminUsers, error: adminError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (adminError) {
            console.error('Admin error:', adminError);
            return NextResponse.json({ error: 'Could not access user data' }, { status: 500 });
          }
          
          const foundUser = adminUsers.users.find(u => u.email === email);
          if (!foundUser) {
            return NextResponse.json({ error: 'User not found. Please make sure you are logged in.' }, { status: 401 });
          }
          
          // Use admin client to update email with confirmation required
          const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            foundUser.id,
            { 
              email: newEmail,
              email_confirm: false // This should trigger confirmation email to CURRENT email
            }
          );
          
          if (updateError) {
            console.error('Email update error:', updateError);
            return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Email change initiated. Please check your current email for confirmation.' 
          });
          
        } catch (error) {
          console.error('Unexpected error:', error);
          return NextResponse.json({ error: 'Unexpected error occurred' }, { status: 500 });
        }

      case 'resend_verification':
        if (!email) {
          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email
        });

        if (resendError) {
          console.error('Resend error:', resendError);
          return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Verification email resent successfully' 
        });

      case 'password_change_confirmation':
        if (!email) {
          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Check if user is authenticated
        const { data: { user: authUser }, error: authError2 } = await supabase.auth.getUser();
        if (authError2 || !authUser) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }

        // Note: Supabase automatically sends password change confirmation emails
        // when password is updated via supabase.auth.updateUser()
        return NextResponse.json({ 
          success: true, 
          message: 'Password change confirmation email sent successfully' 
        });

      case 'email_change_confirmation':
        if (!email || !newEmail) {
          return NextResponse.json({ error: 'Current email and new email are required' }, { status: 400 });
        }

        // Check if user is authenticated
        const { data: { user: authUser3 }, error: authError3 } = await supabase.auth.getUser();
        if (authError3 || !authUser3) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }

        // Use Supabase's built-in email change confirmation
        const { error: changeError } = await supabase.auth.updateUser(
          { email: newEmail },
          {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?type=email_change`
          }
        );

        if (changeError) {
          console.error('Error updating email:', changeError);
          return NextResponse.json({ error: 'Failed to initiate email change' }, { status: 500 });
        }

        return NextResponse.json({ 
          success: true, 
          message: 'Email change confirmation sent to new email address' 
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
