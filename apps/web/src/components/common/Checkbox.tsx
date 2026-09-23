import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Check, Minus } from "lucide-react";

// The app's only checkbox. The native control is kept (appearance-none) so keyboard,
// focus and form semantics stay intact, with the tick drawn on top. The check colour
// is bg-main so it inverts with the theme — the accent is dark in light mode and
// light in dark mode, and a fixed white tick would wash out against the latter.
export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
  label,
  title,
  ariaLabel,
  className = "",
  onClick,
}: {
  checked: boolean;
  onChange: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  title?: string;
  ariaLabel?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const showDash = indeterminate && !checked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = showDash;
  }, [showDash]);

  const control = (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        onClick={onClick}
        onChange={(e) => onChange(e.target.checked, e)}
        className="peer appearance-none w-[17px] h-[17px] m-0 rounded-[6px] border border-border-main bg-bg-main cursor-pointer transition duration-150 hover:border-accent checked:bg-accent checked:border-accent indeterminate:bg-accent indeterminate:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-bg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border-main"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-bg-main opacity-0 transition-opacity duration-150 peer-checked:opacity-100 peer-indeterminate:opacity-100">
        {showDash ? <Minus className="w-3 h-3" strokeWidth={3.5} /> : <Check className="w-3 h-3" strokeWidth={3.5} />}
      </span>
    </span>
  );

  if (label === undefined) return <span className={`inline-flex ${className}`}>{control}</span>;

  return (
    <label
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${className}`}
    >
      {control}
      <span className="text-xs text-text-heading leading-tight">{label}</span>
    </label>
  );
}
