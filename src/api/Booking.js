// src/api/Booking.js
// Map UI form -> backend (NOK) schema. Keep backend as-is.

export async function searchFlights(form, { signal } = {}) {
  const BASE = import.meta.env.VITE_API_BASE || "https://nodebasic-production-76d7.up.railway.app/";

  // Normalize IATA + dates
  const origin = String(form.origin || "").trim().toUpperCase();
  const destination = String(form.destination || "").trim().toUpperCase();
  const depart = String(form.depart || "");
  const ret = form.ret ? String(form.ret) : null;

  // Build journeys[]
  const journeys = [];
  if (origin && destination && depart) {
    journeys.push({ origin, destination, departureDate: depart });
    if (form.tripType === "roundtrip" && ret) {
      journeys.push({ origin: destination, destination: origin, departureDate: ret });
    }
  }

  // Flatten pax counts (fallback to form.pax if present)
  const adult  = Number(form.adult ?? form?.pax?.ADT ?? 0);
  const child  = Number(form.child ?? form?.pax?.CHD ?? 0);
  const infant = Number(form.infant ?? form?.pax?.INF ?? 0);

  // Assemble backend/NOK payload
  const payload = {
    agencyCode: form.agencyCode ?? "",
    currency:   form.currency   ?? "THB",
    adult,
    child,
    infant,
    journeys,
    // Only include promoCode when non-empty (avoid null)
    ...(typeof form.promoCode === "string" && form.promoCode.trim()
      ? { promoCode: form.promoCode.trim() }
      : {}),
  };

  const res = await fetch(`${BASE}/flights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Search failed: ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`);
  }
  return res.json();
}

// Optional alias to match older code
export const getAvailableFlights = searchFlights;
