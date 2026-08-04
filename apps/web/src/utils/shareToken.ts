// Demo-only token, not cryptographically strong — matches the rest of this app's approach
// to IDs, and is fine here since this whole sharing feature is UI/UX scaffolding with no
// backend to actually enforce access control server-side.
export const generateShareToken = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
