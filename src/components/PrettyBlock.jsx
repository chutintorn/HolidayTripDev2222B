// src/components/PrettyBlock.jsx
import React, { memo } from "react";

/**
 * PrettyBlock
 * A styled box for debug sections (cURL, JSON, etc.)
 *
 * Props:
 *  - title: string (header text)
 *  - children: ReactNode (body content)
 *  - actions?: ReactNode (optional buttons, e.g. "Copy cURL")
 *  - className?: string (optional extra classes)
 */
function PrettyBlockBase({ title, children, actions = null, className = "" }) {
  return (
    <div
      className={`p-3 rounded-lg border border-slate-200 bg-slate-50 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-800">{title}</div>
        {actions}
      </div>
      {children}
    </div>
  );
}

const PrettyBlock = memo(PrettyBlockBase);
export default PrettyBlock;
export { PrettyBlock };
