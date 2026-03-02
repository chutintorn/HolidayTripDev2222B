// src/components/MainNav.jsx
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const NavLink = ({ to, children, onClick }) => {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
};

export default function MainNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between">

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-2">
          <NavLink to="/landing">Home</NavLink>
          <NavLink to="/search">Flights</NavLink>
        </div>

        {/* Mobile 3-dot Toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="More"
          className="
            sm:hidden
            inline-flex items-center justify-center
            w-9 h-9
            rounded-xl
            border border-slate-200
            bg-white
            shadow-sm
            hover:bg-slate-50
            transition
          "
        >
          <svg
            width="18"
            height="4"
            viewBox="0 0 18 4"
            fill="currentColor"
            className="text-sky-600"
          >
            <circle cx="2" cy="2" r="2" />
            <circle cx="9" cy="2" r="2" />
            <circle cx="16" cy="2" r="2" />
          </svg>
        </button>
      </div>

      {/* Mobile Dropdown */}
      {open && (
        <div className="sm:hidden border-t bg-white">
          <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col gap-2">
            <NavLink to="/landing" onClick={() => setOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/search" onClick={() => setOpen(false)}>
              Flights
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}