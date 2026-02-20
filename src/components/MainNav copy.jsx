import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

const NavLink = ({ to, children }) => {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm ${
        active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
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
        {/* desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <NavLink to="/landing">Home</NavLink>
          <NavLink to="/search">Flights</NavLink>
          <NavLink to="/hotels">Hotels</NavLink>
          <NavLink to="/transfers">Transfers</NavLink>
          <NavLink to="/events">Events</NavLink>
        </div>
        {/* mobile */}
        <button
          className="sm:hidden px-3 py-2 rounded-lg border text-sm"
          onClick={() => setOpen(v => !v)}
          aria-label="Toggle menu"
        >
          ☰ Menu
        </button>
      </div>

      {open && (
        <div className="sm:hidden border-t bg-white">
          <div className="mx-auto max-w-6xl px-4 py-2 flex flex-col gap-2">
            <NavLink to="/landing">Home</NavLink>
            <NavLink to="/search">Flights</NavLink>
            <NavLink to="/hotels">Hotels</NavLink>
            <NavLink to="/transfers">Transfers</NavLink>
            <NavLink to="/events">Events</NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}
