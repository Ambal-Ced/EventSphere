export default function HomeLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-8">
        {/* Hero section skeleton */}
        <div className="space-y-4">
          <div className="h-12 w-3/4 bg-muted rounded"></div>
          <div className="h-6 w-1/2 bg-muted rounded"></div>
        </div>
        
        {/* Featured events skeleton */}
        <div className="space-y-4">
          <div className="h-8 w-1/4 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <div className="h-48 w-full bg-muted rounded-lg"></div>
                <div className="h-6 w-3/4 bg-muted rounded"></div>
                <div className="h-4 w-full bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

