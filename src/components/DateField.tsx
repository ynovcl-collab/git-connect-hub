import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Props = {
  value?: string; // ISO yyyy-mm-dd
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  min?: string;
  max?: string;
};

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(v?: string): Date | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function DateField({ value, onChange, placeholder = "Select a date", className, id, min, max }: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = fromISO(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-accent",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{selected ? selected.toLocaleDateString() : placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        avoidCollisions
        collisionPadding={12}
        className="w-auto max-w-[calc(100vw-1.5rem)] p-0"
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(toISO(d));
            setOpen(false);
          }}
          fromDate={fromISO(min)}
          toDate={fromISO(max)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
