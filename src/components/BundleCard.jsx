// src/components/BundleCard.jsx
import React, { memo } from "react";

/**
 * BundleCard
 * Props:
 *  - name: string (radio group name)
 *  - checked: boolean
 *  - onChange: () => void
 *  - title: string
 *  - subtitle: string
 *  - features: string[]
 *  - priceLabel: string (e.g., "THB 250.00" or "Included")
 *  - accent: string (hex color for active border), default "#3b82f6"
 */
function BundleCardBase({
  name,
  checked,
  onChange,
  title,
  subtitle,
  features = [],
  priceLabel,
  accent = "#3b82f6",
}) {
  return (
    <label
      className={`flex items-start gap-3 border-2 rounded-xl p-3 cursor-pointer w-full transition-colors ${
        checked ? "bg-sky-50" : "bg-white"
      }`}
      style={{ borderColor: checked ? accent : "#e5e7eb" }}
    >
      {/* Keep the radio visible for accessibility but style lightly */}
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 accent-sky-600"
        aria-checked={checked}
      />

      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-extrabold">{title}</div>
            {subtitle && (
              <div className="text-blue-600 text-xs font-semibold">{subtitle}</div>
            )}
          </div>

          {priceLabel && (
            <div className="font-bold whitespace-nowrap">{priceLabel}</div>
          )}
        </div>

        {Array.isArray(features) && features.length > 0 && (
          <ul className="mt-2 ml-5 text-slate-700 text-sm list-disc">
            {features.map((f, i) => (
              <li key={i} className="mb-1">
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}

const BundleCard = memo(BundleCardBase);
export default BundleCard;
export { BundleCard };
