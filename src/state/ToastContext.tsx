import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const VISIBLE_MS = 3200;

export interface Toast {
  id: number;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  notify: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

/**
 * Diegetic feedback for things the player did not click themselves. When an
 * agent applies filters or assembles a party, the page reacts the way a page
 * reacts — but in a narrow viewport (ChatGPT's in-app browser) a quiet state
 * change three sections down gets missed, so it also says so out loud.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), VISIBLE_MS);
  }, []);

  const value = useMemo(() => ({ toasts, notify }), [toasts, notify]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
