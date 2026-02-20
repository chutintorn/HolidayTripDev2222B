// src/components/BaggagePanel.jsx
import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  setDraftBaggage,
  saveBaggage,
  clearDraftBaggage,
  clearSavedBaggage,
  selectDraftBaggage,
  selectSavedBaggage,
} from "../redux/baggageSelectionSlice";

/* flightNumber from journeyKey: "DMKCNX..._DD12420260215" -> "DD124" */
function extractFlightNumberFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /_([A-Z]{2}\d{2,4})20\d{6}/.exec(s) || /_([A-Z]{2}\d{2,4})/.exec(s);
  return m ? m[1] : "";
}

function pickAirlinesFromRawDetail(rawDetail) {
  if (!rawDetail) return [];

  // proxy mode shape: { data: { airlines: [...] } }
  const a1 = rawDetail?.data?.airlines;
  if (Array.isArray(a1)) return a1;

  // sometimes: { detail: { data: { airlines: [...] } } }
  const a2 = rawDetail?.detail?.data?.airlines;
  if (Array.isArray(a2)) return a2;

  // sometimes: legs merged: { legs: [ { data:{airlines:[...]} }, ... ] }
  const legs = rawDetail?.legs;
  if (Array.isArray(legs)) {
    const merged = [];
    for (const leg of legs) {
      const al = leg?.data?.airlines;
      if (Array.isArray(al)) merged.push(...al);
    }
    return merged;
  }

  return [];
}

