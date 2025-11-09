"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadingWithFallbackProps {
  message?: string;
  timeout?: number; // in milliseconds
  onRefresh?: () => void;
  children?: React.ReactNode; // Custom loading content
}

export function LoadingWithFallback({
  message = "Loading...",
  timeout = 4000, // 4 seconds default
  onRefresh,
  children,
}: LoadingWithFallbackProps) {
  const [showRefresh, setShowRefresh] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRefresh(true);
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout]);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
    setShowRefresh(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-8 px-4">
      {children || (
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{message}</p>
        </div>
      )}
      
      {showRefresh && (
        <div className="mt-6 text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="text-sm text-muted-foreground">
            This is taking longer than expected.
          </p>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
      )}
    </div>
  );
}

