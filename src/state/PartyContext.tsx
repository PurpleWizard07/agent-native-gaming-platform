import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PartyAction, PartyState } from "../types/party";

const POLL_MS = 1500;

interface PartyContextValue {
  party: PartyState | null;
  loading: boolean;
  createParty: (gameId: string, hostId: string) => Promise<PartyState>;
  inviteFriends: (friendIds: string[]) => Promise<PartyState>;
  respond: (userId: string, accept: boolean) => Promise<PartyState>;
  launch: () => Promise<PartyState>;
  reset: () => Promise<void>;
}

const PartyContext = createContext<PartyContextValue | null>(null);

async function callApi(body: PartyAction): Promise<PartyState | null> {
  const res = await fetch("/api/party", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "party action failed");
  }
  return res.json();
}

export function PartyProvider({ children }: { children: ReactNode }) {
  const [party, setParty] = useState<PartyState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/party");
        const data = await res.json();
        if (!cancelled) setParty(data);
      } catch {
        // transient network hiccup — the next poll will retry
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const value: PartyContextValue = {
    party,
    loading,
    createParty: async (gameId, hostId) => {
      const updated = await callApi({ action: "create", gameId, hostId });
      setParty(updated);
      return updated as PartyState;
    },
    inviteFriends: async (friendIds) => {
      const updated = await callApi({ action: "invite", friendIds });
      setParty(updated);
      return updated as PartyState;
    },
    respond: async (userId, accept) => {
      const updated = await callApi({ action: "respond", userId, accept });
      setParty(updated);
      return updated as PartyState;
    },
    launch: async () => {
      const updated = await callApi({ action: "launch" });
      setParty(updated);
      return updated as PartyState;
    },
    reset: async () => {
      await callApi({ action: "reset" });
      setParty(null);
    },
  };

  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
}

export function useParty(): PartyContextValue {
  const ctx = useContext(PartyContext);
  if (!ctx) throw new Error("useParty must be used within a PartyProvider");
  return ctx;
}
