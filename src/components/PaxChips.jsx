// src/components/PaxChips.jsx
import React, { useMemo } from "react";
import { derivePax } from "../utils/pax";

/**
 * Compact ADT / CHD / INF badges.
 *
 * Props:
 * - source?: any object to derive counts from (search.params/results/pax/etc.)
 * - adult?, child?, infant?: numbers to override derived values
 * - showZero?: boolean (default false) → show CHD/INF even when 0
 * - className?: string for outer wrapper
 */
export default function PaxChips({
  source,
  adult,
  child,
  infant,
  showZero = false,
  className = "",
}) {
  const derived = useMemo(() => derivePax(source || {}), [source]);
  const a = Number.isFinite(+adult) ? +adult : derived.adult;
  const c = Number.isFinite(+child) ? +child : derived.child;
  const i = Number.isFinite(+infant) ? +infant : derived.infant;

  return (
    <div className={`ml-auto flex items-center gap-2 text-[0.6em] ${className}`}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-slate-700 bg-slate-50">
        <span className="font-semibold">ADT</span>
        <span>{a}</span>
      </span>

      {(showZero || c > 0) && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-slate-700 bg-slate-50">
          <span className="font-semibold">CHD</span>
          <span>{c}</span>
        </span>
      )}

      {(showZero || i > 0) && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-slate-700 bg-slate-50">
          <span className="font-semibold">INF</span>
          <span>{i}</span>
        </span>
      )}
    </div>
  );
}
