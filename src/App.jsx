// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

// pages (screens)
import BookingLanding from "./pages/BookingLanding";
import ScrollDemo from "./pages/ScrollDemo";
import PriceDetailSkyBlue from "./pages/PriceDetailSkyBlue";
import ConfirmationPage from "./pages/ConfirmationPage"; // ✅ NEW

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BookingLanding />} />
      <Route path="/scroll" element={<ScrollDemo />} />

      {/* new price detail page (TH/EN toggle, shows API pricing) */}
      <Route path="/skyblue-price-detail" element={<PriceDetailSkyBlue />} />

      {/* ✅ confirmation page (one-page confirmation + payment) */}
      <Route path="/confirmation" element={<ConfirmationPage />} />

      {/* catch-all → redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
