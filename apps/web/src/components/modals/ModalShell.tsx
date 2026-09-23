import type { ReactNode } from "react";

export function ModalShell({
  children,
  onClose,
  size = "default",
  padded = true,
}: {
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "lg" | "xl";
  // false hands padding to the caller, for modals with their own sticky header/footer.
  padded?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content${size === "default" ? "" : ` modal-${size}`}${padded ? "" : " modal-flush"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
