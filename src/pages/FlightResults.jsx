// src/pages/FlightResults.jsx
import React from "react";
import { useSelector } from "react-redux";

import { selectResults } from "../redux/searchSlice";
import { selectFilters } from "../redux/filtersSlice"; // ensures slice is loaded
import FiltersPanel from "../components/FiltersPanel";
import JourneyTable from "../components/JourneyTable";               // one-way Lite cards
import RoundTripResultsLite from "../components/RoundTripResultsLite"; // round-trip Lite

export default function FlightResults() {
  // Pull whatever you store alongside results to decide trip type
  const searchState = useSelector((s) => s.search);
  const results = useSelector(selectResults);
  const tripType =
    searchState?.params?.tripType || searchState?.tripType || "oneway";
  const isRoundTrip = tripType.toLowerCase() === "roundtrip";

  // Accessing filters here ensures FiltersPanel + selectors stay live
  // (you don't need the values in this page, components read from Redux themselves)
  useSelector(selectFilters);

  const hasResults = !!(results && (results.data || Array.isArray(results)));

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      {/* Top bar (optional, keep minimal) */}
      <div className="bg-[#E9F5FF] border-b border-[#e6eef7] px-4 py-2">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="font-black text-[#0b4f8a]">Nok Holiday</div>
          <div className="text-xs text-slate-600">
            Simple • Fast • Reliable
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Sidebar filters (sticky on tall screens) */}
        <aside className="h-max sticky top-3">
          <FiltersPanel />
        </aside>

        {/* Results area */}
        <main className="flex flex-col gap-4">
          {!hasResults ? (
            <div className="rounded-xl border bg-amber-50 text-amber-900 p-4">
              No flights to display. Start a search to see results.
            </div>
          ) : isRoundTrip ? (
            <RoundTripResultsLite />
          ) : (
            <JourneyTable showNextButton />
          )}
        </main>
      </div>
    </div>
  );
}
