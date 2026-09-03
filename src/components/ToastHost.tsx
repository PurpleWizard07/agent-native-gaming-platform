import { useToast } from "../state/ToastContext";

// Rendered unconditionally so the live region exists before the first message
// lands — a container that appears at the same moment as its content is not
// reliably announced.
export function ToastHost() {
  const { toasts } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-full border border-neutral-700 bg-neutral-900/95 px-4 py-2 text-xs font-medium text-neutral-100 shadow-lg backdrop-blur"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
