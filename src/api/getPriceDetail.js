export async function getPriceDetail({ offerId, passengers, ancillaries }, { signal } = {}) {
  const BASE = import.meta.env.VITE_API_BASE || "https://nodebasic-production-76d7.up.railway.app";
  const res = await fetch(`${BASE}/pricedetails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      offerId,
      passengers,
      securityToken: ancillaries?.securityToken,
      journeyKey: ancillaries?.journeyKey,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Price failed: ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`);
  }
  return res.json(); // { total, taxes, base, brand, fareKey, rules, currency, ... }
}
