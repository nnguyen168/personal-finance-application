import { formatMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

interface Point {
  month: string;
  fixed: number;
  flexible: number;
  income: number;
}

function niceMax(v: number) {
  if (v <= 0) return 100_000;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v / 4)! * pow;
  return Math.ceil(v / step) * step;
}

/**
 * Stacked columns (fixed bills + everyday spending) per month, with a tick for
 * income received. Same € scale for everything — one axis only.
 */
export function SpendingHistory({ data }: { data: Point[] }) {
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.fixed + d.flexible, d.income))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const H = 180;
  const hasData = data.some((d) => d.fixed || d.flexible || d.income);

  if (!hasData) return <p className="py-8 text-center text-sm text-ink-3">Spending history will appear here once you have transactions.</p>;

  return (
    <figure>
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-fixed" aria-hidden />Fixed bills</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-flex" aria-hidden />Everyday spending</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full bg-ink" aria-hidden />Income</span>
      </div>

      <div className="relative flex gap-2" aria-hidden>
        {/* Y axis */}
        <div className="relative w-12 shrink-0" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="num absolute right-0 -translate-y-1/2 text-[11px] text-ink-3" style={{ top: H - (t / max) * H }}>
              {formatMoney(t, { decimals: false })}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: H - (t / max) * H }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {data.map((d) => {
              const fixedH = (d.fixed / max) * H;
              const flexH = (d.flexible / max) * H;
              const incomeY = (d.income / max) * H;
              return (
                <div key={d.month} className="group relative flex h-full w-full max-w-16 flex-col items-center justify-end">
                  {/* Hover target is the whole column slot, wider than the bar. */}
                  <div className="flex w-5 flex-col justify-end gap-[2px]">
                    {flexH > 0 && <div className="rounded-t bg-chart-flex" style={{ height: Math.max(flexH - 2, 1) }} />}
                    {fixedH > 0 && <div className={flexH > 0 ? "bg-chart-fixed" : "rounded-t bg-chart-fixed"} style={{ height: fixedH }} />}
                  </div>
                  {d.income > 0 && (
                    <div className="absolute h-0.5 w-9 rounded-full bg-ink ring-2 ring-surface" style={{ bottom: incomeY - 1 }} />
                  )}
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-44 rounded-2xl bg-ink px-4 py-3 text-[12px] text-bg shadow-lg group-hover:block">
                    <p className="mb-1 font-semibold">{formatMonth(d.month)}</p>
                    <p className="num flex justify-between"><span>Fixed</span>{formatMoney(d.fixed, { decimals: false })}</p>
                    <p className="num flex justify-between"><span>Everyday</span>{formatMoney(d.flexible, { decimals: false })}</p>
                    <p className="num flex justify-between opacity-80"><span>Income</span>{formatMoney(d.income, { decimals: false })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2" aria-hidden>
        <div className="w-12 shrink-0" />
        <div className="flex flex-1 justify-around">
          {data.map((d) => (
            <span key={d.month} className="w-full max-w-16 text-center text-[11px] text-ink-3">
              {formatMonth(d.month, "short").split(" ")[0]}
            </span>
          ))}
        </div>
      </div>

      <details className="mt-4 text-[13px]">
        <summary className="cursor-pointer text-ink-3 select-none">Show as table</summary>
        <table className="num mt-2 w-full text-left">
          <thead className="text-ink-3">
            <tr><th className="py-1 font-medium">Month</th><th className="text-right font-medium">Fixed</th><th className="text-right font-medium">Everyday</th><th className="text-right font-medium">Income</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line">
                <td className="py-1.5">{formatMonth(d.month)}</td>
                <td className="text-right">{formatMoney(d.fixed, { decimals: false })}</td>
                <td className="text-right">{formatMoney(d.flexible, { decimals: false })}</td>
                <td className="text-right">{formatMoney(d.income, { decimals: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
