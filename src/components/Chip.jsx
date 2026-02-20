// src/components/Chip.jsx
import React, { memo } from "react";

/**
 * Chip
 * Props:
 *  - ok?: boolean       -> true = Completed (green), false = Incomplete (light red)
 *  - children: ReactNode -> chip label
 *  - className?: string -> extra classes
 */
function ChipBase({ ok = false, children, className = "" }) {
  const base =
    "inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap";

  // ✅ Status colors
  const theme = ok
    ? "bg-emerald-100 text-emerald-800 border-emerald-300" // Completed (green)
    : "bg-red-100 text-red-800 border-red-300";            // Incomplete (light red)

  return <span className={`${base} ${theme} ${className}`}>{children}</span>;
}

const Chip = memo(ChipBase);
export default Chip;
export { Chip };
