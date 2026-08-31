import { useEffect, useRef } from "react";

interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

interface ToolDescriptor<TInput> {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: ToolAnnotations;
  execute: (input: TInput, ctx: { signal: AbortSignal }) => unknown | Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        descriptor: {
          name: string;
          description: string;
          inputSchema: object;
          annotations?: ToolAnnotations;
          execute: (input: unknown, ctx: { signal: AbortSignal }) => Promise<{ content: { type: "text"; text: string }[] }>;
        },
        options?: { signal?: AbortSignal },
      ) => Promise<void> | void;
    };
  }
}

function toContent(result: unknown): { content: { type: "text"; text: string }[] } {
  const text = typeof result === "string" ? result : JSON.stringify(result ?? null);
  return { content: [{ type: "text", text }] };
}

// Registers a WebMCP tool for as long as the calling component is mounted, and
// re-registers whenever `enabled` or the descriptor identity changes. Business
// logic returns plain JS values; this hook applies the MCP content-array
// wrapping so callers never touch that convention directly.
export function useTool<TInput = Record<string, unknown>>(descriptor: ToolDescriptor<TInput>, enabled = true): void {
  const descriptorRef = useRef(descriptor);
  descriptorRef.current = descriptor;

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || !document.modelContext) return;

    const controller = new AbortController();
    document.modelContext.registerTool(
      {
        name: descriptorRef.current.name,
        description: descriptorRef.current.description,
        inputSchema: descriptorRef.current.inputSchema,
        annotations: descriptorRef.current.annotations,
        execute: async (input, ctx) => toContent(await descriptorRef.current.execute(input as TInput, ctx)),
      },
      { signal: controller.signal },
    );

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, descriptor.name]);
}
