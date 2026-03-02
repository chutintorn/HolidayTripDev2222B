// src/components/DepartReturnDateBox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { DateRangePicker } from "rsuite";

/**
 * DepartReturnDateBox (TG-style)
 * - Two "inputs" (Depart / Return) BUT one shared DateRangePicker popup
 * - Draft selection inside popup
 * - Commit only on OK/Confirm (RSuite onOk)
 * - Minimal integration: parent still owns depart/ret states
 */
export default function DepartReturnDateBox({
  tripType, // "oneway" | "roundtrip"
  depart,
  ret,
  onCommit, // ({ depart, ret }) => void
  minDate,
  locale,
  formatUiDate, // (date) => string (your formatUiDate with weekdayStyle)
  placement = "bottomEnd",
  className = "",
}) {
  const isRoundTrip = tripType === "roundtrip";

  // Draft values (only while popup open)
  const [draft, setDraft] = useState(() => ({
    depart: depart || null,
    ret: isRoundTrip ? ret || null : null,
  }));

  // Which field user is focusing (for UX)
  const [activeField, setActiveField] = useState("depart"); // "depart" | "return"
  const [open, setOpen] = useState(false);

  // Keep draft in sync when popup closed (so draft won’t drift)
  useEffect(() => {
    if (!open) {
      setDraft({
        depart: depart || null,
        ret: isRoundTrip ? ret || null : null,
      });
      setActiveField("depart");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If tripType switches to oneway, clear return draft
  useEffect(() => {
    if (!isRoundTrip) {
      setDraft((d) => ({ ...d, ret: null }));
    }
  }, [isRoundTrip]);

  // RSuite expects [start, end]
  const rsValue = useMemo(() => {
    if (!draft?.depart) return null;
    if (isRoundTrip) return [draft.depart, draft.ret || draft.depart];
    return [draft.depart, draft.depart];
  }, [draft, isRoundTrip]);

  const setDraftFromRange = (range) => {
    if (!range || !range[0]) {
      setDraft({ depart: null, ret: null });
      setActiveField("depart");
      return;
    }
    const d0 = range[0];
    const d1 = range[1] || range[0];

    if (!isRoundTrip) {
      setDraft({ depart: d0, ret: null });
      setActiveField("depart");
      return;
    }

    // Round-trip draft rules
    let newDepart = d0;
    let newRet = d1;

    // If return < depart, normalize (clear return)
    if (newRet && newDepart && newRet < newDepart) {
      newRet = null;
    }

    setDraft({ depart: newDepart, ret: newRet });

    // Auto-switch focus: after picking depart -> go to return
    if (activeField === "depart") setActiveField("return");
  };

  const canOk = useMemo(() => {
    if (!draft?.depart) return false;
    if (!isRoundTrip) return true;
    return !!draft?.ret; // require return for roundtrip
  }, [draft, isRoundTrip]);

  // Click "input" to open popup + set active
  const openFor = (field) => {
    setActiveField(field);
    setOpen(true);
  };

  // Commit on OK
  const handleOk = (range) => {
    // range is [start,end] from RSuite
    const d0 = range?.[0] || null;
    const d1 = range?.[1] || null;

    if (!d0) return;

    if (!isRoundTrip) {
      onCommit?.({ depart: d0, ret: null });
      setOpen(false);
      return;
    }

    if (!d1) return;

    // Ensure order
    const dep = d0;
    const r = d1 < d0 ? d0 : d1;

    onCommit?.({ depart: dep, ret: r });
    setOpen(false);
  };

  // Draft reset inside popup (like TG Reset)
  const handleClean = () => {
    setDraft({ depart: null, ret: null });
    setActiveField("depart");
  };

  const labelDepart = depart ? formatUiDate(depart) : "";
  const labelReturn = ret ? formatUiDate(ret) : "";

  return (
    <div className={"w-full " + className}>
      {/* Two input-like boxes */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openFor("depart")}
          className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm hover:bg-slate-50"
        >
          <div className="text-xs text-slate-500">
            Depart
          </div>
          <div className="text-[16px] font-medium text-slate-900">
            {labelDepart || " "}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openFor("return")}
          disabled={!isRoundTrip}
          className={
            "h-14 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm hover:bg-slate-50 " +
            (!isRoundTrip ? "opacity-60 cursor-not-allowed" : "")
          }
        >
          <div className="text-xs text-slate-500">
            Return
          </div>
          <div className="text-[16px] font-medium text-slate-900">
            {isRoundTrip ? (labelReturn || " ") : "—"}
          </div>
        </button>
      </div>

      {/* Hidden DateRangePicker used as the shared popup */}
      <div className="h-0 overflow-hidden">
        <DateRangePicker
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          value={rsValue}
          onChange={setDraftFromRange}
          onOk={handleOk}
          onClean={handleClean}
          isoWeek
          oneTap={false}
          showOneCalendar={false}
          size="lg"
          placement={placement}
          locale={locale}
          disabledDate={(d) => !!(minDate && d < minDate)}
          // Make OK disabled until valid (roundtrip needs both)
          okButtonProps={{ disabled: !canOk }}
        />
      </div>

      {/* tiny hint line (optional) */}
      {isRoundTrip && open && activeField === "return" && (
        <div className="mt-2 text-xs text-slate-500">
          Select return date
        </div>
      )}
    </div>
  );
}