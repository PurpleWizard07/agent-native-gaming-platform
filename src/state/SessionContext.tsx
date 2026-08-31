import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { FRIENDSHIPS, SIGNED_IN_USER_ID, USER_BY_ID, type User } from "../data/users";
import { libraryFor, type LibraryEntry } from "../data/libraries";

const VIEWER_STORAGE_KEY = "agp:viewerId";

interface SessionContextValue {
  viewer: User;
  setViewerId: (id: string) => void;
  library: LibraryEntry[];
  friends: User[];
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredViewerId(): string {
  try {
    return sessionStorage.getItem(VIEWER_STORAGE_KEY) ?? SIGNED_IN_USER_ID;
  } catch {
    return SIGNED_IN_USER_ID;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [viewerId, setViewerIdState] = useState<string>(readStoredViewerId);

  const setViewerId = (id: string) => {
    setViewerIdState(id);
    try {
      sessionStorage.setItem(VIEWER_STORAGE_KEY, id);
    } catch {
      // sessionStorage unavailable — viewer choice just won't persist across reloads
    }
  };

  const value = useMemo<SessionContextValue>(() => {
    const viewer = USER_BY_ID[viewerId] ?? USER_BY_ID[SIGNED_IN_USER_ID];
    const friends = (FRIENDSHIPS[viewer.id] ?? []).map((id) => USER_BY_ID[id]).filter(Boolean);
    return {
      viewer,
      setViewerId,
      library: libraryFor(viewer.id),
      friends,
    };
  }, [viewerId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
