// src/components/MultiCityPopup.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker } from "rsuite";
import AirportSelect from "./AirportSelect";

/** Single-date picker (2 months) */
function SingleDatePicker({
  value,
  onChange,
  minDate,
  placeholder = "Select date",
  className = "w-full",
  locale,
  portalContainer, // mount popup inside modal
  positionRef,     // anchor popup a bit to the left
}) {
  return (
    <DateRangePicker
      oneTap
      showOneCalendar={false}
      isoWeek
      size="lg"
      format="yyyy-MM-dd"
      value={value ? [value, value] : null}
      onChange={(range) => onChange(range && range[0] ? range[0] : null)}
      placeholder={placeholder}
      className={className}
      locale={locale}
      placement="bottomEnd"                                  // align like main form
      disabledDate={(d) => !!(minDate && d < minDate)}
      container={portalContainer ? () => portalContainer : undefined}
      positionRef={positionRef || undefined}                // ⭐ shift popup anchor
      renderValue={(range) => {
        const v = Array.isArray(range) && range[0] ? range[0] : null;
        return v ? v.toISOString().slice(0, 10) : "";
      }}
      editable={false}
      cleanable={false}
    />
  );
}

/** add days helper */
const addDays = (d, days) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

export default function MultiCityPopup({
  open,
  onClose,
  onApply,
  initialSegments = [{ from: "", to: "", date: new Date() }],
  locale,
  today,
}) {
  const [segments, setSegments] = useState(initialSegments);

  // modal panel ref (for calendar portal)
  const panelRef = useRef(null);

  // ⬅ anchor to shift the calendar left by ~1 block (tweak the class if needed)
  const dateAnchorRefs = useRef({}); // map by index

  // Sync segments when opened
  useEffect(() => {
    if (open) {
      setSegments(
        (initialSegments && initialSegments.length
          ? initialSegments
          : [{ from: "", to: "", date: today || new Date() }]
        ).map((s) => ({
          from: s.from || "",
          to: s.to || "",
          date: s.date ? new Date(s.date) : null,
        }))
      );
    }
  }, [open, initialSegments, today]);

  const isValid = useMemo(() => {
    if (!segments.length) return false;
    return segments.every((s) => s.from && s.to && s.date);
  }, [segments]);

  const setSeg = (idx, patch) => {
    setSegments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const addSegment = () => {
    setSegments((prev) => {
      const last = prev[prev.length - 1];
      const suggested = last?.date ? addDays(last.date, 1) : (today || new Date());
      return [...prev, { from: "", to: "", date: suggested }];
    });
  };

  const removeSegment = (idx) => {
    setSegments((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const swapSegment = (idx) => {
    setSegments((prev) => {
      const next = [...prev];
      const { from, to } = next[idx] || { from: "", to: "" };
      next[idx] = { ...next[idx], from: to, to: from };
      return next;
    });
  };

  const handleApply = () => {
    if (!isValid) return;
    const result = segments.map((s) => ({
      from: String(s.from || "").trim().toUpperCase(),
      to: String(s.to || "").trim().toUpperCase(),
      date: s.date ? s.date.toISOString() : null,
    }));
    onApply?.(result);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Edit itinerary</h2>
          <button
            className="h-9 w-9 rounded-full border border-slate-200 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-auto">
          {segments.map((seg, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              {/* From */}
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">From</label>
                <AirportSelect
                  value={seg.from}
                  onChange={(val) => setSeg(idx, { from: val })}
                  placeholder="Select origin"
                />
              </div>

              {/* Swap */}
              <div className="md:col-span-1 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => swapSegment(idx)}
                  className="h-11 w-11 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                  title="Swap"
                >
                  ↔
                </button>
              </div>

              {/* To */}
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">To</label>
                <AirportSelect
                  value={seg.to}
                  onChange={(val) => setSeg(idx, { to: val })}
                  placeholder="Select destination"
                />
              </div>

              {/* Date (LAST on the row) */}
              <div className="md:col-span-3 relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>

                {/* Invisible anchor ~ one block to the LEFT to shift popup */}
                <span
                  ref={(el) => (dateAnchorRefs.current[idx] = el)}
                  className="pointer-events-none absolute -left-56 top-1/2 h-0 w-0"
                  aria-hidden
                />
                {/* -left-56 = 14rem (~one md grid block). Adjust to -left-64 (16rem) if needed. */}

                <SingleDatePicker
                  value={seg.date}
                  onChange={(d) => setSeg(idx, { date: d })}
                  minDate={today}
                  locale={locale}
                  portalContainer={panelRef.current}
                  positionRef={dateAnchorRefs.current[idx] || null}
                />
              </div>

              {/* Remove */}
              <div className="md:col-span-12 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeSegment(idx)}
                  className="h-10 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                  disabled={segments.length <= 1}
                  title={segments.length <= 1 ? "At least one segment required" : "Remove segment"}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {/* Add segment */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={addSegment}
              className="h-11 px-4 rounded-xl border bg-skyBlue-50 border-slate-300 text-sky-700 hover:bg-slate-50"
            >
              Add From–To City
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-xl border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!isValid}
            className={
              "h-11 px-6 rounded-xl text-white font-semibold shadow " +
              (isValid ? "bg-sky-600 hover:bg-sky-700" : "bg-sky-400/60 cursor-not-allowed")
            }
            title={!isValid ? "Please fill From, To, and Date for all segments" : "Apply itinerary"}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
