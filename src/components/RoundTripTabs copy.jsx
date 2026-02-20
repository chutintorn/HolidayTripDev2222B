// src/components/RoundTripTabs.jsx
import React from "react";

export default function RoundTripTabs({
  tab,
  setTab,
  hasOutbound,
  hasInbound,
  onReset,
}) {
  const TabBtn = ({ id, label, active, disabled = false }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      disabled={disabled}
      className={
        "px-3 py-2 rounded-lg text-sm font-semibold border transition-colors " +
        (active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-slate-700 border-slate-200 hover:border-blue-400") +
        (disabled ? " opacity-50 cursor-not-allowed hover:border-slate-200" : "")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="w-full rounded-2xl border bg-white shadow-sm p-3 flex flex-wrap items-center gap-2">
      <TabBtn
        id="depart"
        label={hasOutbound ? "Depart ✓" : "Depart"}
        active={tab === "depart"}
      />
      <TabBtn
        id="return"
        label={hasInbound ? "Return ✓" : "Return"}
        active={tab === "return"}
      />

      {/* Right side: Clear then View Selection (View is right-most) */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white hover:border-red-300 hover:text-red-600 transition-colors"
        >
          Clear selection
        </button>

        <TabBtn
          id="view"
          label="View Selection"
          active={tab === "view"}
          disabled={!hasOutbound && !hasInbound}
        />
      </div>
    </div>
  );
}
