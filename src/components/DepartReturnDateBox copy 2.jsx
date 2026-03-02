// src/components/DepartReturnDateBox.jsx
import React, { useEffect, useMemo, useState } from "react";
import { DateRangePicker } from "rsuite";

/** Responsive hook: treat viewport < 768px as mobile */
function useIsMobile(breakpoint = 768) {
  const get = () =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false;
  const [isMobile, setIsMobile] = useState(get());

  useEffect(() => {
    const onResize = () => setIsMobile(get());
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);
    return () => {
      if (typeof window !== "undefined")
        window.removeEventListener("resize", onResize);
    };
  }, [breakpoint]);

  return isMobile;
}

/**
 * DepartReturnDateBox
 * - Two buttons (Depart/Return)
 * - One shared DateRangePicker popup
 * - Draft while open
 * - Commit only on OK
 * - Mobile shows 1 calendar, desktop shows 2 calendars
 */
export default function DepartReturnDateBox({
  tripType, // "oneway" | "roundtrip"
  depart,
  ret,
  onCommit, // ({ depart, ret }) => void
  minDate,
  locale,
  formatUiDate,
  placement = "bottomStart",
  className = "",
  labels,
}) {
  const isMobile = useIsMobile(768);
  const isRoundTrip = tripType === "roundtrip";

  const [draft, setDraft] = useState(() => ({
    depart: depart || null,
    ret: isRoundTrip ? ret || null : null,
  }));

  const [activeField, setActiveField] = useState("depart"); // "depart" | "return"
  const [open, setOpen] = useState(false);

  // re-sync draft when popup closes
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

  // If switch to one-way, clear return
  useEffect(() => {
    if (!isRoundTrip) setDraft((d) => ({ ...d, ret: null }));
  }, [isRoundTrip]);

  const rsValue = useMemo(() => {
    if (!draft?.depart) return null;
    if (!isRoundTrip) return [draft.depart, draft.depart];
    return [draft.depart, draft.ret || draft.depart];
  }, [draft, isRoundTrip]);

  const canOk = useMemo(() => {
    if (!draft?.depart) return false;
    if (!isRoundTrip) return true;
    return !!draft?.ret;
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
      return;
    }

    // TG flow: click depart first => jump to return selection
    if (activeField === "depart") {
      setDraft({ depart: d0, ret: null });
      setActiveField("return");
      return;
    }

    // selecting return
    let newRet = d1;
    if (newRet && d0 && newRet < d0) newRet = null;
    setDraft({ depart: d0, ret: newRet });
  };

  const handleOk = (range) => {
    const d0 = range?.[0] || null;
    const d1 = range?.[1] || null;
    if (!d0) return;

    if (!isRoundTrip) {
      onCommit?.({ depart: d0, ret: null });
      setOpen(false);
      return;
    }

    if (!d1) return;

    const dep = d0;
    const r = d1 < d0 ? d0 : d1; // safety
    onCommit?.({ depart: dep, ret: r });
    setOpen(false);
  };

  const handleClean = () => {
    setDraft({ depart: null, ret: null });
    setActiveField("depart");
  };

  const openFor = (field) => {
    if (field === "return" && isRoundTrip) {
      if (!draft?.depart) {
        setActiveField("depart");
        setOpen(true);
        return;
      }
      setActiveField("return");
      setOpen(true);
      return;
    }
    setActiveField("depart");
    setOpen(true);
  };

  // show draft while open
  const depShow = open ? draft?.depart : depart;
  const retShow = open ? draft?.ret : ret;

  const depText = depShow ? formatUiDate(depShow) : "";
  const retText = retShow ? formatUiDate(retShow) : "";

  const departLabel = labels?.departLabel ?? "Depart";
  const returnLabel = labels?.returnLabel ?? "Return";

  return (
    <div className={"w-full " + className}>
      <div className="relative">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => openFor("depart")}
            className={
              "h-14 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm hover:bg-slate-50 " +
              (open && activeField === "depart" ? "ring-2 ring-sky-200" : "")
            }
          >
            <div className="text-xs text-slate-500">{departLabel}</div>
            <div className="text-[16px] font-medium text-slate-900">
              {depText || " "}
            </div>
          </button>

          <button
            type="button"
            onClick={() => openFor("return")}
            disabled={!isRoundTrip}
            className={
              "h-14 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm hover:bg-slate-50 " +
              (!isRoundTrip ? "opacity-60 cursor-not-allowed" : "") +
              (open && activeField === "return" ? " ring-2 ring-sky-200" : "")
            }
          >
            <div className="text-xs text-slate-500">{returnLabel}</div>
            <div className="text-[16px] font-medium text-slate-900">
              {isRoundTrip ? (retText || " ") : "—"}
            </div>
          </button>
        </div>

        {/* Invisible trigger: anchor for popup measurement */}
        <div
          className="absolute inset-0"
          style={{ opacity: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
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
            showOneCalendar={isMobile}
            size={isMobile ? "md" : "lg"}
            placement={placement}
            locale={locale}
            disabledDate={(d) => !!(minDate && d < minDate)}
            okButtonProps={{ disabled: !canOk }}
            /* IMPORTANT: prevent clipping + make CSS apply consistently */
            container={() => document.body}
          />
        </div>
      </div>

      {isRoundTrip && open && activeField === "return" && (
        <div className="mt-2 text-xs text-slate-500">Select return date</div>
      )}
    </div>
  );
}