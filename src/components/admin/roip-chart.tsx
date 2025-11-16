"use client";

import { memo, useMemo } from "react";
import dynamic from "next/dynamic";

const ResponsiveContainer: any = dynamic(() => import("recharts").then(m => m.ResponsiveContainer as any), { ssr: false });
const LineChart: any = dynamic(() => import("recharts").then(m => m.LineChart as any), { ssr: false });
const Line: any = dynamic(() => import("recharts").then(m => m.Line as any), { ssr: false });
const CartesianGrid: any = dynamic(() => import("recharts").then(m => m.CartesianGrid as any), { ssr: false });
const XAxis: any = dynamic(() => import("recharts").then(m => m.XAxis as any), { ssr: false });
const YAxis: any = dynamic(() => import("recharts").then(m => m.YAxis as any), { ssr: false });
const Tooltip: any = dynamic(() => import("recharts").then(m => m.Tooltip as any), { ssr: false });
const Legend: any = dynamic(() => import("recharts").then(m => m.Legend as any), { ssr: false });

interface RoipChartProps {
  historical: any[];
  predictions: any[];
  windowWidth: number;
  formatCurrency: (cents: number) => string;
}

export const RoipChart = memo(function RoipChart({
  historical,
  predictions,
  windowWidth,
  formatCurrency,
}: RoipChartProps) {
  const chartData = useMemo(() => [
    ...(historical || []).map((h: any) => ({
      month: h.month,
      roi: h.revenue > 0 ? ((h.revenue - h.costs) / h.revenue) * 100 : 0,
      type: "Historical"
    })),
    ...(predictions || []).map((p: any) => ({
      month: p.month,
      roi: p.predicted_roi || 0,
      type: "Predicted"
    }))
  ], [historical, predictions]);

  return (
    <div className="w-full" style={{ height: windowWidth < 640 ? 300 : 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: windowWidth < 640 ? 10 : 12 }}
          />
          <YAxis 
            label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: windowWidth < 640 ? 10 : 12 }}
          />
          <Tooltip 
            formatter={(value: any) => [`${Number(value).toFixed(2)}%`, "ROI"]}
            labelFormatter={(label: string | number) => `Month: ${label}`}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="roi" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ r: 4 }}
            name="ROI %"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.historical?.length === nextProps.historical?.length &&
    prevProps.predictions?.length === nextProps.predictions?.length &&
    prevProps.windowWidth === nextProps.windowWidth
  );
});

