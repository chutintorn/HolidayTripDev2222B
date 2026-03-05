// src/components/DepartReturnDateBox.jsx
import React, { useEffect, useMemo, useState } from "react";
import { DateRangePicker } from "rsuite";

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

export default function DepartReturnDateBox({
  tripType,
  depart,
  ret,
  onCommit,
  minDate,
  locale,
  formatUiDate,
  placement = "bottomEnd",
  className = "",
  labels,
  openTick = 0,
}) {
  const isMobile = useIsMobile(768);
  const isRoundTrip = tripType === "roundtrip";

  const [draft, setDraft] = useState(() => ({
    depart: depart || null,
    ret: isRoundTrip ? ret || null : null,
  }));

  const [activeField, setActiveField] = useState("depart");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!openTick) return;
    setActiveField("depart");
    setOpen(true);
  }, [openTick]);

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

    if (activeField === "depart") {
      setDraft({ depart: d0, ret: null });
      setActiveField("return");
      return;
    }

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

    onCommit?.({ depart: d0, ret: d1 < d0 ? d0 : d1 });
    setOpen(false);
  };

  const handleClean = () => {
    setDraft({ depart: null, ret: null });
    setActiveField("depart");
  };

  const openFor = (field) => {
    if (field === "return" && isRoundTrip) {
      if (!draft?.depart && !depart) {
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

  const depShow = open ? draft?.depart : depart;
  const retShow = open ? draft?.ret : ret;

  const depText = depShow ? formatUiDate(depShow) : "";
  const retText = retShow ? formatUiDate(retShow) : "";

  const departLabel = labels?.departLabel ?? "Depart";
  const returnLabel = labels?.returnLabel ?? "Return";

  // Mobile: stack. Desktop: 2 columns
  const gridClass = "grid grid-cols-1 sm:grid-cols-2 gap-2";

  // Short boxes
  const boxClass = (active) =>
    "h-9 sm:h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-left shadow-sm hover:bg-slate-50 " +
    (active ? "ring-2 ring-sky-300" : "");

  // Label small
  const labelClass = "text-[11px] text-slate-500 font-medium leading-tight";

  // ✅ DATE value lighter (no bold) to match airport feel
  const valueClass =
    "text-[14px] sm:text-[15px] text-slate-800 font-normal leading-tight whitespace-nowrap truncate";

  return (
    <div className={"w-full " + className}>
      <div className="relative">
        <div className={gridClass}>
          <button
            type="button"
            onClick={() => openFor("depart")}
            className={boxClass(open && activeField === "depart")}
          >
            <div className={labelClass}>{departLabel}</div>
            <div className={valueClass}>{depText}</div>
          </button>

          <button
            type="button"
            onClick={() => openFor("return")}
            className={boxClass(open && activeField === "return")}
          >
            <div className={labelClass}>{returnLabel}</div>
            <div className={valueClass}>{retText}</div>
          </button>
        </div>

        {/* Hidden RSuite toggle input (popup only) */}
        <div
          className="ibe-drbox-hidden-toggle"
          style={{ height: 0, overflow: "hidden" }}
        >
          <DateRangePicker
            className="ibe-drbox-picker"
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
            container={() => document.body}
          />
        </div>
      </div>
    </div>
  );
}