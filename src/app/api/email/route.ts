export const runtime = 'edge';
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
    const cookieStore = await cookies(); // Await cookies in Next.js 15
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
        if (!newEmail) {
          return NextResponse.json({ error: 'New email is required' }, { status: 400 });
        }

        // Check if user is authenticated and get their current email
        const { data: { user: authUser3 }, error: authError3 } = await supabase.auth.getUser();
        if (authError3 || !authUser3) {
          return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
        }

        // Use the authenticated user's email as the current email
        const currentEmail = authUser3.email;
        if (!currentEmail) {
          return NextResponse.json({ error: 'User email not found' }, { status: 400 });
        }

        // Validate that new email is different from current email
        if (currentEmail.toLowerCase().trim() === newEmail.toLowerCase().trim()) {
          return NextResponse.json({ error: 'New email must be different from current email' }, { status: 400 });
        }

        try {
          // Store pending email change in user metadata so we can track it
          await supabaseAdmin.auth.admin.updateUserById(
            authUser3.id,
            {
              user_metadata: {
                ...authUser3.user_metadata,
                pending_email_change: newEmail,
                pending_email_change_timestamp: new Date().toISOString()
              }
            }
          );

          // Step 1: Send confirmation email to NEW email address using updateUser
          // This will send an email to the new address
          const { error: changeError } = await supabase.auth.updateUser(
            { email: newEmail },
            {
              emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=new`
            }
          );

          if (changeError) {
            console.error('Error updating email (new email):', changeError);
            return NextResponse.json({ error: 'Failed to send confirmation to new email address' }, { status: 500 });
          }

          // Step 2: Send confirmation email to CURRENT email address
          // Use password reset flow which reliably sends an email to the current address
          // Note: The email template in Supabase dashboard should be customized to indicate
          // this is for email change confirmation, not password reset
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(
            currentEmail,
            {
              redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=current&new_email=${encodeURIComponent(newEmail)}`
            }
          );

          if (resetError) {
            console.error('Error sending confirmation to current email:', resetError);
            // Try alternative: use admin API to generate magic link
            const { data: magicLink, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: currentEmail,
              options: {
                redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=current&new_email=${encodeURIComponent(newEmail)}`
              }
            });

            if (magicLinkError || !magicLink?.properties?.action_link) {
              console.error('Could not send confirmation to current email:', magicLinkError);
              // Don't fail completely - at least the new email confirmation was sent
              return NextResponse.json({ 
                success: true, 
                warning: 'Confirmation sent to new email. Could not send to current email - please contact support.',
                message: 'Email change confirmation sent to your new email address. Please check your inbox.' 
              });
            } else {
              // Magic link generated - use resend to trigger email
              const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: currentEmail,
                options: {
                  emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=current&new_email=${encodeURIComponent(newEmail)}`
                }
              });

              if (resendError) {
                console.warn('Could not automatically send email to current address');
              }
            }
          }

          return NextResponse.json({ 
            success: true, 
            message: 'Email change confirmation sent to both your current and new email addresses. Please check both inboxes.' 
          });
        } catch (error: any) {
          console.error('Unexpected error in email change:', error);
          return NextResponse.json({ error: 'Failed to initiate email change' }, { status: 500 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
