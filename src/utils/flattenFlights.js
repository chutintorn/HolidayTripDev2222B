function hhmmFromDateTime(s) {
  if (!s) return "";
  const parts = String(s).split(" ");
  const clock = (parts[1] || "").slice(0, 5).replace(":", "");
  return clock || "";
}
function money(val) {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  return Number.isFinite(n) ? n : String(val);
}

// Supports both shapes:
//  A) days[].journey[].fares[]
//  B) itineraries[].offers[]
export function flattenFlights(input = [], securityTokenFromServer) {
  const out = [];

  // A) Array of days
  if (Array.isArray(input)) {
    input.forEach((day) => {
      (day.journey || []).forEach((jou) => {
        const dep = hhmmFromDateTime(jou.departureDate);
        const arr = hhmmFromDateTime(jou.arrivalDate);

        const infos = Array.isArray(jou.travelInfos) ? jou.travelInfos : [];
        const combinedFlightNumber = infos.map((s) => s.flightNumber).filter(Boolean).join("/");
        const seg0 = infos[0] || {};
        const dur = seg0.duration || "";
        const ac = String(seg0.aircraftDescription || "").replace(/\([^)]*\)/g, "").trim();

        const fares = Array.isArray(jou.fares) ? jou.fares : [];
        const amtByName = (name) =>
          fares.find((f) => f.productName === name)?.paxFareTaxBreakdown?.[0]?.fareAmountIncludingTax ?? "";

        const lite = fares.find((f) => f.productName === "NOK LITE");
        if (!lite) return;

        const pax0 = (lite.paxFareTaxBreakdown || [])[0] || {};
        const others = fares.filter((f) => f.fareKey !== lite.fareKey).map((f) => f.fareKey);

        out.push({
          id: `${jou.journeyKey}-${lite.fareKey}`,
          departureTime: dep,
          arrivalTime: arr,
          duration: dur,
          flightNumber: combinedFlightNumber,
          aircraftDescription: ac,
          fareAmountIncludingTax: money(pax0.fareAmountIncludingTax),
          nokXtraAmount:          money(amtByName("NOK XTRA")),
          nokMaxAmount:           money(amtByName("NOK MAX")),
          fareKey:   lite.fareKey,
          farekey1:  others[0] || "",
          farekey2:  others[1] || "",
          journeyKey:    jou.journeyKey,
          origin:        jou.origin || day.origin || "",
          destination:   jou.destination || day.destination || "",
          departureDate: jou.departureDate || "",
          securityToken: securityTokenFromServer || `token-${jou.journeyKey}`,
        });
      });
    });
    return out;
  }

  // B) Object with itineraries[]
  if (input && Array.isArray(input.itineraries)) {
    const currency = input.currency || "THB";

    input.itineraries.forEach((it, idx) => {
      const segs = Array.isArray(it.segments) ? it.segments : [];
      const first = segs[0] || {};
      const last  = segs[segs.length - 1] || {};
      const dep = first.depTime ? String(first.depTime).replace(":", "").slice(0, 4) : "";
      const arr = last.arrTime  ? String(last.arrTime).replace(":", "").slice(0, 4) : "";
      const combinedFlightNumber = segs.map((s) => s.flightNo || s.flightNumber).filter(Boolean).join("/");
      const ac = (first.aircraft || first.aircraftDescription || "").toString().replace(/\([^)]*\)/g, "").trim();

      const offers = Array.isArray(it.offers) ? it.offers : [];
      const findByBrand = (name) =>
        offers.find((o) => (o.brandName || o.brand || "").toUpperCase().includes(name)) || null;

      const lite = findByBrand("LITE");
      const xtra = findByBrand("X-TRA") || findByBrand("XTRA");
      const max  = findByBrand("MAX");
      if (!lite) return;

      const litePrice = lite?.price ?? lite?.total ?? "";
      const xtraPrice = xtra?.price ?? xtra?.total ?? "";
      const maxPrice  = max?.price  ?? max?.total  ?? "";

      out.push({
        id: `${it.id || `it-${idx}`}-${lite.id || lite.fareKey || "lite"}`,
        departureTime: dep,
        arrivalTime: arr,
        duration: it.duration || first.duration || "",
        flightNumber: combinedFlightNumber,
        aircraftDescription: ac,
        fareAmountIncludingTax: money(litePrice),
        nokXtraAmount:          money(xtraPrice),
        nokMaxAmount:           money(maxPrice),
        fareKey:  lite.fareKey || lite.id || "",
        farekey1: xtra?.fareKey || xtra?.id || "",
        farekey2: max?.fareKey  || max?.id  || "",
        journeyKey: it.journeyKey || it.id || "",
        origin: it.origin || first.dep || "",
        destination: it.destination || last.arr || "",
        departureDate: it.departureDate || first.depDate || "",
        securityToken: input.securityToken || securityTokenFromServer || "",
        currency,
      });
    });
    return out;
  }

  return out;
}
