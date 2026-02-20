import React, { useMemo } from "react";

/* ========= helpers ========= */
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function extractFlightNumberFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m =
    /_([A-Z]{2}\d{2,4})20\d{6}/.exec(s) || /_([A-Z]{2}\d{2,4})/.exec(s);
  return m ? m[1] : "";
}

function extractIsoFromJourneyKey(journeyKey) {
  const s = String(journeyKey || "");
  const m = /(20\d{2})(\d{2})(\d{2})/.exec(s);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function routeLabel(offer) {
  const o = String(offer?.origin || offer?.from || "").toUpperCase();
  const d = String(offer?.destination || offer?.to || "").toUpperCase();
  if (o && d) return `${o} → ${d}`;
  return "";
}

function toDateObj(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? null : d;
}

function dowShort(d, lang = "en") {
  if (!d) return "";
  const namesEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const namesTH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const idx = d.getDay();
  return lang === "th" ? namesTH[idx] : namesEN[idx];
}

function ddMMM(d, lang = "en") {
  if (!d) return "";
  try {
    return d.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

const dowChip = {
  Mon: { bg: "#FFF3B0", text: "#111827" },
  Tue: { bg: "#FFD1E8", text: "#111827" },
  Wed: { bg: "#CFFAE1", text: "#111827" },
  Thu: { bg: "#FFE0B2", text: "#111827" },
  Fri: { bg: "#BEE3FF", text: "#111827" },
  Sat: { bg: "#E9D5FF", text: "#111827" },
  Sun: { bg: "#FFD6CC", text: "#111827" },
};

function toNumber(v) {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function getCurrency(offer, fallback = "THB") {
  return offer?.currency || offer?.currencyCode || offer?.priceCurrency || fallback;
}

/**
 * Tries many common fields for "selected price".
 */
function pickPrice(offer) {
  if (!offer) return null;

  const candidates = [
    offer.fareAmountIncludingTax,
    offer.fareAmount,
    offer.totalFare,
    offer.totalPrice,
    offer.totalAmount,
    offer.amount,
    offer.price,
    offer.fare,
    offer.grandTotal,
    offer.total,
    offer?.pricing?.total,
    offer?.pricing?.totalAmount,
    offer?.pricing?.grandTotal,
  ];

  for (const c of candidates) {
    const n = toNumber(c);
    if (n !== null) return n;
  }
  return null;
}

function fmtMoney(amount, currency = "THB") {
  const n = toNumber(amount);
  if (n === null) return "";
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Props:
 * - lang: "en" | "th"
 * - selectedOffers: array [outbound, inbound?]
 * - requireTwoLegs: boolean
 * - showDetails: boolean (dev only)
 * - paxCount: number (optional)
 * - currency: string (fallback)
 */
export default function FlightSelectionSummary({
  lang = "en",
  selectedOffers = [],
  requireTwoLegs = false,
  showDetails = false,
  paxCount,
  currency = "THB",
}) {
  const offers = useMemo(
    () => safeArray(selectedOffers).filter(Boolean),
    [selectedOffers]
  );

  const t = useMemo(() => {
    const TH = {
      empty: "ยังไม่ได้เลือกเที่ยวบิน",
      depart: "Depart",
      ret: "Return",
      flight: "Flight",
      date: "Date",
      total: "Total",
      perPax: "ต่อคน",
      details: "ข้อมูลเทคนิค (ทดสอบเท่านั้น)",
      fareKey: "FareKey",
      journeyKey: "JourneyKey",
    };
    const EN = {
      empty: "No flight selected yet.",
      depart: "Depart",
      ret: "Return",
      flight: "Flight",
      date: "Date",
      total: "Total",
      perPax: "per pax",
      details: "Debug details (testing only)",
      fareKey: "FareKey",
      journeyKey: "JourneyKey",
    };
    return lang === "th" ? TH : EN;
  }, [lang]);

  const mustHaveTwo = !!requireTwoLegs;

  const blocks = useMemo(() => {
    const out = offers[0] || null;
    const inn = offers[1] || null;
    return [
      { key: "depart", label: t.depart, offer: out },
      ...(mustHaveTwo ? [{ key: "return", label: t.ret, offer: inn }] : []),
    ];
  }, [offers, mustHaveTwo, t.depart, t.ret]);

  const totals = useMemo(() => {
    const prices = offers.map((o) => pickPrice(o)).filter((n) => n !== null);
    const sum = prices.reduce((a, b) => a + b, 0);
    const cur =
      offers.map((o) => getCurrency(o, "")).find((x) => x) || currency || "THB";
    return {
      sum,
      cur,
      haveAllLegPrices: prices.length === offers.length && offers.length > 0,
    };
  }, [offers, currency]);

  const OfferCard = ({ offer }) => {
    const jKey = offer?.journeyKey;
    const flightNo =
      extractFlightNumberFromJourneyKey(jKey) || offer?.flightNumber || "";

    const iso = extractIsoFromJourneyKey(jKey) || offer?.date || "";
    const dObj = toDateObj(iso);

    const dowEN = dowShort(dObj, "en");
    const chip = dowChip[dowEN] || { bg: "#E5E7EB", text: "#111827" };

    const cur = getCurrency(offer, currency);
    const price = pickPrice(offer);

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-slate-900">
              {routeLabel(offer) || "-"}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {dObj ? (
                <span
                  className="rounded px-3 py-1 text-[12px] font-bold"
                  style={{ backgroundColor: chip.bg, color: chip.text }}
                >
                  {dowShort(dObj, lang)}
                </span>
              ) : null}

              {dObj ? (
                <span className="text-[12px] font-semibold text-slate-700">
                  {ddMMM(dObj, lang)}
                </span>
              ) : (
                <span className="text-[12px] font-semibold text-slate-500">-</span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {price !== null ? (
              <div className="text-[14px] font-extrabold text-[#0b4f8a]">
                {fmtMoney(price, cur)}
              </div>
            ) : (
              <div className="text-[12px] font-semibold text-slate-500">-</div>
            )}

            {!!flightNo && (
              <div className="mt-1 inline-flex rounded-full bg-slate-900 px-3 py-1 text-[12px] font-bold text-white">
                {flightNo}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-500">{t.flight}</div>
            <div className="font-semibold text-slate-900">{flightNo || "-"}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-slate-500">{t.date}</div>
            <div className="font-semibold text-slate-900">{iso || "-"}</div>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
            <div className="text-[12px] font-bold text-slate-800">{t.details}</div>
            <div className="mt-1 text-[12px] text-slate-700 break-words">
              <span className="font-semibold">{t.fareKey}:</span>{" "}
              {String(offer?.fareKey || "") || "-"}
            </div>
            <div className="mt-1 text-[12px] text-slate-700 break-words">
              <span className="font-semibold">{t.journeyKey}:</span>{" "}
              {String(offer?.journeyKey || "") || "-"}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="space-y-3">
        {offers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-600">
            {t.empty}
          </div>
        ) : (
          blocks.map((b) => (
            <div key={b.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold text-slate-700">{b.label}</div>

                {b.offer ? (() => {
                  const cur = getCurrency(b.offer, currency);
                  const p = pickPrice(b.offer);
                  return p !== null ? (
                    <div className="text-[12px] font-extrabold text-[#0b4f8a]">
                      {fmtMoney(p, cur)}
                    </div>
                  ) : null;
                })() : null}
              </div>

              {b.offer ? (
                <OfferCard offer={b.offer} />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-600">
                  {t.empty}
                </div>
              )}
            </div>
          ))
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-bold text-slate-700">{t.total}</div>
            <div className="text-[14px] font-extrabold text-slate-900">
              {offers.length > 0 && totals.haveAllLegPrices
                ? fmtMoney(totals.sum, totals.cur)
                : "-"}
            </div>
          </div>

          {typeof paxCount === "number" && paxCount > 0 && offers.length > 0 && totals.haveAllLegPrices ? (
            <div className="mt-1 text-[11px] text-slate-600">
              {paxCount} pax · {t.perPax}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
