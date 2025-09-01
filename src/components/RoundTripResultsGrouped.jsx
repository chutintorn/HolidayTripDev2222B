import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectResults } from "../redux/searchSlice";
import { flattenFlights } from "../utils/flattenFlights";
import { fetchPriceDetail, selectPriceFor, selectPricingStatus } from "../redux/pricingSlice";

function LegBox({ title, rows, currency = "THB", token = "" }) {
  const dispatch = useDispatch();
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedFare, setSelectedFare] = useState(null);

  const cols = [
    "departureTime", "arrivalTime", "duration",
    "flightNumber", "aircraftDescription",
    "fareAmountIncludingTax", "nokXtraAmount", "nokMaxAmount",
  ];

  const label = (col) => {
    if (col === "fareAmountIncludingTax") return "Nok Lite";
    if (col === "nokXtraAmount")         return "Nok X-TRA";
    if (col === "nokMaxAmount")          return "Nok MAX";
    if (col === "departureTime")         return "Departure";
    if (col === "arrivalTime")           return "Arrival";
    if (col === "flightNumber")          return "Flight";
    if (col === "aircraftDescription")   return "Aircraft";
    return col;
  };

  const pickFare = (row, col) => {
    let fareKey = "";
    if (col === "fareAmountIncludingTax") fareKey = row.fareKey;   // LITE
    else if (col === "nokXtraAmount")     fareKey = row.farekey1;  // X-TRA
    else if (col === "nokMaxAmount")      fareKey = row.farekey2;  // MAX
    if (!fareKey) return;

    setSelectedRow(row);
    setSelectedFare({
      fareKey,
      journeyKey: row.journeyKey,
      securityToken: row.securityToken || token,
      currency,
    });
  };

  const onNext = () => {
    if (!selectedFare) return;
    dispatch(fetchPriceDetail({
      offer: {
        id: selectedFare.fareKey,
        fareKey: selectedFare.fareKey,
        journeyKey: selectedFare.journeyKey,
        securityToken: selectedFare.securityToken,
      },
    }));
  };

  const selectedStatus = useSelector(selectPricingStatus(selectedFare?.fareKey || ""));
  const selectedDetail = useSelector(selectPriceFor(selectedFare?.fareKey || ""));

  const depDateStr = (rows[0]?.departureDate || "").slice(0, 10);
  const depDate = depDateStr ? new Date(depDateStr + "T00:00:00") : new Date(NaN);
  const ddMMM = isNaN(depDate) ? "" : depDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
  const dow   = isNaN(depDate) ? "" : depDate.toLocaleDateString("en-GB", { weekday: "short" });
  const dowColors = { Mon:"#FFD700", Tue:"#FF69B4", Wed:"#32CD32", Thu:"#FFA500", Fri:"#00BFFF", Sat:"#CF9FFF", Sun:"#FF4500" };

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-blue-600 flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <span className="text-slate-700 text-sm">
            {rows[0]?.origin} → {rows[0]?.destination}
          </span>
          {ddMMM && (
            <>
              <span className="text-slate-700 text-sm">{ddMMM}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#000", color: dowColors[dow] || "#FFF" }}>
                {dow}
              </span>
            </>
          )}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold">{label(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t last:border-b-0">
                {cols.map((col) => {
                  const selectable = ["fareAmountIncludingTax", "nokXtraAmount", "nokMaxAmount"].includes(col);
                  const isSelected =
                    selectedRow?.id === row.id &&
                    selectedFare?.fareKey === (
                      col === "fareAmountIncludingTax" ? row.fareKey :
                      col === "nokXtraAmount"        ? row.farekey1  :
                                                       row.farekey2
                    );
                  const val = row[col];
                  const priceText = selectable && val !== "" &&
                    `${currency} ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return (
                    <td
                      key={col}
                      onClick={() => selectable && pickFare(row, col)}
                      className={[
                        "px-3 py-2",
                        selectable ? "font-semibold cursor-pointer" : "",
                        isSelected ? "bg-yellow-200" : "",
                      ].join(" ")}
                    >
                      {priceText || val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 flex items-center justify-end gap-3">
        {selectedStatus === "loading"   && <div className="text-sm text-slate-600">Loading price…</div>}
        {selectedStatus === "failed"    && <div className="text-sm text-red-600">Failed to load price.</div>}
        {selectedStatus === "succeeded" && selectedDetail && (
          <div className="text-sm font-medium">
            Total: {selectedDetail.currency || selectedFare.currency} {selectedDetail.total?.toLocaleString?.()}
          </div>
        )}
        <button
          onClick={onNext}
          disabled={!selectedFare || selectedStatus === "loading"}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          NEXT
        </button>
      </div>
    </div>
  );
}

export default function RoundTripResultsGrouped() {
  const raw = useSelector(selectResults);
  const token = raw?.securityToken || "";
  const currency = raw?.currency || "THB";

  // Build rows from the WHOLE payload (handles {data:[...]} or a single object)
  const rows = useMemo(() => {
    const payload = raw?.data ?? raw;
    if (!payload) return [];
    const input = Array.isArray(payload) ? payload : [payload];
    return flattenFlights(input, token);
  }, [raw, token]);

  if (!rows.length) return null;

  // Group rows by route (origin→destination) so we always get separate boxes
  const groupsMap = rows.reduce((acc, r) => {
    const key = `${r.origin || ""}-${r.destination || ""}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  let groups = Object.entries(groupsMap).map(([key, gRows]) => ({
    key,
    rows: gRows,
    // find the earliest date in this group to help sort Depart/Return
    minDate: (() => {
      const d = gRows
        .map(x => new Date((x.departureDate || "").replace(" ", "T")))
        .filter(x => !isNaN(x))
        .sort((a,b)=>a-b)[0];
      return d || new Date(8640000000000000); // max date
    })(),
  }));

  // If exactly two groups, sort by earliest departure (Depart first, Return second)
  if (groups.length === 2) {
    groups = groups.sort((a,b) => a.minDate - b.minDate);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map((g, i) => {
        // Nice titles: if exactly 2 groups, call them Depart/Return
        let title = `Route ${i + 1}`;
        if (groups.length === 2) title = i === 0 ? "Depart" : "Return";
        return (
          <LegBox
            key={g.key}
            title={title}
            rows={g.rows}
            currency={currency}
            token={token}
          />
        );
      })}
    </div>
  );
}
