'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, Mail, Clock, AlertCircle } from 'lucide-react';

function EmailChangeConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [currentEmailConfirmed, setCurrentEmailConfirmed] = useState(false);
  const [newEmailConfirmed, setNewEmailConfirmed] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    const handleEmailChangeConfirmation = async () => {
      try {
        // Get tokens from URL fragment (Supabase default) or query params
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(hash.substring(1));
        const accessToken = urlParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = urlParams.get('type') || searchParams.get('type');

        console.log('Email change confirmation tokens:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });

        if (!accessToken || !refreshToken) {
          throw new Error('Missing authentication tokens');
        }

        // Set the session with the tokens
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          throw new Error('Failed to authenticate');
        }

        if (!sessionData.user) {
          throw new Error('No user found in session');
        }

        setUserEmail(sessionData.user.email || null);
        
        // Check if this is an email change confirmation
        if (type === 'email_change') {
          // This means the current email was confirmed
          setCurrentEmailConfirmed(true);
          
          // Try to get the new email from user metadata or session
          const newEmailFromMetadata = sessionData.user.user_metadata?.new_email;
          if (newEmailFromMetadata) {
            setNewEmail(newEmailFromMetadata);
          }
          
          setStatus('success');
          setMessage('Current email confirmed! Please check your new email address for the final confirmation link to complete the process.');
        } else {
          // Regular email confirmation
          setCurrentEmailConfirmed(true);
          setNewEmailConfirmed(true);
          setStatus('success');
          setMessage('Email change confirmed successfully!');
        }
        
        setIsCheckingStatus(false);

      } catch (error: any) {
        console.error('Email change confirmation error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to confirm email change. Please try again.');
        setIsCheckingStatus(false);
      }
    };

    handleEmailChangeConfirmation();
  }, [searchParams, supabase]);

  const handleContinue = () => {
    router.push('/settings');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const getStatusIcon = (confirmed: boolean, isCurrent: boolean) => {
    if (isCheckingStatus) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    if (confirmed) return <CheckCircle className="h-4 w-4 text-green-600" />;
    return <Clock className="h-4 w-4 text-yellow-500" />;
  };

  const getStatusBadge = (confirmed: boolean) => {
    if (confirmed) {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
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
            {status === 'verifying' && 'Confirming Email Change...'}
            {status === 'success' && 'Email Change Confirmed!'}
            {status === 'error' && 'Confirmation Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Please wait while we confirm your email change.'}
            {status === 'success' && 'Your email change has been processed.'}
            {status === 'error' && 'There was an issue confirming your email change.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'success' && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                  <div className="text-sm text-green-800">
                    <p className="font-medium mb-2">Next Steps:</p>
                    <p className="mb-2">{message}</p>
                  </div>
                </div>
              </div>

              {/* Email Status Tracking */}
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900 text-sm">Email Change Status</h3>
                
                {/* Current Email Status */}
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(currentEmailConfirmed, true)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Email</p>
                      <p className="text-xs text-gray-600">{userEmail}</p>
                    </div>
                  </div>
                  {getStatusBadge(currentEmailConfirmed)}
                </div>

                {/* New Email Status */}
                {newEmail && (
                  <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(newEmailConfirmed, false)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">New Email</p>
                        <p className="text-xs text-gray-600">{newEmail}</p>
                      </div>
                    </div>
                    {getStatusBadge(newEmailConfirmed)}
                  </div>
                )}

                {/* Progress Indicator */}
                <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    currentEmailConfirmed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    1
                  </div>
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    newEmailConfirmed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    2
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Current Email Confirmed</span>
                  <span>New Email Confirmed</span>
                </div>
              </div>
            </>
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
                <Button onClick={handleContinue} className="w-full">
                  Go to Settings
                </Button>
                <Button onClick={handleGoHome} variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </>
            )}
            {status === 'error' && (
              <>
                <Button onClick={() => router.push('/settings')} className="w-full">
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

export default function EmailChangeConfirmationPage() {
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
      <EmailChangeConfirmationContent />
    </Suspense>
  );
}
