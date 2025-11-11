// src/utils/pricingHelpers.js

/* ========================= Pax Helpers ========================= */
export function paxFromFirstPricingDetails(detailLike) {
  const arr = firstPricingDetailsBucket(detailLike);
  const out = { adult: 0, child: 0, infant: 0 };
  if (!Array.isArray(arr)) {
    out.adult = 1;
    return out;
  }
  arr.forEach((p) => {
    const code = String(p?.paxTypeCode ?? p?.pax_type ?? "").toLowerCase();
    const n = Number(p?.paxCount ?? p?.count ?? 0) || 0;
    if (/^(adult|adt)$/.test(code)) out.adult += n;
    else if (/^(child|chd)$/.test(code)) out.child += n;
    else if (/^(infant|inf)$/.test(code)) out.infant += n;
  });
  if (!out.adult) out.adult = 1;
  return out;
}

function firstPricingDetailsBucket(root) {
  if (!root || typeof root !== "object") return null;
  if (Array.isArray(root.pricingDetails)) return root.pricingDetails;
  if (root.data && Array.isArray(root.data.pricingDetails))
    return root.data.pricingDetails;
  if (Array.isArray(root.airlines) && root.airlines[0]?.pricingDetails)
    return Array.isArray(root.airlines[0].pricingDetails)
      ? root.airlines[0].pricingDetails
      : null;
  if (
    root.data &&
    Array.isArray(root.data.airlines) &&
    root.data.airlines[0]?.pricingDetails
  )
    return Array.isArray(root.data.airlines[0].pricingDetails)
      ? root.data.airlines[0].pricingDetails
      : null;
  return null;
}

/* ========================= Date & Time Helpers ========================= */
export function safeDate(s) {
  if (!s) return null;
  const str = typeof s === "string" ? s.replace(" ", "T") : s;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDDMMM(d) {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul",
    "Aug","Sep","Oct","Nov","Dec"
  ][d.getMonth()];
  return `${dd}-${mon}`;
}

export function hhmm(d) {
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/* ========================= Segment Extraction ========================= */
function looksLikeSegment(x) {
  if (!x || typeof x !== "object") return false;
  const o = x.origin || x.from || x.depAirport || x.departureAirport;
  const d = x.destination || x.to || x.arrAirport || x.arrivalAirport;
  const dep =
    x.departureTime ||
    x.departureDateTime ||
    x.dep ||
    x.depTime ||
    x.std ||
    x.offBlockTime;
  return Boolean(o && d && dep);
}

function deepCollectSegments(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const v of node) deepCollectSegments(v, out);
    return out;
  }
  if (typeof node === "object") {
    if (looksLikeSegment(node)) out.push(node);
    for (const k of Object.keys(node)) deepCollectSegments(node[k], out);
    return out;
  }
  return out;
}

function normalizeSegment(x) {
  return {
    origin: x.origin || x.from || x.depAirport || x.departureAirport || "",
    destination:
      x.destination || x.to || x.arrAirport || x.arrivalAirport || "",
    depTime: safeDate(
      x.departureTime ||
        x.departureDateTime ||
        x.depTime ||
        x.dep ||
        x.std ||
        x.offBlockTime
    ),
    arrTime: safeDate(
      x.arrivalTime ||
        x.arrivalDateTime ||
        x.arrTime ||
        x.arr ||
        x.sta ||
        x.onBlockTime
    ),
    fn:
      x.flightNumber ||
      x.flightNo ||
      x.fn ||
      x.marketingFlightNumber ||
      "",
    dir: (x.direction || x.dir || "").toString().toUpperCase(),
  };
}

export function extractLegs(raw) {
  if (!raw) return [];

  const roots = Array.isArray(raw) ? raw : [raw];
  const bucket = new Map();

  for (const root of roots) {
    const segs = deepCollectSegments(root);
    const maybeRootSeg = looksLikeSegment(root) ? [root] : [];
    const all = [...segs, ...maybeRootSeg];

    for (const s of all) {
      const n = normalizeSegment(s);
      if (!n.fn || !n.depTime || !n.origin || !n.destination) continue;
      const key = `${n.origin}|${n.destination}|${n.depTime.toISOString()}`;
      if (!bucket.has(key)) bucket.set(key, n);
    }
  }

  const cleaned = [...bucket.values()].sort((a, b) => a.depTime - b.depTime);

  return cleaned.map((n, i) => {
    const inferred =
      n.dir === "OUT" || n.dir === "IN"
        ? n.dir
        : i === 0
        ? "OUT"
        : i === 1
        ? "IN"
        : `SEG-${i + 1}`;
    return {
      key: `${inferred}-${i + 1}`,
      origin: n.origin,
      destination: n.destination,
      depTime: n.depTime,
      arrTime: n.arrTime,
      fn: n.fn,
      dir: inferred,
    };
  });
}
