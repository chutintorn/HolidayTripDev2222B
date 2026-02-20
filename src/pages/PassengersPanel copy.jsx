// src/pages/PassengersPanel.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSelector } from "react-redux";

import TravellerForm from "../components/TravellerForm";
import ContactInformation from "../components/ContactInformation";
import Chip from "../components/Chip";
import SeatMapPanel from "../components/SeatMapPanel";

// ✅ Baggage panel (BGxx / SBxx per leg)
import BaggagePanel from "../components/BaggagePanel";

// ✅ Meal panel (MH/MS + BEV per leg)
import MealPanel from "../components/MealPanel";

/* ========================= small hook: isMobile ========================= */
function useIsMobile(query = "(max-width: 640px)") {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(!!mql.matches);
    onChange();

    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return isMobile;
}

/* ========================= Preview Summary helpers ========================= */
function norm(v) {
  return String(v || "").trim();
}
function normUpper(v) {
  return String(v || "").trim().toUpperCase();
}
function labelForLeg(idx, total, t) {
  if (total >= 2) {
    if (idx === 0) return t?.depart || t?.legDepart || "Depart";
    return t?.return || t?.legReturn || "Return";
  }
  return t?.depart || t?.legDepart || "Depart";
}
function extractFlightNumberFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m =
    /_([A-Z]{2}\d{2,4})20\d{6}/.exec(s) || /_([A-Z]{2}\d{2,4})/.exec(s);
  return m ? m[1] : "";
}
function seatCodeFromSeatObj(seatObj) {
  if (!seatObj) return "";
  if (typeof seatObj === "string") return seatObj;
  const s = seatObj.seatCode || seatObj.seat || seatObj.seatNumber;
  if (s) return String(s);
  if (seatObj.rowNumber && seatObj.column) return `${seatObj.rowNumber}${seatObj.column}`;
  return "";
}
function pillClass(status) {
  if (status === "confirmed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "selecting") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}
function resolveSeatStatus(savedSeat, draftSeat) {
  const saved = seatCodeFromSeatObj(savedSeat);
  const draft = seatCodeFromSeatObj(draftSeat);
  if (saved) return { value: saved, status: "confirmed" };
  if (draft) return { value: draft, status: "selecting" };
  return { value: "-", status: "none" };
}
function resolveBagStatus(savedLeg, draftLeg) {
  const sBg = normUpper(savedLeg?.bg?.ssrCode);
  const sSb = normUpper(savedLeg?.sb?.ssrCode);
  const dBg = normUpper(draftLeg?.bg?.ssrCode);
  const dSb = normUpper(draftLeg?.sb?.ssrCode);

  const savedAny = !!(sBg || sSb);
  const draftAny = !!(dBg || dSb);

  return {
    bg: savedAny ? (sBg || "-") : draftAny ? (dBg || "-") : "-",
    sb: savedAny ? (sSb || "-") : draftAny ? (dSb || "-") : "-",
    status: savedAny ? "confirmed" : draftAny ? "selecting" : "none",
  };
}

export default function PassengersPanel({
  passengerTopRef,
  t,
  travellers,
  forms,
  showForm,
  setShowForm,
  updateForm,
  isComplete,
  firstAdultName,
  titleFromForm,
  snapshotRef,
  scrollToPassengerTop,
  ANCILLARY_TABS,
  activeAncByPax,
  setActiveAncByPax,
  ancBtnClass,
  contact,
  setContact,
  showContactErrors,
  selectedOffers = [],
  rawDetail, // ✅ price detail response (airlines[].availableExtraServices)
}) {
  const deepCopy = (x) => JSON.parse(JSON.stringify(x || {}));
  useIsMobile();

  /* ========================= Redux: read draft/saved seat & baggage ========================= */
  const seatDraft = useSelector((s) => s?.seatSelection?.draft || {});
  const seatSaved = useSelector((s) => s?.seatSelection?.saved || {});
  const bagDraft = useSelector((s) => s?.baggageSelection?.draft || {});
  const bagSaved = useSelector((s) => s?.baggageSelection?.saved || {});

  const cardRefs = useRef({});
  const lastAncRef = useRef(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [flashPaxId, setFlashPaxId] = useState("");
  const flashCard = (paxId) => {
    setFlashPaxId(paxId);
    window.setTimeout(() => setFlashPaxId(""), 650);
  };

  const FlashStyle = useMemo(
    () => (
      <style>{`
        @keyframes paxFlash {
          0%   { box-shadow: 0 0 0 0 rgba(2,132,199,0.0); border-color: #e2e8f0; }
          20%  { box-shadow: 0 0 0 6px rgba(2,132,199,0.15); border-color: #7dd3fc; }
          100% { box-shadow: 0 0 0 0 rgba(2,132,199,0.0); border-color: #e2e8f0; }
        }
        .pax-flash { animation: paxFlash 650ms ease-out; border-color:#7dd3fc !important; }
      `}</style>
    ),
    []
  );

  const smoothScrollToPax = useCallback((paxId) => {
    if (typeof window === "undefined") return;
    const el = cardRefs.current[paxId];
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const currentY = window.scrollY || 0;

    const OFFSET = 80;
    const targetY = Math.max(0, currentY + rect.top - OFFSET);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }, []);

  const handleToggleView = (paxId) => {
    setShowForm((s) => {
      const nextOpen = !s[paxId];
      if (nextOpen) snapshotRef.current[paxId] = deepCopy(forms[paxId] || {});
      return { ...s, [paxId]: nextOpen };
    });

    const wasOpen = !!showForm[paxId];
    if (!wasOpen) requestAnimationFrame(scrollToPassengerTop);
  };

  const handleSave = (paxId) => {
    setShowForm((s) => ({ ...s, [paxId]: false }));
    setActiveAncByPax?.((prev) => ({ ...prev, [paxId]: prev?.[paxId] ?? null }));
  };

  const handleCancel = (paxId) => {
    const snap = snapshotRef?.current?.[paxId];
    if (snap) updateForm(paxId, deepCopy(snap));
    setShowForm((s) => ({ ...s, [paxId]: false }));
    setActiveAncByPax?.((prev) => ({ ...prev, [paxId]: null }));
  };

  const findNextPaxIdLoop = (currentId) => {
    const idx = travellers.findIndex((x) => x.id === currentId);
    if (idx < 0) return "";
    return travellers[(idx + 1) % travellers.length]?.id || "";
  };

  const openOnlyThisPassenger = useCallback(
    (paxIdToOpen) => {
      setShowForm((prev) => {
        const next = { ...prev };
        for (const p of travellers) next[p.id] = false;
        next[paxIdToOpen] = true;
        return next;
      });
    },
    [setShowForm, travellers]
  );

  const goNextPassenger = (currentId) => {
    const nextId = findNextPaxIdLoop(currentId);
    if (!nextId) return;

    const yBefore = typeof window !== "undefined" ? window.scrollY || 0 : 0;

    openOnlyThisPassenger(nextId);

    const nextType = travellers.find((x) => x.id === nextId)?.type;

    const currentTab = activeAncByPax?.[currentId] ?? null;
    const desiredTab = lastAncRef.current ?? currentTab ?? null;

    setActiveAncByPax?.((prev) => ({
      ...prev,
      [nextId]: nextType === "INF" ? null : desiredTab,
    }));

    if (nextType !== "INF" && desiredTab) lastAncRef.current = desiredTab;

    requestAnimationFrame(() => {
      if (typeof window !== "undefined") window.scrollTo({ top: yBefore });

      requestAnimationFrame(() => {
        flashCard(nextId);
        requestAnimationFrame(() => smoothScrollToPax(nextId));
      });
    });
  };

  const onClickAncTab = useCallback(
    (paxId, tabKey) => {
      setActiveAncByPax?.((prev) => {
        const cur = prev?.[paxId] ?? null;
        const next = cur === tabKey ? null : tabKey;
        if (next) lastAncRef.current = next;
        return { ...prev, [paxId]: next };
      });
    },
    [setActiveAncByPax]
  );

  const legs = useMemo(() => {
    const so = Array.isArray(selectedOffers) ? selectedOffers : [];
    return so
      .map((o, idx) => ({
        idx,
        journeyKey: String(o?.journeyKey || ""),
        label: labelForLeg(idx, so.length, t),
        flightNo: extractFlightNumberFromJourneyKey(o?.journeyKey),
      }))
      .filter((x) => x.journeyKey);
  }, [selectedOffers, t]);

  return (
    <div className="min-w-0">
      {FlashStyle}
      <div ref={passengerTopRef} className="h-0" />

      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
        <h2 className="text-lg font-semibold mb-3">{t.travellers}</h2>

        <div className="flex flex-col gap-3">
          {travellers.map((p) => {
            const v = forms[p.id] || {};
            const ok = isComplete(v);
            const open = !!showForm[p.id];

            const hasName =
              (v.firstName && v.firstName.trim()) || (v.lastName && v.lastName.trim());

            const fullName =
              v.firstName && v.lastName ? `${titleFromForm(v)} ${v.firstName} ${v.lastName}` : "";

            const showAncillaryForThisPax = p.type !== "INF";
            const activeForThisPax = activeAncByPax?.[p.id] ?? null;

            return (
              <div
                key={p.id}
                ref={(el) => {
                  if (el) cardRefs.current[p.id] = el;
                }}
                className={[
                  "border rounded-xl overflow-hidden bg-white border-slate-200",
                  flashPaxId === p.id ? "pax-flash" : "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <div className="font-extrabold">{p.label}</div>
                    <Chip ok={ok}>{ok ? t.completed : t.incomplete}</Chip>

                    {hasName ? (
                      <div
                        className="text-[11px] sm:text-xs text-slate-600 font-medium tracking-tight whitespace-normal break-words"
                        style={{ textShadow: "0 0 6px rgba(15, 23, 42, 0.08)" }}
                      >
                        <span className="text-slate-800 font-semibold">{fullName}</span>
                      </div>
                    ) : null}

                    {p.type === "INF" && firstAdultName ? (
                      <span className="text-sky-900 text-sm break-words">
                        {t.travellingWith} {firstAdultName}
                      </span>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleView(p.id)}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-extrabold hover:border-blue-400 hover:text-blue-700"
                  >
                    {open ? t.hide : t.view}
                  </button>
                </div>

                {open ? (
                  <div className="border-t border-slate-200">
                    <TravellerForm
                      t={t}
                      value={v}
                      onChange={(next) => updateForm(p.id, next)}
                      showSave={false}
                      points={95}
                    />

                    <div className="px-3 sm:px-4 pb-4">
                      <div className="pt-3 border-t border-slate-200 flex flex-col gap-4">
                        <div
                          className={
                            showAncillaryForThisPax
                              ? ["flex gap-2", "flex-col sm:flex-row", "w-full sm:w-auto"].join(" ")
                              : "hidden"
                          }
                        >
                          {showAncillaryForThisPax
                            ? ANCILLARY_TABS.map((tab) => {
                                const active = activeForThisPax === tab.key;
                                return (
                                  <button
                                    key={`${p.id}-${tab.key}`}
                                    type="button"
                                    onClick={() => onClickAncTab(p.id, tab.key)}
                                    className={[
                                      "flex items-center justify-center",
                                      "h-10 px-4 rounded-full font-semibold transition-colors",
                                      "text-sm",
                                      "w-full sm:w-auto",
                                      "min-w-0 sm:min-w-[120px]",
                                      ancBtnClass(active),
                                    ].join(" ")}
                                  >
                                    {tab.label}
                                  </button>
                                );
                              })
                            : null}
                        </div>

                        <div className="w-full">
                          <div className="flex items-center w-full gap-3">
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSave(p.id)}
                                className="shrink-0 rounded-lg px-3 py-1.5 bg-sky-600 text-white font-extrabold hover:bg-sky-700 text-[13px]"
                              >
                                {t.save}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancel(p.id)}
                                className="shrink-0 rounded-lg px-3 py-1.5 border border-slate-300 bg-white text-slate-700 font-extrabold hover:border-slate-400 text-[13px]"
                              >
                                {t.cancel}
                              </button>
                            </div>

                            <div className="ml-auto shrink-0">
                              <button
                                type="button"
                                onClick={() => goNextPassenger(p.id)}
                                className={[
                                  "inline-flex items-center justify-center",
                                  "min-w-[180px] sm:min-w-[260px]",
                                  "px-5 py-1.5",
                                  "rounded-2xl",
                                  "border border-sky-200",
                                  "bg-gradient-to-r from-sky-100 to-sky-50",
                                  "text-sky-700",
                                  "font-semibold",
                                  "text-[13px]",
                                  "shadow-sm",
                                  "hover:from-sky-100 hover:to-sky-100 hover:border-sky-300",
                                  "transition-all duration-200",
                                  "whitespace-nowrap",
                                ].join(" ")}
                              >
                                {t?.nextPassenger ?? "Next passenger"} →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {showAncillaryForThisPax ? (
                        activeForThisPax ? (
                          <div className="mt-3 border border-slate-200 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            {activeForThisPax === "seat" ? (
                              <div>
                                <div className="font-bold text-slate-900 mb-1">{t.ancSeat}</div>
                                <SeatMapPanel paxId={p.id} selectedOffers={selectedOffers} t={t} />
                              </div>
                            ) : activeForThisPax === "bag" ? (
                              <div>
                                <div className="font-bold text-slate-900 mb-1">{t.ancBag}</div>
                                <BaggagePanel
                                  paxId={p.id}
                                  selectedOffers={selectedOffers}
                                  rawDetail={rawDetail}
                                  t={t}
                                />
                              </div>
                            ) : activeForThisPax === "meal" ? (
                              <div>
                                {/* ✅ remove duplicate "Meal" heading here */}
                                <MealPanel
                                  paxId={p.id}
                                  selectedOffers={selectedOffers}
                                  rawDetail={rawDetail}
                                  t={t}
                                />
                              </div>
                            ) : activeForThisPax === "pb" ? (
                              <div>
                                <div className="font-bold text-slate-900 mb-1">{t.ancPb}</div>
                                <div>Priority boarding UI for this passenger.</div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold text-slate-900 mb-1">{t.ancAssist}</div>
                                <div>Assist / special service UI for this passenger.</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 border border-slate-200 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                            {t.ancPickOne}
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ========================= Contact Information ========================= */}
        <div className="mt-4">
          <ContactInformation
            t={t}
            value={contact}
            onChange={setContact}
            showErrors={showContactErrors}
          />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen((s) => !s)}
              className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-900 hover:bg-slate-50"
            >
              {previewOpen ? t?.hideSummary || "Hide summary" : t?.previewSummaryBtn || "Preview summary"}
            </button>
            <div className="text-xs text-slate-500">
              {t?.previewSummaryBelowHint || "Seat / BG / SB for all passengers (confirmed vs selecting)."}
            </div>
          </div>

          {previewOpen ? (
            <div className="mt-3 border border-slate-200 rounded-2xl bg-slate-50 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-extrabold text-slate-900">
                    {t?.previewSummary || "Preview summary"}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600">
                    {t?.previewSummaryHint || "Green = Saved (confirmed), Amber = Draft (selecting)."}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded-full border ${pillClass("confirmed")}`}>
                    {t?.confirmed || "Confirmed"}
                  </span>
                  <span className={`px-2 py-1 rounded-full border ${pillClass("selecting")}`}>
                    {t?.selecting || "Selecting"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {travellers.map((p) => {
                  const paxId = String(p?.id ?? "");
                  const v = forms?.[paxId] || {};
                  const fullName =
                    v.firstName && v.lastName
                      ? `${titleFromForm(v)} ${norm(v.firstName)} ${norm(v.lastName)}`.trim()
                      : norm(p?.label || p?.name || `Pax ${paxId}`);

                  return (
                    <div key={paxId} className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4">
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">
                          {fullName || `Pax ${paxId}`}
                        </div>
                        <div className="text-xs text-slate-500">{(p?.type || "").toUpperCase()}</div>
                      </div>

                      {legs.length ? (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {legs.map((leg) => {
                            const j = leg.journeyKey;

                            const savedSeat = seatSaved?.[paxId]?.[j] ?? null;
                            const draftSeat = seatDraft?.[paxId]?.[j] ?? null;
                            const seatRes = resolveSeatStatus(savedSeat, draftSeat);

                            const savedBagLeg = bagSaved?.[paxId]?.[j] ?? null;
                            const draftBagLeg = bagDraft?.[paxId]?.[j] ?? null;
                            const bagRes = resolveBagStatus(savedBagLeg, draftBagLeg);

                            const hasAnySelecting =
                              seatRes.status === "selecting" || bagRes.status === "selecting";
                            const hasAnyConfirmed =
                              seatRes.status === "confirmed" || bagRes.status === "confirmed";
                            const overallStatus = hasAnyConfirmed
                              ? "confirmed"
                              : hasAnySelecting
                              ? "selecting"
                              : "none";

                            return (
                              <div key={j} className="border border-slate-200 rounded-xl bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-extrabold text-slate-900">
                                    {leg.label}
                                    {leg.flightNo ? (
                                      <span className="ml-2 text-xs font-normal text-slate-500">
                                        {leg.flightNo}
                                      </span>
                                    ) : null}
                                  </div>
                                  <span className={`px-2 py-1 rounded-full border text-[11px] ${pillClass(overallStatus)}`}>
                                    {overallStatus === "confirmed"
                                      ? t?.confirmed || "Confirmed"
                                      : overallStatus === "selecting"
                                      ? t?.selecting || "Selecting"
                                      : t?.notSelected || "Not selected"}
                                  </span>
                                </div>

                                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                                  <div className="rounded-lg bg-white border border-slate-200 p-2">
                                    <div className="text-[11px] text-slate-500">{t?.seatLabel || "Seat"}</div>
                                    <div className={`font-extrabold ${seatRes.value === "-" ? "text-slate-400" : "text-slate-900"}`}>
                                      {seatRes.value}
                                    </div>
                                    <div className="mt-1">
                                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${pillClass(seatRes.status)}`}>
                                        {seatRes.status === "confirmed"
                                          ? t?.confirmed || "Confirmed"
                                          : seatRes.status === "selecting"
                                          ? t?.selecting || "Selecting"
                                          : t?.notSelected || "Not selected"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="rounded-lg bg-white border border-slate-200 p-2">
                                    <div className="text-[11px] text-slate-500">{t?.bgLabel || "BG"}</div>
                                    <div className={`font-extrabold ${bagRes.bg === "-" ? "text-slate-400" : "text-slate-900"}`}>
                                      {bagRes.bg}
                                    </div>
                                    <div className="mt-1">
                                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${pillClass(bagRes.status)}`}>
                                        {bagRes.status === "confirmed"
                                          ? t?.confirmed || "Confirmed"
                                          : bagRes.status === "selecting"
                                          ? t?.selecting || "Selecting"
                                          : t?.notSelected || "Not selected"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="rounded-lg bg-white border border-slate-200 p-2">
                                    <div className="text-[11px] text-slate-500">{t?.sbLabel || "SB"}</div>
                                    <div className={`font-extrabold ${bagRes.sb === "-" ? "text-slate-400" : "text-slate-900"}`}>
                                      {bagRes.sb}
                                    </div>
                                    <div className="mt-1">
                                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${pillClass(bagRes.status)}`}>
                                        {bagRes.status === "confirmed"
                                          ? t?.confirmed || "Confirmed"
                                          : bagRes.status === "selecting"
                                          ? t?.selecting || "Selecting"
                                          : t?.notSelected || "Not selected"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-600">
                          {t?.noLegs || "No flight legs found (missing journeyKey)."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
