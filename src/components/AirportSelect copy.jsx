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
  const airports = useSelector(selectAirports);
  const selected = useMemo(
    () => airports.find((a) => a.value === value) || null,
    [airports, value]
  );

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Filter options by query (search on label or value)
  const filtered = useMemo(() => {
    if (!query.trim()) return airports;
    const q = query.trim().toLowerCase();
    return airports.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.value.toLowerCase().includes(q)
    );
  }, [airports, query]);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Reset active index when the list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [open, query]);

  const selectByIndex = (idx) => {
    const item = filtered[idx];
    if (!item) return;
    onChange?.(item.value);
    setOpen(false);
    setQuery(""); // clear search after select
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      // focus the search box next tick
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
      {/* Trigger (styled like an input) */}
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

      {/* Dropdown panel — always below the trigger */}
      {open && !disabled && (
        <div
          className="absolute left-0 top-full mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-2xl z-50"
          role="dialog"
        >
          {/* Search box */}
          <div className="p-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full h-10 rounded-lg border border-slate-300 px-3 text-[14px] focus:outline-none focus:border-sky-500 focus:ring focus:ring-sky-200/60"
              onKeyDown={handleListKeyDown}
            />
          </div>

          {/* Options */}
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-60 overflow-auto py-1"
            onKeyDown={handleListKeyDown}
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-slate-500">No matches</li>
            )}
            {filtered.map((ap, idx) => {
              const isActive = idx === activeIndex;
              const isSelected = ap.value === value;
              return (
                <li
                  key={ap.value}
                  data-index={idx}
                  role="option"
                  aria-selected={isSelected}
                  className={
                    "px-3 py-2 cursor-pointer flex items-center justify-between " +
                    (isActive ? "bg-slate-100" : "hover:bg-slate-50")
                  }
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectByIndex(idx)}
                >
                  <span>{ap.label}</span>
                  {isSelected && <span className="text-sky-600 font-medium">✓</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
