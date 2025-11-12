export const dynamic = "force-dynamic";
export const revalidate = 0;

import AnalyticsClient from "./analytics-client";

export default function AnalyticsPage() {
  return (
    <AnalyticsClient
      initialEvents={[]}
      initialItems={[]}
      initialAttStats={[]}
      initialFeedback={[]}
    />
  );
}
