export default function EventsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        {/* Search and filters skeleton */}
        <div className="flex gap-4">
          <div className="h-10 flex-1 bg-muted rounded"></div>
          <div className="h-10 w-32 bg-muted rounded"></div>
        </div>
        
        {/* Events grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-48 w-full bg-muted rounded-lg"></div>
              <div className="h-6 w-3/4 bg-muted rounded"></div>
              <div className="h-4 w-full bg-muted rounded"></div>
              <div className="h-4 w-2/3 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

