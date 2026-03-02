// src/components/AirportSelect.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { selectAirports } from "../redux/airportsSlice";

export default function AirportSelect({
  value,
  onChange,
  placeholder = "Select airport",
  disabled = false,
  className = "w-full h-14 rounded-2xl border border-slate-200 bg-white px-4 text-[16px] shadow-sm focus:outline-none focus:ring focus:ring-sky-200/70",
  name,
  id,
}) {
  const airportsAll = useSelector(selectAirports);

  // ✅ Use ALL airports from redux (no restriction)
  const airports = useMemo(() => {
    const list = Array.isArray(airportsAll) ? airportsAll : [];
    return list
      .map((a) => ({
        ...a,
        value: String(a?.value || "").toUpperCase(),
        label: a?.label || String(a?.value || "").toUpperCase(),
      }))
      .filter((a) => a.value);
  }, [airportsAll]);

  const selected = useMemo(
    () => airports.find((a) => a.value === String(value || "").toUpperCase()) || null,
    [airports, value]
  );

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return airports;
    const q = query.trim().toLowerCase();
    return airports.filter(
      (a) =>
        String(a.label || "").toLowerCase().includes(q) ||
        String(a.value || "").toLowerCase().includes(q)
    );
  }, [airports, query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [open, query]);

  const selectByIndex = (idx) => {
    const item = filtered[idx];
    if (!item) return;
    onChange?.(item.value);
    setOpen(false);
    setQuery("");
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleListKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      scrollActiveIntoView();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      scrollActiveIntoView();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      selectByIndex(activeIndex);
      return;
    }
  };

  const scrollActiveIntoView = () => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector(`[data-index="${activeIndex}"]`);
    if (item) {
      const itemTop = item.offsetTop;
      const itemBottom = itemTop + item.offsetHeight;
      const viewTop = list.scrollTop;
      const viewBottom = viewTop + list.clientHeight;
      if (itemTop < viewTop) list.scrollTop = itemTop;
      else if (itemBottom > viewBottom) list.scrollTop = itemBottom - list.clientHeight;
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        className={
          className +
          " text-left flex items-center justify-between " +
          (disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <span aria-hidden className="ml-2 text-slate-500">▾</span>
      </button>

      {open && !disabled && (
        <div
          className="absolute left-0 top-full mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-2xl z-50"
          role="dialog"
        >
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleListKeyDown}
              placeholder="Search airport…"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring focus:ring-sky-200/60"
            />
          </div>

          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            className="max-h-72 overflow-auto p-1"
          >
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">No results</div>
            ) : (
              filtered.map((a, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = String(a.value) === String(value || "").toUpperCase();
                return (
                  <button
                    key={`${a.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectByIndex(idx)}
                    className={[
                      "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between",
                      isActive ? "bg-sky-50" : "bg-white",
                      isSelected ? "font-bold text-sky-700" : "text-slate-700",
                    ].join(" ")}
                  >
                    <span>{a.label}</span>
                    <span className="text-xs text-slate-400">{a.value}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}