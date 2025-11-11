// src/components/Modal.jsx
import React, { memo, useEffect } from "react";

/**
 * Modal
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - children: ReactNode
 *  - className?: string (extra classes for inner content)
 */
function ModalBase({ open, onClose, children, className = "" }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-[92vw] max-w-3xl max-h-[90vh] overflow-auto bg-white rounded-xl border border-slate-200 shadow-2xl ${className}`}
        onClick={(e) => e.stopPropagation()} // prevent close when clicking inside
      >
        {children}
      </div>
    </div>
  );
}

const Modal = memo(ModalBase);
export default Modal;
export { Modal };
