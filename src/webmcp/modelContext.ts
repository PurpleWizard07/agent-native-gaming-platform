// The single home for the browser-side WebMCP API surface this app depends
// on, plus the guard for when that API isn't there yet.

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface ModelContext {
  registerTool: (
    descriptor: {
      name: string;
      description: string;
      inputSchema: object;
      annotations?: ToolAnnotations;
      execute: (input: unknown, ctx: { signal: AbortSignal }) => Promise<ToolResult>;
    },
    options?: { signal?: AbortSignal },
  ) => Promise<void> | void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

const POLL_MS = 200;
const GIVE_UP_MS = 15_000;

let ready: Promise<ModelContext | null> | null = null;

/**
 * Resolves with document.modelContext once it exists, or with null if it
 * never shows up.
 *
 * Registering on mount and giving up immediately when the API is absent looks
 * fine in a browser that ships WebMCP natively, but an agent host that
 * injects `document.modelContext` after first paint would leave this app with
 * zero registered tools and no error anywhere. Both verification shims
 * install the API before page load, so they can't catch that case either —
 * hence waiting for it rather than sampling once.
 *
 * Giving up resolves null rather than rejecting. Most page loads are a plain
 * human in a plain browser where the API never arrives at all, and a rejection
 * here becomes one unhandled rejection per registered tool in every one of
 * those sessions — every caller would have to remember to catch it.
 */
export function whenModelContextReady(): Promise<ModelContext | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  if (document.modelContext) return Promise.resolve(document.modelContext);
  if (ready) return ready;

  ready = new Promise<ModelContext | null>((resolve) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (document.modelContext) {
        clearInterval(timer);
        resolve(document.modelContext);
      } else if (Date.now() - startedAt > GIVE_UP_MS) {
        clearInterval(timer);
        // Only a successful wait is worth caching: if we gave up, a later
        // mount should be free to look again rather than inherit a permanent
        // "no".
        ready = null;
        resolve(null);
      }
    }, POLL_MS);
  });

  return ready;
}
