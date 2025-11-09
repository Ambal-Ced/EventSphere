export default function FeedbackLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-3/4 bg-muted rounded"></div>
        <div className="h-64 w-full bg-muted rounded-lg"></div>
        <div className="space-y-4">
          <div className="h-10 w-full bg-muted rounded"></div>
          <div className="h-10 w-full bg-muted rounded"></div>
          <div className="h-24 w-full bg-muted rounded"></div>
        </div>
      </div>
    </div>
  );
}

