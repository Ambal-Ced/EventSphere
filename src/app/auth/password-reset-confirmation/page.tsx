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
        const code = searchParams.get('code');

        console.log('Password reset confirmation tokens:', {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken,
          type,
          code: !!code,
          hash: hash.substring(0, 50) + '...'
        });

        if (code) {
          console.log('Verifying recovery code via verifyOtp...');
          const { data: verification, error: verifyError } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: code,
          });

          if (verifyError) {
            console.error('Code verification error:', verifyError);
            throw new Error(verifyError.message || 'Failed to authenticate');
          }

          const sessionUser = verification?.session?.user;
          if (!sessionUser) {
            throw new Error('No user found in session');
          }

          console.log('Recovery code verified for:', sessionUser.email);
          setUserEmail(sessionUser.email || null);
          setStatus('success');
          setMessage('Password reset link confirmed! You can now set your new password.');
          router.replace('/auth/reset-password?from=confirmation');
          return;
        }

        if (!accessToken || !refreshToken) {
          console.error('Missing tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken });
          throw new Error('Missing authentication tokens');
        }

        console.log('Setting session with tokens...');
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        console.log('Session result:', { sessionData: !!sessionData, sessionError });

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error('Failed to authenticate');
        }

        if (!sessionData.user) {
          console.error('No user in session data:', sessionData);
          throw new Error('No user found in session');
        }

        console.log('Success! User email:', sessionData.user.email);
        setUserEmail(sessionData.user.email || null);
        setStatus('success');

        if (type === 'recovery') {
          setMessage('Password reset link confirmed! You can now set your new password.');
        } else {
          setMessage('Password reset confirmed successfully!');
        }

        router.replace('/auth/reset-password?from=confirmation');

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
