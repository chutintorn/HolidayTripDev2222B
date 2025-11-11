// src/utils/pax.js
/**
 * Extracts passenger counts (adult, child, infant) from various source objects.
 * Works with different shapes: search params, API payloads, or pax objects.
 */
export function derivePax(source) {
  if (!source) return { adult: 1, child: 0, infant: 0 };

  const pick = (...cands) =>
    cands.find((v) => v !== undefined && v !== null && !isNaN(Number(v)));

  const a = pick(
    source.adult,
    source.adt,
    source.Adult,
    source.ADT,
    source.pax?.adult,
    source.search?.adult,
    source.search?.adt
  );

  const c = pick(
    source.child,
    source.chd,
    source.Child,
    source.CHD,
    source.pax?.child,
    source.search?.child,
    source.search?.chd
  );

  const i = pick(
    source.infant,
    source.inf,
    source.Infant,
    source.INF,
    source.pax?.infant,
    source.search?.infant,
    source.search?.inf
  );

  const adult = Number.isFinite(+a) ? +a : 1;
  const child = Number.isFinite(+c) ? +c : 0;
  let infant = Number.isFinite(+i) ? +i : 0;

  // Safety: infants must not exceed adults
  if (infant > adult) infant = adult;

  return { adult, child, infant };
}
