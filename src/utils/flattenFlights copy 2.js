/* ---------- helpers ---------- */
function hhmmFromDateTime(s) {
  if (!s) return "";
  // รองรับ "YYYY-MM-DD HH:mm:ss" และ "YYYY-MM-DDTHH:mm:ss"
  const str = String(s);
  const parts = str.includes("T") ? str.split("T") : str.split(" ");
  const time = (parts[1] || "").slice(0, 5);   // "HH:mm"
  const clock = time.replace(":", "");          // "HHmm"
  return clock || "";
}

function money(val) {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  return Number.isFinite(n) ? n : String(val);
}

const up = (v) => (v || "").toString().trim().toUpperCase();
const cleanIata = (v) => up(v);

/* ---------- main ---------- */
// Supports both shapes:
//  A) days[].journey[].fares[]     (Nok legacy search)
//  B) itineraries[].offers[]       (aggregated shape)
export function flattenFlights(input = [], securityTokenFromServer) {
  const out = [];

  /* ========= A) Array of days ========= */
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

        // หา LITE เท่านั้น (ชื่อ product อาจเป็น "NOK LITE" หรือ "LITE")
        const lite = fares.find((f) => up(f.productName) === "NOK LITE" || up(f.productName) === "LITE");
        if (!lite) return; // ไม่มี LITE → ข้ามไฟลต์นี้

        const pax0 = (lite.paxFareTaxBreakdown || [])[0] || {};
        const fareKey = lite.fareKey || "";
        const journeyKey = jou.journeyKey || "";

        if (!fareKey || !journeyKey) return; // คีย์ไม่ครบ → ข้าม

        // (ออปชัน) ถ้าต้องการโชว์ราคาแพ็กอื่นบนการ์ด สามารถคงไว้ได้
        const amtByName = (name) =>
          fares.find((f) => up(f.productName) === up(name))?.paxFareTaxBreakdown?.[0]?.fareAmountIncludingTax ?? "";

        const others = fares
          .filter((f) => f.fareKey && f.fareKey !== fareKey)
          .map((f) => f.fareKey);

        out.push({
          id: `${journeyKey}-${fareKey}`,
          departureTime: dep,
          arrivalTime: arr,
          duration: dur,
          flightNumber: combinedFlightNumber,
          aircraftDescription: ac,

          // แสดงเฉพาะ LITE
          brand: "LITE",
          fareAmountIncludingTax: money(pax0.fareAmountIncludingTax),

          // (ออปชัน) เผื่อ UI เดิมใช้ field นี้อยู่
          nokXtraAmount: money(amtByName("NOK XTRA")),
          nokMaxAmount:  money(amtByName("NOK MAX")),

          fareKey,
          farekey1: others[0] || "",
          farekey2: others[1] || "",
          journeyKey,

          origin: cleanIata(jou.origin || day.origin || ""),
          destination: cleanIata(jou.destination || day.destination || ""),
          departureDate: jou.departureDate || "",

          securityToken: securityTokenFromServer || `token-${journeyKey}`,
        });
      });
    });
    return out;
  }

  /* ========= B) Object with itineraries[] ========= */
  if (input && Array.isArray(input.itineraries)) {
    const currency = input.currency || "THB";

    input.itineraries.forEach((it, idx) => {
      const segs = Array.isArray(it.segments) ? it.segments : [];
      const first = segs[0] || {};
      const last  = segs[segs.length - 1] || {};

      const dep = first.depTime
        ? String(first.depTime).replace(":", "").slice(0, 4)
        : hhmmFromDateTime(it.departureDate || "");
      const arr = last.arrTime
        ? String(last.arrTime).replace(":", "").slice(0, 4)
        : hhmmFromDateTime(it.arrivalDate || "");

      const combinedFlightNumber = segs.map((s) => s.flightNo || s.flightNumber).filter(Boolean).join("/");
      const ac = (first.aircraft || first.aircraftDescription || "").toString().replace(/\([^)]*\)/g, "").trim();

      const offers = Array.isArray(it.offers) ? it.offers : [];
      // หา LITE เท่านั้น (เช็กได้ทั้ง brandName / brand)
      const lite =
        offers.find((o) => up(o.brandName).includes("LITE") || up(o.brand).includes("LITE")) || null;
      if (!lite) return; // ไม่มี LITE → ข้ามเที่ยวนี้

      const fareKey = lite.fareKey || lite.id || "";
      const journeyKey = it.journeyKey || it.id || "";
      if (!fareKey || !journeyKey) return; // คีย์ไม่ครบ → ข้าม

      const litePrice = lite?.price ?? lite?.total ?? "";

      out.push({
        id: `${it.id || `it-${idx}`}-${fareKey || "lite"}`,
        departureTime: dep,
        arrivalTime: arr,
        duration: it.duration || first.duration || "",
        flightNumber: combinedFlightNumber,
        aircraftDescription: ac,

        // LITE only
        brand: "LITE",
        fareAmountIncludingTax: money(litePrice),

        fareKey,
        farekey1: "", // ไม่ใช้ (คง field ไว้กัน UI พัง)
        farekey2: "",
        journeyKey,

        origin: cleanIata(it.origin || first.dep || ""),
        destination: cleanIata(it.destination || last.arr || ""),
        departureDate: it.departureDate || first.depDate || "",

        securityToken: input.securityToken || securityTokenFromServer || "",
        currency,
      });
    });
    return out;
  }

  return out;
}
