import { useEffect, useRef } from "react";
import { whenModelContextReady, type ToolAnnotations, type ToolResult } from "./modelContext";

interface ToolDescriptor<TInput> {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: ToolAnnotations;
  execute: (input: TInput, ctx: { signal: AbortSignal }) => unknown | Promise<unknown>;
}

function toContent(result: unknown): ToolResult {
  const text = typeof result === "string" ? result : JSON.stringify(result ?? null);
  return { content: [{ type: "text", text }] };
}

// A tool that throws — a party action hitting a 404 "no active party", a
// network blip — should hand the agent something it can act on instead of an
// opaque host-level failure. An agent that reads "no active party" recovers by
// calling create_party; one that reads nothing just stops.
function toError(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
}

// Registers a WebMCP tool for as long as the calling component is mounted, and
// re-registers whenever `enabled` or the descriptor identity changes. Business
// logic returns plain JS values; this hook applies the MCP content-array
// wrapping and error shaping so callers never touch those conventions
// directly.
export function useTool<TInput = Record<string, unknown>>(descriptor: ToolDescriptor<TInput>, enabled = true): void {
  const descriptorRef = useRef(descriptor);
  descriptorRef.current = descriptor;

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();

    void whenModelContextReady().then((modelContext) => {
      if (!modelContext || controller.signal.aborted) return;
      modelContext.registerTool(
        {
          name: descriptorRef.current.name,
          description: descriptorRef.current.description,
          inputSchema: descriptorRef.current.inputSchema,
          annotations: descriptorRef.current.annotations,
          execute: async (input, ctx) => {
            try {
              return toContent(await descriptorRef.current.execute(input as TInput, ctx));
            } catch (error) {
              return toError(error);
            }
          },
        },
        { signal: controller.signal },
      );
    });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, descriptor.name]);
}
