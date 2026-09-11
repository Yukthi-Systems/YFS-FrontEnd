import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast } from "../../atoms/toast";
import type { ToastVariant } from "../../atoms/toast";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-green-500/40 text-green-600 dark:text-green-400",
  error: "border-red-500/40 text-red-500",
  info: "border-accent-border text-text-heading",
};

const VariantIcon = ({ variant }: { variant: ToastVariant }) => {
  if (variant === "success") return <CheckCircle2 className="w-4 h-4 shrink-0" />;
  if (variant === "error") return <XCircle className="w-4 h-4 shrink-0" />;
  return <Info className="w-4 h-4 shrink-0" />;
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[2000] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-2.5 bg-bg-main border rounded-2xl shadow-md px-4 py-3 text-sm font-medium animate-scale-in ${VARIANT_STYLES[toast.variant]}`}
        >
          <VariantIcon variant={toast.variant} />
          <span className="flex-1 text-text-heading">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="border-none bg-transparent p-1 rounded-full text-text-main hover:bg-code-bg cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
