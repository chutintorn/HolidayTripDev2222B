// src/components/Chip.jsx
import React, { memo } from "react";

/**
 * Chip
 * Props:
 *  - ok?: boolean  -> toggles success vs neutral styling
 *  - children: ReactNode -> chip label
 *  - className?: string  -> extra classes
 */
function ChipBase({ ok = false, children, className = "" }) {
  const base =
    "inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap";
  const theme = ok
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-sky-50 text-sky-800 border-sky-200";
  return <span className={`${base} ${theme} ${className}`}>{children}</span>;
}

const Chip = memo(ChipBase);
export default Chip;
export { Chip };
