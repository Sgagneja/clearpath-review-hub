/**
 * A chart axis with whole-number ticks that read naturally (steps of 1, 2 or
 * 5 × 10ⁿ), so gridline labels always match the bars they sit behind.
 */
export function niceAxis(max: number, targetTicks = 4): { top: number; ticks: number[] } {
  const safeMax = Math.max(1, Math.ceil(max));
  const raw = safeMax / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude);
  const top = Math.ceil(safeMax / step) * step;
  const ticks = Array.from({ length: top / step }, (_, i) => (i + 1) * step);
  return { top, ticks };
}
