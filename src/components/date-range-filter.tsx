import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildRange, RANGE_PRESETS, type DateRange, type RangeKey } from "@/lib/date-range";

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  custom: { from: string; to: string };
  onCustomChange: (custom: { from: string; to: string }) => void;
}

/** Filtro de período reutilizado em Pedidos, Relatórios e Retiradas. */
export function DateRangeFilter({ value, onChange, custom, onCustomChange }: DateRangeFilterProps) {
  function pick(key: RangeKey) {
    onChange(buildRange(key, custom));
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-background p-3">
      <span className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <CalendarRange className="size-4" aria-hidden /> Período
      </span>
      {RANGE_PRESETS.map((preset) => (
        <Button
          key={preset.key}
          size="sm"
          variant={value.key === preset.key ? "default" : "outline"}
          onClick={() => pick(preset.key)}
        >
          {preset.label}
        </Button>
      ))}
      <div className="flex items-end gap-2">
        <Input
          type="date"
          aria-label="Data inicial"
          className="h-9 w-[9.5rem]"
          value={custom.from}
          onChange={(event) => {
            const next = { ...custom, from: event.target.value };
            onCustomChange(next);
            if (next.from && next.to) onChange(buildRange("custom", next));
          }}
        />
        <Input
          type="date"
          aria-label="Data final"
          className="h-9 w-[9.5rem]"
          value={custom.to}
          onChange={(event) => {
            const next = { ...custom, to: event.target.value };
            onCustomChange(next);
            if (next.from && next.to) onChange(buildRange("custom", next));
          }}
        />
      </div>
    </div>
  );
}
