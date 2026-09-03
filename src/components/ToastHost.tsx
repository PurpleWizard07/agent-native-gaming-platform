import { useToast } from "../state/ToastContext";

// Rendered unconditionally so the live region exists before the first message
// lands — a container that appears at the same moment as its content is not
// reliably announced.
export function ToastHost() {
  const { toasts } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-rise flex items-center gap-2.5 rounded-full border border-white/12 bg-ink-900/90 px-4 py-2.5 text-xs font-medium text-neutral-100 shadow-[0_10px_36px_-8px_rgb(0_0_0/0.9)] backdrop-blur-xl"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400 shadow-[0_0_8px_rgb(99_197_245/0.9)]"
            aria-hidden="true"
          />
          {toast.message}
        </div>
      ))}
    </div>
  );
}
