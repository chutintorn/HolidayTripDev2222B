// ✅ New file to generate a consistent request key for pricing
export function makePriceKey(offers = []) {
  return offers
    .filter(Boolean)
    .map(o => `${o?.journeyKey || ""}|${o?.fareKey || ""}`)
    .sort()
    .join("||");
}
