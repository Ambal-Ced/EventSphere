export default function EventLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-8">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="h-8 w-3/4 bg-muted rounded"></div>
          <div className="h-4 w-1/2 bg-muted rounded"></div>
        </div>
        
        {/* Image skeleton */}
        <div className="h-64 w-full bg-muted rounded-lg"></div>
        
        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-full bg-muted rounded"></div>
          <div className="h-4 w-full bg-muted rounded"></div>
          <div className="h-4 w-3/4 bg-muted rounded"></div>
        </div>
        
        {/* Actions skeleton */}
        <div className="flex gap-4">
          <div className="h-10 w-24 bg-muted rounded"></div>
          <div className="h-10 w-24 bg-muted rounded"></div>
        </div>
      </div>
    </div>
  );
}

