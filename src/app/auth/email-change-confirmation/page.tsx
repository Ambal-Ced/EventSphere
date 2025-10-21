'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

function EmailChangeConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Forward all variants to the unified verifier, preserving the hash/query
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const query = searchParams.toString();

    if (hash && hash.length > 1) {
      router.replace(`/auth/verify-email${hash}`);
    } else if (query) {
      router.replace(`/auth/verify-email?${query}`);
    } else {
      router.replace('/auth/verify-email');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Redirecting…</CardTitle>
          <CardDescription>Taking you to the email verification page.</CardDescription>
        </CardHeader>
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
