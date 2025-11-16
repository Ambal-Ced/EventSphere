"use client";

import { memo } from "react";
import { TrendingUp, DollarSign, Package, Activity } from "lucide-react";

interface RoipSummaryCardsProps {
  roipData: {
    current_roi?: number;
    total_revenue?: number;
    total_costs?: number;
    net_income?: number;
  };
  formatCurrency: (cents: number) => string;
}

export const RoipSummaryCards = memo(function RoipSummaryCards({
  roipData,
  formatCurrency,
}: RoipSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Current ROI</p>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${(roipData.current_roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roipData.current_roi?.toFixed(2) || "0.00"}%
            </p>
          </div>
          <TrendingUp className={`h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 flex-shrink-0 ${(roipData.current_roi || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
        </div>
      </div>

      <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{formatCurrency(roipData.total_revenue || 0)}</p>
          </div>
          <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-green-400 flex-shrink-0" />
        </div>
      </div>

      <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Costs</p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold">{formatCurrency(roipData.total_costs || 0)}</p>
          </div>
          <Package className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-orange-400 flex-shrink-0" />
        </div>
      </div>

      <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">Net Income</p>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${(roipData.net_income || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(roipData.net_income || 0)}
            </p>
          </div>
          <Activity className={`h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 flex-shrink-0 ${(roipData.net_income || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
        </div>
      </div>
    </div>
  );
});

