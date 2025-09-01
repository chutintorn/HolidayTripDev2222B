import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectResults } from "../redux/searchSlice";
import { fetchPriceDetail, selectPriceFor, selectPricingStatus } from "../redux/pricingSlice";
import { flattenFlights } from "../utils/flattenFlights";

function Box({ title, rows, currency, token, onNextGlobal }) {
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
      securityToken: token || row.securityToken,
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
    // Allow parent to read the chosen fare if needed
    onNextGlobal?.(selectedFare);
  };

  const selectedStatus = useSelector(selectPricingStatus(selectedFare?.fareKey || ""));
  const selectedDetail = useSelector(selectPriceFor(selectedFare?.fareKey || ""));

  if (!rows?.length) {
    return (
      <div className="rounded-xl border p-4 bg-amber-50 text-amber-800">
        No flights found for this leg.
      </div>
    );
  }

  const depDateStr = (rows[0]?.departureDate || "").slice(0, 10);
  const depDate = depDateStr ? new Date(depDateStr + "T00:00:00") : new Date(NaN);
  const ddMMM = isNaN(depDate) ? "" : depDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
  const dow   = isNaN(depDate) ? "" : depDate.toLocaleDateString("en-GB", { weekday: "short" });
  const dowColors = { Mon:"#FFD700", Tue:"#FF69B4", Wed:"#32CD32", Thu:"#FFA500", Fri:"#00BFFF", Sat:"#CF9FFF", Sun:"#FF4500" };

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="px-4 pt-3">
        <h2 className="mb-1 text-blue-600 flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <span className="text-slate-700 text-sm">{rows[0]?.origin} → {rows[0]?.destination}</span>
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

      <div className="overflow-x-auto rounded-b-2xl">
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
                    `THB ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

export default function RoundTripResults() {
  const raw = useSelector(selectResults);
  const token = raw?.securityToken || "";
  const currency = raw?.currency || "THB";

  // data[]: each element is one leg (e.g., DMK→CNX, CNX→DMK)
  const legs = Array.isArray(raw?.data) ? raw.data : (raw ? [raw] : []);

  // Prepare rows per leg using your existing flattener (branch A).
  const boxes = useMemo(() => {
    return legs.map((leg) => {
      const rows = flattenFlights([leg], token); // pass single day wrapped in array
      return {
        key: `${leg.origin}-${leg.destination}-${leg.departureDate}`,
        title: "", // filled below
        origin: leg.origin,
        destination: leg.destination,
        depDate: leg.departureDate,
        rows,
      };
    });
  }, [legs, token]);

  // Try to label Depart/Return if there are exactly 2 opposite legs
  if (boxes.length === 2) {
    const a = boxes[0], b = boxes[1];
    const isOpposite =
      a.origin === b.destination && a.destination === b.origin;
    if (isOpposite) {
      boxes[0].title = "Depart";
      boxes[1].title = "Return";
    } else {
      boxes[0].title = "Route 1";
      boxes[1].title = "Route 2";
    }
  } else {
    boxes.forEach((b, i) => { b.title = `Route ${i + 1}`; });
  }

  // Optional: lift chosen fares up if you want to combine later
  const [chosenDepart, setChosenDepart] = useState(null);
  const [chosenReturn, setChosenReturn] = useState(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {boxes.map((box, idx) => (
        <Box
          key={box.key}
          title={box.title}
          rows={box.rows}
          currency={currency}
          token={token}
          onNextGlobal={(fare) => {
            if (box.title === "Depart" || idx === 0) setChosenDepart(fare);
            if (box.title === "Return" || idx === 1) setChosenReturn(fare);
          }}
        />
      ))}
    </div>
  );
}
