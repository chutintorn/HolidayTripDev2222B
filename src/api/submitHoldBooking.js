export default async function submitHoldBooking(payload, { signal } = {}) {
  const BASE =
    import.meta.env.VITE_API_BASE ||
    "https://nodebasic2222b-production.up.railway.app";

  // 🔍 LOG: payload ที่จะส่งออก (outbound)
  console.log("➡️ submitHoldBooking OUTBOUND payload:", payload);

  const res = await fetch(`${BASE}/submit-hold-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload),
  });

  // ❌ error case
  if (!res.ok) {
    const txt = await res.text().catch(() => "");

    // 🔍 LOG: error response จาก backend
    console.error("❌ submitHoldBooking ERROR response:", {
      status: res.status,
      statusText: res.statusText,
      body: txt,
    });

    throw new Error(
      `Hold failed: ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`
    );
  }

  // ✅ success case
  const data = await res.json();

  // 🔍 LOG: response ที่ backend ส่งกลับ
  console.log("⬅️ submitHoldBooking RESPONSE:", data);

  return data;
}
