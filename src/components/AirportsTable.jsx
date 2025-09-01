// src/components/AirportsTable.jsx
import React from "react";
import { useSelector } from "react-redux";
import { selectAirports } from "../redux/airportsSlice";

export default function AirportsTable() {
  const airports = useSelector(selectAirports);
  if (!airports.length) return null;

  return (
    <div className="mt-4 rounded-xl border bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Code</th>
            <th className="px-3 py-2 text-left font-semibold">Label</th>
          </tr>
        </thead>
        <tbody>
          {airports.map((ap) => (
            <tr key={ap.value} className="border-t">
              <td className="px-3 py-2 font-mono">{ap.value}</td>
              <td className="px-3 py-2">{ap.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
