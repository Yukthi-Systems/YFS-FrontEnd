import { atom, useAtomValue, useSetAtom, getDefaultStore } from "jotai";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

const AUTO_DISMISS_MS = 4000;

let counter = 0;

const toastsAtom = atom<Toast[]>([]);

const dismissToastAtom = atom(null, (_get, set, id: string) => {
  set(toastsAtom, (prev) => prev.filter((t) => t.id !== id));
});

const showToastAtom = atom(
  null,
  (_get, set, message: string, variant: ToastVariant = "info") => {
    counter += 1;
    const id = `toast-${counter}`;
    set(toastsAtom, (prev) => [...prev, { id, message, variant }]);
    setTimeout(() => set(dismissToastAtom, id), AUTO_DISMISS_MS);
  }
);

export const useToast = () => {
  const toasts = useAtomValue(toastsAtom);
  const showToast = useSetAtom(showToastAtom);
  const dismissToast = useSetAtom(dismissToastAtom);
  return { toasts, showToast, dismissToast };
};

// For non-component callers (services/fileSystemStore.ts, services/authStore.ts).
const store = getDefaultStore();
export const showToast = (message: string, variant: ToastVariant = "info") =>
  store.set(showToastAtom, message, variant);
