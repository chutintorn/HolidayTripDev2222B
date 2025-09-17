import React from "react";

/**
 * FiltersPanel
 * - Mobile: off-canvas that can be toggled (hidden by default)
 * - Desktop (lg+): visible by default on the left
 *
 * Props:
 *  - open: boolean (controls visibility on mobile)
 *  - onClose: () => void
 *  - T: i18n object with the keys used below
 */
export default function FiltersPanel({ open, onClose, T }) {
  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className={`fixed inset-0 bg-slate-900/40 z-40 lg:hidden transition-opacity ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Panel wrapper: mobile is off-canvas; desktop is static/visible */}
      <aside
        className={[
          "z-50 lg:z-auto",
          "fixed lg:static inset-y-0 left-0",
          "w-[86%] max-w-[320px] lg:w-auto",
          "bg-white lg:bg-white",
          "border-r lg:border lg:border-slate-200",
          "rounded-none lg:rounded-xl",
          "shadow-xl lg:shadow-none",
          "transition-transform lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0", // always shown on desktop
          "p-4 lg:p-4",
        ].join(" ")}
        role="dialog"
        aria-label={T.filters}
        aria-modal="true"
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{T.filters}</h2>
          <div className="flex items-center gap-2">
            <button className="text-red-500 text-sm">{T.clearAll}</button>
            {/* Close (mobile only) */}
            <button
              onClick={onClose}
              className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200"
              aria-label="Close filters"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Asia only */}
        <div className="mt-3">
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" defaultChecked className="size-4 accent-[#0B73B1]" />
            {T.asiaOnly}
          </label>
        </div>

        {/* Stops */}
        <div className="mt-4">
          <h3 className="text-[13px] text-slate-500 mb-2">{T.stops}</h3>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="stops" defaultChecked className="size-4 accent-[#0B73B1]" />
            {T.selectAll}
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="stops" className="size-4 accent-[#0B73B1]" />
            {T.nonstop}
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="stops" className="size-4 accent-[#0B73B1]" />
            {T.max1}
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="stops" className="size-4 accent-[#0B73B1]" />
            {T.max2}
          </label>
        </div>

        {/* Trip duration */}
        <div className="mt-4">
          <h3 className="text-[13px] text-slate-500 mb-2">{T.tripDuration}</h3>
          <input type="range" min="0" max="60" defaultValue="59" className="w-full" />
          <div className="text-right text-[12px] text-slate-500">{T.upto59h}</div>
        </div>

        {/* Layover duration */}
        <div className="mt-4">
          <h3 className="text-[13px] text-slate-500 mb-2">{T.layoverDuration}</h3>
          <input type="range" min="0" max="25" defaultValue="25" className="w-full" />
          <div className="text-right text-[12px] text-slate-500">{T.upto25h}</div>
        </div>

        {/* Cabin class */}
        <div className="mt-4">
          <h3 className="text-[13px] text-slate-500 mb-2">{T.cabinClass}</h3>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="cabin" defaultChecked className="size-4 accent-[#0B73B1]" />
            {T.eco}
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="cabin" className="size-4 accent-[#0B73B1]" />
            {T.prem}
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="cabin" className="size-4 accent-[#0B73B1]" />
            {T.biz}
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="cabin" className="size-4 accent-[#0B73B1]" />
            {T.first}
          </label>
        </div>

        {/* Airline */}
        <div className="mt-4">
          <h3 className="text-[13px] text-slate-500 mb-2">{T.airlines}</h3>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" defaultChecked className="size-4 accent-[#0B73B1]" />
            <span className="inline-flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white border border-amber-200 grid place-items-center text-[12px] font-bold text-amber-700">
                Nok
              </span>
              Nok Air
            </span>
          </label>
        </div>
      </aside>
    </>
  );
}
