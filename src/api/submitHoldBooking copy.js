export default async function submitHoldBooking(payload, { signal } = {}) {
  const BASE =
    import.meta.env.VITE_API_BASE ||
    "https://nodebasic2222b-production.up.railway.app";
  const res = await fetch(`${BASE}/submit-hold-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Hold failed: ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`
    );
  }
  return res.json();
}
//