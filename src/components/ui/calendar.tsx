"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const currentYear = new Date().getFullYear();
  const weekdayShort = Array.from({ length: 7 }).map((_, i) =>
    new Date(2021, 7, i + 1).toLocaleDateString("en-US", { weekday: "short" })
  );
  const [displayMonth, setDisplayMonth] = React.useState<Date>(new Date());

  // (Inline caption removed for revert)

  return (
    <div className={cn("p-3 w-72", className)}>
      {/* Caption-only DayPicker to show month/year pickers while hiding its grid */}
      <DayPicker
        showOutsideDays={false}
        className="p-0"
        styles={{ head_row: { display: "none" } }}
        classNames={{
          months: "flex flex-col space-y-4",
          month: "space-y-3",
          caption: "flex items-center justify-between pb-2",
          caption_label: "sr-only",
          caption_dropdowns: "flex items-center gap-2",
          dropdown: "h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm",
          dropdown_month: "h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm",
          dropdown_year: "h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm",
          table: "w-full table-fixed border-collapse",
          head_row: "hidden",
          head_cell: "hidden",
          row: "hidden",
          cell: "hidden",
          day: "hidden",
        }}
        formatters={undefined}
        components={{ Nav: () => <span />, Head: () => <></>, HeadRow: () => <></>, Weekday: () => <></> } as any}
        captionLayout={(props as any)?.captionLayout ?? 'dropdown'}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        fromYear={(props as any)?.fromYear ?? 1900}
        toYear={(props as any)?.toYear ?? currentYear}
        weekStartsOn={(props as any)?.weekStartsOn ?? 0}
        fixedWeeks
        numberOfMonths={1}
      />
      {/* Weekday chips directly under the pickers */}
      <div className="mt-2 grid grid-cols-7 gap-1">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <span
            key={d}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "justify-center px-2 py-0.5 text-[10px] font-bold uppercase rounded-md"
            )}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Duplicate date grid for debugging under chips */}
      <DayPicker
        showOutsideDays={false}
        className="p-0 mt-2"
        styles={{ head_row: { display: "none" } }}
        classNames={{
          months: "flex flex-col space-y-4",
          month: "space-y-3",
          caption: "hidden",
          caption_label: "sr-only",
          caption_dropdowns: "hidden",
          table: "w-full table-fixed border-collapse",
          head_row: "hidden",
          head_cell: "hidden",
          row: "table-row",
          cell: "table-cell w-[14.2857%] h-9 text-center align-middle p-0 relative",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 mx-auto font-normal aria-selected:opacity-100"
          ),
        }}
        formatters={undefined}
        components={{ Nav: () => <span />, Head: () => <></>, HeadRow: () => <></>, Weekday: () => <></> } as any}
        month={displayMonth}
        onMonthChange={setDisplayMonth}
        fromYear={(props as any)?.fromYear ?? 1900}
        toYear={(props as any)?.toYear ?? currentYear}
        weekStartsOn={(props as any)?.weekStartsOn ?? 0}
        fixedWeeks
        numberOfMonths={1}
        {...props}
      />

    </div>

  );
}

Calendar.displayName = "Calendar";

export { Calendar };