function formatMoney(x, currency = "THB") {
  const n = Number(x);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export default function BaggagePanel({
  paxId,
  selectedOffers = [],
  rawDetail,
  t = {},
}) {
  const dispatch = useDispatch();

  const airlines = useMemo(() => pickAirlinesFromRawDetail(rawDetail), [rawDetail]);

  const legs = useMemo(() => {
    return (selectedOffers || [])
      .filter(Boolean)
      .map((o, idx) => ({
        idx,
        journeyKey: o.journeyKey || "",
        fareKey: o.fareKey || "",
        flightNumber: extractFlightNumberFromJourneyKey(o.journeyKey),
      }))
      .filter((x) => x.journeyKey);
  }, [selectedOffers]);

  const findServicesForLeg = (flightNumber) => {
    if (!flightNumber) return { bg: [], sb: [] };

    const airline = airlines.find((a) => {
      const infos = a?.travelInfos || [];
      return infos.some(
        (ti) =>
          String(ti?.flightNumber || "").toUpperCase() ===
          String(flightNumber).toUpperCase()
      );
    });

    const services = airline?.availableExtraServices || [];

    // BGxx and SBxx (2 digits)
    const bg = services.filter((s) => /^BG\d{2}$/.test(String(s?.ssrCode || "").toUpperCase()));
    const sb = services.filter((s) => /^SB\d{2}$/.test(String(s?.ssrCode || "").toUpperCase()));
    return { bg, sb };
  };

  if (!legs.length) {
    return (
      <div className="text-sm text-slate-600">
        {t.noFlights ?? "No flight legs found."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {legs.map((leg) => {
        // ✅ Hooks are safe here if legs length is stable for this render
        const draft = useSelector(selectDraftBaggage(paxId, leg.journeyKey));
        const saved = useSelector(selectSavedBaggage(paxId, leg.journeyKey));

        const current = {
          bg: draft?.bg ?? saved?.bg ?? null,
          sb: draft?.sb ?? saved?.sb ?? null,
        };

        const { bg: bgOptions, sb: sbOptions } = findServicesForLeg(leg.flightNumber);

        const title =
          leg.idx === 0 ? (t.departFlight ?? "Depart flight") : (t.returnFlight ?? "Return flight");

        return (
          <div key={leg.journeyKey} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold text-slate-900">
                {title}{" "}
                <span className="text-slate-500 font-semibold">
                  ({leg.flightNumber || "—"})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => dispatch(saveBaggage({ paxId, journeyKey: leg.journeyKey }))}
                  className="rounded-lg px-3 py-1.5 bg-sky-600 text-white font-extrabold hover:bg-sky-700 text-[13px]"
                >
                  {t.save ?? "Save"}
                </button>

                <button
                  type="button"
                  onClick={() => dispatch(clearDraftBaggage({ paxId, journeyKey: leg.journeyKey }))}
                  className="rounded-lg px-3 py-1.5 border border-slate-300 bg-white text-slate-700 font-extrabold hover:border-slate-400 text-[13px]"
                >
                  {t.cancel ?? "Cancel"}
                </button>

                <button
                  type="button"
                  onClick={() => dispatch(clearSavedBaggage({ paxId, journeyKey: leg.journeyKey }))}
                  className="rounded-lg px-3 py-1.5 border border-rose-200 bg-rose-50 text-rose-700 font-extrabold hover:border-rose-300 text-[13px]"
                >
                  {t.remove ?? "Remove"}
                </button>
              </div>
            </div>

            {/* BG group */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-bold text-slate-900 mb-2">
                {t.bagChecked ?? "Baggage (BGxx)"}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`bg-${paxId}-${leg.journeyKey}`}
                    checked={!current.bg}
                    onChange={() =>
                      dispatch(
                        setDraftBaggage({
                          paxId,
                          journeyKey: leg.journeyKey,
                          kind: "BG",
                          service: null,
                        })
                      )
                    }
                  />
                  <span className="text-slate-700">{t.none ?? "None"}</span>
                </label>

                {bgOptions.map((s) => {
                  const code = String(s?.ssrCode || "").toUpperCase();
                  const checked = String(current.bg?.ssrCode || "").toUpperCase() === code;

                  return (
                    <label key={code} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`bg-${paxId}-${leg.journeyKey}`}
                        checked={checked}
                        onChange={() =>
                          dispatch(
                            setDraftBaggage({
                              paxId,
                              journeyKey: leg.journeyKey,
                              kind: "BG",
                              service: {
                                ssrCode: code,
                                description: s?.description || "",
                                amount: s?.amount ?? 0,
                                currency: s?.currency || "THB",
                                vat: s?.vat,
                                flightNumber: s?.flightNumber || leg.flightNumber,
                                departureDate: s?.departureDate,
                              },
                            })
                          )
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {code}{" "}
                          <span className="font-normal text-slate-600">
                            {s?.description || ""}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          {formatMoney(s?.amount, s?.currency || "THB")}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* SB group */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-bold text-slate-900 mb-2">
                {t.bagSpecial ?? "Special Bag (SBxx)"}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`sb-${paxId}-${leg.journeyKey}`}
                    checked={!current.sb}
                    onChange={() =>
                      dispatch(
                        setDraftBaggage({
                          paxId,
                          journeyKey: leg.journeyKey,
                          kind: "SB",
                          service: null,
                        })
                      )
                    }
                  />
                  <span className="text-slate-700">{t.none ?? "None"}</span>
                </label>

                {sbOptions.map((s) => {
                  const code = String(s?.ssrCode || "").toUpperCase();
                  const checked = String(current.sb?.ssrCode || "").toUpperCase() === code;

                  return (
                    <label key={code} className="flex items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name={`sb-${paxId}-${leg.journeyKey}`}
                        checked={checked}
                        onChange={() =>
                          dispatch(
                            setDraftBaggage({
                              paxId,
                              journeyKey: leg.journeyKey,
                              kind: "SB",
                              service: {
                                ssrCode: code,
                                description: s?.description || "",
                                amount: s?.amount ?? 0,
                                currency: s?.currency || "THB",
                                vat: s?.vat,
                                flightNumber: s?.flightNumber || leg.flightNumber,
                                departureDate: s?.departureDate,
                              },
                            })
                          )
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {code}{" "}
                          <span className="font-normal text-slate-600">
                            {s?.description || ""}
                          </span>
                        </div>
                        <div className="text-slate-600">
                          {formatMoney(s?.amount, s?.currency || "THB")}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
