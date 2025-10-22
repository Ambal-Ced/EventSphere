"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  className?: string;
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
  getEventsCountForDate?: (date: Date) => number; // optional provider for counts
};

function getDaysMatrix(year: number, month: number, weekStartsOn: 0 | 1) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastOfMonth.getDate();

  // 0..6 (Sun..Sat) or shifted if starting Monday
  const startWeekday = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;

  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Leading days from previous month
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevMonthLast - i;
    cells.push({ date: new Date(year, month - 1, day), isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Trailing days from next month to make 6 full weeks (42 cells)
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay++), isCurrentMonth: false });
  }

  return cells;
}

export default function MonthGridCalendar({ selected, onSelect, className, weekStartsOn = 0, getEventsCountForDate }: Props) {
  const initial = selected && !isNaN(selected.getTime()) ? selected : new Date();
  const [viewYear, setViewYear] = React.useState<number>(initial.getFullYear());
  const [viewMonth, setViewMonth] = React.useState<number>(initial.getMonth());

  // Keep view in sync with selected month
  React.useEffect(() => {
    if (selected && !isNaN(selected.getTime())) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [selected]);

  const cells = React.useMemo(() => getDaysMatrix(viewYear, viewMonth, weekStartsOn), [viewYear, viewMonth, weekStartsOn]);

  const isSameDay = (a?: Date | null, b?: Date | null) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const weekdayLabels = weekStartsOn === 1
    ? ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className={cn("w-full", className)}>
      {/* Weekday header perfectly aligned to 7 equal columns */}
      <div className="grid grid-cols-7 gap-0.5 max-[335px]:gap-0 max-[375px]:gap-1 sm:gap-2 md:gap-3">
        {weekdayLabels.map((d) => (
          <div key={d} className="text-center py-0.5 max-[335px]:py-0 sm:py-2 text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* 6-week grid ensures stable vertical height and alignment */}
      <div className="grid grid-cols-7 gap-0.5 max-[335px]:gap-0 max-[375px]:gap-1 sm:gap-2 md:gap-3">
        {cells.map((cell, idx) => {
          const isSelected = isSameDay(cell.date, selected || undefined);
          const count = getEventsCountForDate ? Math.max(0, getEventsCountForDate(cell.date)) : 0;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(cell.date)}
              className={cn(
                // Responsive boxes with space for label
                "mx-auto w-6 h-6 max-[335px]:w-7 max-[335px]:h-7 max-[375px]:w-8 max-[375px]:h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-sm sm:rounded-md",
                "flex flex-col items-center justify-center gap-0 max-[335px]:gap-0 sm:gap-1 text-xs sm:text-sm md:text-base",
                "transition-colors border max-[335px]:border-0",
                cell.isCurrentMonth ? "text-foreground" : "text-muted-foreground/40",
                isSelected ? "bg-primary/20 text-primary font-semibold max-[335px]:border-primary/30 max-[335px]:border" : "hover:bg-muted/40",
                count > 0 ? "border-yellow-400/70 max-[425px]:bg-yellow-400/20 max-[425px]:border-transparent max-[375px]:bg-yellow-400/10" : "border-transparent"
              )}
            >
              <span className="leading-none">{cell.date.getDate()}</span>
              {count > 0 && (
                <span className="text-[8px] sm:text-[10px] leading-none text-muted-foreground hidden sm:block">
                  {count} {count === 1 ? "event" : "events"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}



