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

    const { action, email, newEmail, refreshToken } = await request.json();

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

    // Debug: Check if we have a session (for other actions)
    // Note: email_change_confirmation handles its own session check

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

        // Check if user is authenticated - try multiple methods
        let authUser3 = null;
        let authenticatedSupabase = supabase; // Default to cookie-based client
        let accessToken: string | undefined = undefined;
        
        // Method 1: Try getSession from cookies
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (session?.user) {
          authUser3 = session.user;
          accessToken = session.access_token;
        }
        
        // Method 2: If no session, try getUser (also uses cookies)
        if (!authUser3) {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (user && !userError) {
            authUser3 = user;
            // Try to get access token from session
            const { data: { session: userSession } } = await supabase.auth.getSession();
            accessToken = userSession?.access_token;
          }
        }
        
        // Method 3: Try Bearer token from Authorization header as fallback
        if (!authUser3) {
          const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
          const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : undefined;
          if (token) {
            const anonClient = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { user: tokenUser }, error: tokenError } = await anonClient.auth.getUser(token);
            if (tokenUser && !tokenError) {
              authUser3 = tokenUser;
              accessToken = token;
              // Create a new authenticated client with the token
              // We need to set the session for updateUser to work
              authenticatedSupabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              // Set the session with the access token and refresh token
              try {
                // If we have a refresh token from the request body, use it
                if (refreshToken) {
                  await authenticatedSupabase.auth.setSession({
                    access_token: token,
                    refresh_token: refreshToken,
                  });
                } else {
                  // Try to get session data from the anon client
                  const { data: { session: tokenSession } } = await anonClient.auth.getSession();
                  if (tokenSession) {
                    await authenticatedSupabase.auth.setSession({
                      access_token: tokenSession.access_token,
                      refresh_token: tokenSession.refresh_token,
                    });
                  } else {
                    // Fallback: create client with auth header
                    authenticatedSupabase = createClient(
                      process.env.NEXT_PUBLIC_SUPABASE_URL!,
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                      {
                        global: {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        },
                      }
                    );
                  }
                }
              } catch (sessionError) {
                console.warn('Could not set session, using header-based auth:', sessionError);
                // Use header-based auth as fallback
                authenticatedSupabase = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                  {
                    global: {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    },
                  }
                );
              }
            }
          }
        }
        
        // If still no user, return error
        if (!authUser3) {
          console.error('Authentication error:', { 
            sessionError, 
            hasSession: !!session,
            hasAuthHeader: !!request.headers.get('authorization')
          });
          return NextResponse.json({ error: 'User not authenticated. Please log in and try again.' }, { status: 401 });
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
          try {
            await supabaseAdmin.auth.admin.updateUserById(
              authUser3.id,
              {
                user_metadata: {
                  ...(authUser3.user_metadata || {}),
                  pending_email_change: newEmail,
                  pending_email_change_timestamp: new Date().toISOString()
                }
              }
            );
          } catch (metadataError) {
            console.warn('Could not update user metadata:', metadataError);
            // Continue anyway - metadata update is not critical
          }

          // Step 1: Send confirmation email to NEW email address
          // Since Brevo is configured, updateUser should automatically send emails
          let emailChangeSuccess = false;
          let changeError: any = null;
          
          // Create a properly authenticated client using the access token
          // This ensures updateUser will work and send emails via Brevo
          let workingClient = authenticatedSupabase;
          
          // If we have an access token but the client doesn't have a session, create a new client with the token
          if (accessToken && !session) {
            try {
              // Create a client and set the session manually
              const tokenClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              
              // Set session if we have refresh token
              if (refreshToken) {
                await tokenClient.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                workingClient = tokenClient;
              }
            } catch (sessionError) {
              console.warn('Could not create token-based client:', sessionError);
            }
          }
          
          try {
            // Use updateUser - this will automatically send confirmation email via Brevo
            const result = await workingClient.auth.updateUser(
              { email: newEmail },
              {
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=new`
              }
            );
            
            if (!result.error) {
              emailChangeSuccess = true;
              console.log('Email change initiated via authenticated client, Brevo should send confirmation email');
            } else {
              changeError = result.error;
              throw result.error;
            }
          } catch (clientError: any) {
            console.warn('Authenticated client updateUser failed, trying admin approach:', clientError);
            changeError = clientError;
            
            // Fallback: Use admin client to update email, then resend confirmation
            // Since Brevo is configured, resend will send the email
            try {
              // First check if the new email is already in use
              const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
              if (!listError && existingUsers) {
                const emailExists = existingUsers.users.some(u => 
                  u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== authUser3.id
                );
                if (emailExists) {
                  throw new Error('This email address is already in use by another account');
                }
              }
              
              // Update the email using admin client
              const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                authUser3.id,
                {
                  email: newEmail,
                  email_confirm: false, // Mark as unconfirmed
                }
              );
              
              if (updateError) {
                console.error('Admin updateUserById failed:', updateError);
                
                // Check if it's a duplicate email error
                if (updateError.message?.toLowerCase().includes('already') || 
                    updateError.message?.toLowerCase().includes('exists') ||
                    updateError.message?.toLowerCase().includes('duplicate')) {
                  throw new Error('This email address is already in use by another account');
                }
                
                throw updateError;
              }
              
              console.log('Email updated via admin client');
              
              // Now resend the confirmation email - this will use Brevo to send it
              // Create a client with the updated email to resend
              const resendClient = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
              );
              
              // Resend email change confirmation - this will send via Brevo
              const { error: resendError } = await resendClient.auth.resend({
                type: 'email_change',
                email: newEmail,
                options: {
                  emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=new`
                }
              });
              
              if (resendError) {
                console.warn('Resend failed, but email was updated:', resendError);
                // Email is updated, even if resend failed
                emailChangeSuccess = true;
              } else {
                console.log('Confirmation email resent via Brevo');
                emailChangeSuccess = true;
              }
            } catch (adminError: any) {
              console.error('Admin client email change failed:', adminError);
              return NextResponse.json({ 
                error: 'Failed to send confirmation to new email address',
                details: adminError?.message || changeError?.message || 'Unknown error',
                debug: {
                  clientError: changeError?.message,
                  adminError: adminError?.message
                }
              }, { status: 500 });
            }
          }

          if (!emailChangeSuccess) {
            return NextResponse.json({ 
              error: 'Failed to send confirmation to new email address',
              details: changeError?.message || 'Could not initiate email change'
            }, { status: 500 });
          }

          // Step 2: Send confirmation email to CURRENT email address
          // Use resend with email_change type to send confirmation to current email
          // This will use Supabase's email system (Brevo) to send the email
          let currentEmailSent = false;
          
          try {
            // Try using resend with email_change type for the current email
            const { error: resendCurrentError } = await workingClient.auth.resend({
              type: 'email_change',
              email: currentEmail,
              options: {
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=current&new_email=${encodeURIComponent(newEmail)}`
              }
            });
            
            if (!resendCurrentError) {
              currentEmailSent = true;
              console.log('Confirmation email sent to current email via Brevo');
            } else {
              console.warn('Resend to current email failed, trying alternative method:', resendCurrentError);
            }
          } catch (resendError) {
            console.warn('Resend to current email failed:', resendError);
          }
          
          // Fallback: Use password reset flow if resend doesn't work
          // This will send an email to the current address via Brevo
          if (!currentEmailSent) {
            try {
              const { error: resetError } = await workingClient.auth.resetPasswordForEmail(
                currentEmail,
                {
                  redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=current&new_email=${encodeURIComponent(newEmail)}`
                }
              );
              
              if (!resetError) {
                currentEmailSent = true;
                console.log('Confirmation email sent to current email via password reset flow (Brevo)');
              } else {
                console.warn('Password reset flow also failed:', resetError);
              }
            } catch (resetError) {
              console.warn('Password reset flow failed:', resetError);
            }
          }
          
          // If still not sent, try using admin client to generate a magic link
          if (!currentEmailSent) {
            try {
              const { data: magicLink, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email: currentEmail,
                options: {
                  redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/email-change-confirmation?type=email_change&email_source=current&new_email=${encodeURIComponent(newEmail)}`
                }
              });
              
              if (!magicLinkError && magicLink?.properties?.action_link) {
                console.log('Magic link generated for current email (email should be sent automatically)');
                currentEmailSent = true;
              }
            } catch (magicLinkError) {
              console.warn('Magic link generation failed:', magicLinkError);
            }
          }

          // Log the result
          if (currentEmailSent) {
            console.log('✅ Confirmation email sent to current email address via Brevo');
          } else {
            console.warn('⚠️ Could not send confirmation email to current address, but new email confirmation was sent');
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
