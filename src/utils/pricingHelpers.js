// src/utils/pricingHelpers.js

/* ========================= Pax Helpers (robust) ========================= */

/**
 * Crawl the whole object and collect every pricingDetails array we can find.
 * Works with:
 * - root.pricingDetails
 * - root.data.pricingDetails
 * - root.airlines[].pricingDetails
 * - root.data.airlines[].pricingDetails
 * - any nested object containing an array that looks like pax pricing rows
 */
function collectAllPricingDetails(root) {
  const buckets = [];
  if (!root || typeof root !== "object") return buckets;

  const pushIfArray = (arr) => {
    if (Array.isArray(arr)) buckets.push(arr);
  };

  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    // Direct hits
    pushIfArray(node.pricingDetails);
    pushIfArray(node?.data?.pricingDetails);

    // airlines[] (any index)
    const airlines = node?.airlines || node?.data?.airlines;
    if (Array.isArray(airlines)) {
      for (const a of airlines) pushIfArray(a?.pricingDetails);
    }

    // Walk deeper
    for (const v of Object.values(node)) {
      if (!v) continue;

      // If it's an array, see if it looks like pax pricing entries
      if (Array.isArray(v) && v.length && typeof v[0] === "object") {
        const looksLikePax =
          v.some(
            (p) =>
              p &&
              typeof p === "object" &&
              ("paxTypeCode" in p || "pax_type" in p) &&
              ("paxCount" in p || "count" in p)
          );
        if (looksLikePax) buckets.push(v);
      }

      if (v && typeof v === "object") stack.push(v);
    }
  }

  return buckets;
}

/** Normalize pax type strings to 'adult' | 'child' | 'infant'. */
function normType(t) {
  const s = String(t || "").trim().toLowerCase();
  if (s === "adult" || s === "adt") return "adult";
  if (s === "child" || s === "chd") return "child";
  if (s === "infant" || s === "inf") return "infant";
  return null;
}

/**
 * Public API: Get party size from the priced payload.
 * We take the **MAX** across all pricingDetails buckets so round trips (OUT/IN)
 * which repeat the same party won't be double-counted.
 *
 * Returns an object like: { adult: 2, child: 1, infant: 0 }
 */
export function paxFromFirstPricingDetails(detailLike) {
  const buckets = collectAllPricingDetails(detailLike);
  const out = { adult: 0, child: 0, infant: 0 };

  for (const arr of buckets) {
    for (const p of arr) {
      const key = normType(p?.paxTypeCode ?? p?.pax_type);
      if (!key) continue;
      const n = Number(p?.paxCount ?? p?.count ?? 0) || 0;
      if (n > out[key]) out[key] = n;
    }
  }
  return out;
}

/**
 * (Optional) Legacy helper kept for compatibility in case other code imports it.
 * Now safer: finds the FIRST airline that actually has pricingDetails (no [0] assumption).
 */
function firstPricingDetailsBucket(root) {
  if (!root || typeof root !== "object") return null;

  if (Array.isArray(root.pricingDetails)) return root.pricingDetails;
  if (Array.isArray(root?.data?.pricingDetails)) return root.data.pricingDetails;

  const pickFirstWithPD = (airlines) => {
    if (!Array.isArray(airlines)) return null;
    const hit = airlines.find((a) => Array.isArray(a?.pricingDetails));
    return hit ? hit.pricingDetails : null;
  };

  const fromRoot = pickFirstWithPD(root.airlines);
  if (fromRoot) return fromRoot;

  const fromData = pickFirstWithPD(root?.data?.airlines);
  if (fromData) return fromData;

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
