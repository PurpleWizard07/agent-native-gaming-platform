import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export interface Filters {
  genres: string[];
  minPlayers?: number;
  coop?: boolean;
  maxSessionMinutes?: number;
  onlyUnfinished?: boolean;
  onlyInstalled?: boolean;
}

export const EMPTY_FILTERS: Filters = { genres: [] };

interface ViewContextValue {
  /** Route path of the page currently mounted, e.g. "/store". */
  page: string;
  filters: Filters;
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
  visibleGameIds: string[];
  setVisibleGameIds: (ids: string[]) => void;
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

// Only Store and Library publish filters/visibleGameIds; this is also the
// gate the page-context WebMCP tools use to register only on those pages.
export const FILTERABLE_PAGES = ["/store", "/library"];

export function ViewProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [visibleGameIds, setVisibleGameIds] = useState<string[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Reset per-view state on navigation so filters don't leak from Store into
  // Library or vice versa.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setVisibleGameIds([]);
    setSelectedGameId(null);
  }, [location.pathname]);

  const value = useMemo<ViewContextValue>(
    () => ({
      page: location.pathname,
      filters,
      setFilters,
      visibleGameIds,
      setVisibleGameIds,
      selectedGameId,
      setSelectedGameId,
    }),
    [location.pathname, filters, visibleGameIds, selectedGameId],
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used within a ViewProvider");
  return ctx;
}
