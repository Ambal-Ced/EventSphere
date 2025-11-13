'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, Shield, Key } from 'lucide-react';

function PasswordResetConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const handlePasswordResetConfirmation = async () => {
      try {
        const hash = window.location.hash;
        console.log('Password reset confirmation page - Full hash:', hash);

        const urlParams = new URLSearchParams(hash.substring(1));
        const accessToken = urlParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = urlParams.get('type') || searchParams.get('type');
        const code = urlParams.get('code') || searchParams.get('code');

        const emailFromHash = urlParams.get('email');
        const emailFromQuery = searchParams.get('email');
        const email = emailFromHash || emailFromQuery;

        console.log('Password reset confirmation tokens:', {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken,
          type,
          code: !!code,
          email: email ?? null,
          hash: hash.substring(0, 50) + '...'
        });

        // Check for code first (PKCE codes in query params)
        if (code) {
          console.log('Recovery code detected, passing to reset password page...');
          router.replace(`/auth/reset-password?code=${encodeURIComponent(code)}&type=recovery`);
          return;
        }

        // Handle hash fragments with access_token
        if (accessToken) {
          console.log('Access token detected in hash, setting session...');
          
          // If we have both tokens, use setSession
          if (refreshToken) {
            console.log('Setting session with both access and refresh tokens...');
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              throw new Error('Failed to authenticate');
            }

            if (!sessionData?.user) {
              console.error('No user in session data:', sessionData);
              throw new Error('No user found in session');
            }

            console.log('Success! User email:', sessionData.user.email);
            setUserEmail(sessionData.user.email || null);
            setStatus('success');
            setMessage('Password reset link confirmed! You can now set your new password.');
            router.replace('/auth/reset-password?from=confirmation');
            return;
          } else {
            // Only access_token, no refresh_token - might be a PKCE token
            // Try to use it directly or redirect to reset page with the token
            console.log('Only access_token found (no refresh_token), redirecting to reset page...');
            router.replace(`/auth/reset-password?token=${encodeURIComponent(accessToken)}&type=recovery`);
            return;
          }
        }

        // No valid tokens found
        console.error('Missing tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken });
        throw new Error('Missing authentication tokens');

      } catch (error: any) {
        console.error('Password reset confirmation error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to confirm password reset. Please try again.');
      }
    };

    handlePasswordResetConfirmation();
  }, [searchParams, router]);

  const handleSetNewPassword = () => {
    router.push('/auth/reset-password');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {status === 'verifying' && <Loader2 className="h-6 w-6 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'verifying' && 'Confirming Password Reset...'}
            {status === 'success' && 'Password Reset Confirmed!'}
            {status === 'error' && 'Confirmation Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Please wait while we confirm your password reset link.'}
            {status === 'success' && 'Your password reset has been verified.'}
            {status === 'error' && 'There was an issue confirming your password reset.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-2">Next Steps:</p>
                  <p className="mb-2">{message}</p>
                  {userEmail && (
                    <p className="text-xs text-green-600">
                      Account: {userEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-800">
                <p className="font-medium mb-2">Error Details:</p>
                <p>{message}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col space-y-2">
            {status === 'success' && (
              <>
                <Button onClick={handleSetNewPassword} className="w-full">
                  <Key className="h-4 w-4 mr-2" />
                  Set New Password
                </Button>
                <Button onClick={handleGoHome} variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </>
            )}
            {status === 'error' && (
              <>
                <Button onClick={() => router.push('/reset')} className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleGoHome} variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PasswordResetConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
            <CardDescription>Please wait while we load the page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <PasswordResetConfirmationContent />
    </Suspense>
  );
}
