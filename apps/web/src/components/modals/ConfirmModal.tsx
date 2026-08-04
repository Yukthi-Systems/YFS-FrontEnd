import { ModalShell } from "./ModalShell";

export function ConfirmModal({
  title,
  description,
  confirmLabel,
  destructive = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <h3 className="modal-title">{title}</h3>
      <p className="modal-description">{description}</p>
      <div className="modal-actions">
        <button onClick={onCancel} className="btn-outline">
          Cancel
        </button>
        <button onClick={onConfirm} className={destructive ? "btn-destructive" : "btn-primary"} style={{ width: "auto" }}>
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
