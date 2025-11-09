"use client";

import * as React from "react";
import { formatDateISO, formatDateShort, isValidDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export function DatePicker({
  date,
  setDate,
  placeholder = "MM/DD/YYYY",
  name,
  required,
}: {
  date?: Date;
  setDate: (date: Date | undefined) => void;
  placeholder?: string;
  name?: string;
  required?: boolean;
}) {
  const [inputValue, setInputValue] = React.useState("");
  const [open, setOpen] = React.useState(false);

  // Format date when it changes
  React.useEffect(() => {
    if (date) {
      setInputValue(formatDateShort(date).replace(/\//g, '/'));
    }
  }, [date]);

  // Handle manual input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Remove any non-numeric characters
    value = value.replace(/\D/g, "");

    // Add slashes automatically
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    if (value.length >= 5) {
      value = value.slice(0, 5) + "/" + value.slice(5, 9);
    }

    // Limit the total length to 10 characters (MM/DD/YYYY)
    value = value.slice(0, 10);

    setInputValue(value);

    // Try to parse the date if we have a complete format
    if (value.length === 10) {
      const [monthStr, dayStr, yearStr] = value.split("/");
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      const year = parseInt(yearStr, 10);
      const parsedDate = new Date(year, month - 1, day);

      // Basic bounds check before accepting
      const looksReasonable = year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;

      if (looksReasonable && isValidDate(parsedDate)) {
        setDate(parsedDate);
      }
    }
  };

  // We deliberately avoid native pattern validation to prevent blocking submission.
  // Parsing/auto-formatting above will still set a valid Date when possible.

  return (
    <div className="relative flex items-center">
      {/* Hidden input carries the canonical ISO value for form validation/submission */}
      {name ? (
        <input
          type="hidden"
          name={name}
          value={date ? formatDateISO(date) : ""}
          required={required}
          aria-hidden="true"
        />
      ) : null}
      <Input
        type="text"
        value={inputValue}
        onChange={(e) => {
          handleInputChange(e);
        }}
        placeholder={placeholder}
        inputMode="numeric"
        maxLength={10}
        className={cn("w-full pr-10", !date && "text-muted-foreground")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 h-8 w-8"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d: Date | undefined) => {
              setDate(d);
              if (d) {
                setInputValue(formatDateShort(d).replace(/\//g, '/'));
              }
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
