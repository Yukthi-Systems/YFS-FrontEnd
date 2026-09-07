import type { ReactNode } from "react";

export function ModalShell({
  children,
  onClose,
  size = "default",
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "lg";
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content${size === "lg" ? " modal-lg" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
