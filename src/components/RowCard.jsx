// src/components/RowCard.jsx
import React, { memo } from "react";

/**
 * RowCard
 * Props:
 *  - left:    ReactNode (left side content)
 *  - right:   string | ReactNode (button label/content)
 *  - onClick: () => void
 *  - disabled?: boolean (optional)
 *  - className?: string (optional, extra classes for the container)
 */
function RowCardBase({ left, right, onClick, disabled = false, className = "" }) {
  return (
    <div
      className={
        "border border-slate-200 rounded-xl p-3 bg-white flex items-center justify-between " +
        className
      }
    >
      <div className="flex items-center gap-3">{left}</div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={typeof right === "string" ? right : "open"}
        className={
          "px-3 py-2 rounded-lg border font-semibold min-w-[110px] transition-colors " +
          (disabled
            ? "border-slate-300 text-slate-400 bg-slate-100 cursor-not-allowed"
            : "border-cyan-500 text-cyan-700 bg-white hover:bg-cyan-50")
        }
      >
        {right}
      </button>
    </div>
  );
}

const RowCard = memo(RowCardBase);
export default RowCard;
export { RowCard };
