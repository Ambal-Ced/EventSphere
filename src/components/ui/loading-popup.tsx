"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface LoadingPopupProps {
  isOpen: boolean;
  title?: string;
  description?: string;
}

export function LoadingPopup({ 
  isOpen, 
  title = "Loading...", 
  description = "Please wait while we process your request." 
}: LoadingPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

