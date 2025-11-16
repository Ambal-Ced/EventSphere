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
  // Prepare chart data with separate fields for historical and predicted ROI
  const chartData = useMemo(() => {
    const allMonths = new Set<string>();
    
    // Collect all months from historical and predictions
    (historical || []).forEach((h: any) => allMonths.add(h.month));
    (predictions || []).forEach((p: any) => allMonths.add(p.month));
    
    // Sort months chronologically
    const sortedMonths = Array.from(allMonths).sort();
    
    // Create data points with both historical and predicted values
    return sortedMonths.map((month: string) => {
      const hist = (historical || []).find((h: any) => h.month === month);
      const pred = (predictions || []).find((p: any) => p.month === month);
      
      return {
        month,
        historicalRoi: hist 
          ? (hist.revenue > 0 ? ((hist.revenue - hist.costs) / hist.revenue) * 100 : 0)
          : null,
        predictedRoi: pred ? (pred.predicted_roi || 0) : null,
      };
    });
  }, [historical, predictions]);

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
            formatter={(value: any, name: string) => {
              if (value === null || value === undefined) return [null, null];
              const label = name === "historicalRoi" ? "Historical ROI" : "Predicted ROI";
              return [`${Number(value).toFixed(2)}%`, label];
            }}
            labelFormatter={(label: string | number) => `Month: ${label}`}
          />
          <Legend />
          {/* Historical ROI Line - solid blue */}
          <Line 
            type="monotone" 
            dataKey="historicalRoi" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ r: 4, fill: "#3b82f6" }}
            name="Historical ROI"
            connectNulls={false}
          />
          {/* Predicted ROI Line - dashed green to clearly show predictions */}
          <Line 
            type="monotone" 
            dataKey="predictedRoi" 
            stroke="#10b981" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: "#10b981" }}
            name="Predicted ROI"
            connectNulls={false}
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

