import { useState } from "react";
import { useTool } from "./webmcp/useTool";

function App() {
  const [pings, setPings] = useState(0);

  useTool({
    name: "ping",
    description: "Throwaway diagnostic tool. Increments a counter on the page and returns the new count. Used only to confirm WebMCP tool registration is working during setup.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () => {
      let next = 0;
      setPings((p) => {
        next = p + 1;
        return next;
      });
      return { pings: next };
    },
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Agent-Native Gaming Platform</h1>
      <p className="text-neutral-400">Scaffold is live. WebMCP ping count: {pings}</p>
    </div>
  );
}

export default App;
