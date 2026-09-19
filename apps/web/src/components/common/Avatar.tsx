// "Rupraj Singh" -> "R", falling back to the email if no name.
const initialsOf = (name?: string | null, email?: string | null): string => {
  const trimmedName = (name || "").trim();
  if (trimmedName) return trimmedName[0].toUpperCase();
  return (email || "").trim().substring(0, 1).toUpperCase() || "?";
};

export function Avatar({
  name,
  email,
  color,
  className = "",
}: {
  name?: string | null;
  email?: string | null;
  // Explicit override (e.g. the user's own chosen avatar_color). Without one, the
  // avatar uses a low-opacity tint of the theme accent color instead of white text
  // on a solid fill, so it always matches the current theme.
  color?: string;
  // Caller controls size/shape/text-size via utility classes (e.g. "w-8 h-8 text-[11px]").
  className?: string;
}) {
  const initials = initialsOf(name, email);

  if (color) {
    return (
      <span
        className={`rounded-full text-white flex items-center justify-center font-bold shrink-0 ${className}`}
        style={{ background: color }}
      >
        {initials}
      </span>
    );
  }

  return (
    <span className={`rounded-full bg-accent-bg text-accent flex items-center justify-center font-bold shrink-0 ${className}`}>
      {initials}
    </span>
  );
}
