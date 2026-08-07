export type RangeKey = "hoje" | "ontem" | "7d" | "30d" | "tudo" | "custom";

export interface DateRange {
  key: RangeKey;
  /** ISO inclusive start */
  from: string | null;
  /** ISO exclusive end */
  to: string | null;
  label: string;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "tudo", label: "Tudo" },
];

export function buildRange(key: RangeKey, custom?: { from?: string; to?: string }): DateRange {
  const today = startOfDay(new Date());
  switch (key) {
    case "hoje":
      return { key, from: today.toISOString(), to: addDays(today, 1).toISOString(), label: "Hoje" };
    case "ontem":
      return {
        key,
        from: addDays(today, -1).toISOString(),
        to: today.toISOString(),
        label: "Ontem",
      };
    case "7d":
      return { key, from: addDays(today, -6).toISOString(), to: addDays(today, 1).toISOString(), label: "Últimos 7 dias" };
    case "30d":
      return { key, from: addDays(today, -29).toISOString(), to: addDays(today, 1).toISOString(), label: "Últimos 30 dias" };
    case "custom": {
      const from = custom?.from ? startOfDay(new Date(`${custom.from}T00:00:00`)) : null;
      const to = custom?.to ? addDays(startOfDay(new Date(`${custom.to}T00:00:00`)), 1) : null;
      return {
        key,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        label: "Período personalizado",
      };
    }
    default:
      return { key: "tudo", from: null, to: null, label: "Todo o período" };
  }
}

/** Período imediatamente anterior, do mesmo tamanho, para comparação. */
export function previousRange(range: DateRange): DateRange {
  if (!range.from || !range.to) return { ...range, from: null, to: null };
  const from = new Date(range.from);
  const to = new Date(range.to);
  const span = to.getTime() - from.getTime();
  return {
    key: range.key,
    from: new Date(from.getTime() - span).toISOString(),
    to: from.toISOString(),
    label: "Período anterior",
  };
}

export function inRange(value: string, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  const time = new Date(value).getTime();
  if (range.from && time < new Date(range.from).getTime()) return false;
  if (range.to && time >= new Date(range.to).getTime()) return false;
  return true;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? "");
          return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(";"),
    )
    .join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
