// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

// pages (screens)
import BookingLanding from "./pages/BookingLanding";
import ScrollDemo from "./pages/ScrollDemo";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BookingLanding />} />
      <Route path="/scroll" element={<ScrollDemo />} />

      {/* catch-all → redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
