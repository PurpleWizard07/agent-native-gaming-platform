import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export interface Filters {
  genres: string[];
  /** Free-text search over title and genre — the Store's search box. */
  query?: string;
  minPlayers?: number;
  coop?: boolean;
  maxSessionMinutes?: number;
  onlyUnfinished?: boolean;
  onlyInstalled?: boolean;
  onlyUnplayed?: boolean;
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

/** Pages with a filterable list — the only ones apply_filters makes sense on. */
export const FILTERABLE_PAGES = ["/store", "/library"];

export function isGamePage(page: string): boolean {
  return page.startsWith("/game/");
}

/**
 * Pages where the player is looking at a game surface, so "what am I looking
 * at?" has an answer worth reporting. Store and Library answer with a list;
 * a game page answers with the one game in focus.
 */
export function hasViewContext(page: string): boolean {
  return FILTERABLE_PAGES.includes(page) || isGamePage(page);
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [visibleGameIds, setVisibleGameIds] = useState<string[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Reset filters on navigation so Store's filters don't leak into Library or
  // vice versa. Deliberately does NOT clear visibleGameIds/selectedGameId:
  // React runs child effects before parent ones, so clearing them here would
  // wipe the values the page being mounted has just published, leaving
  // get_current_view reporting an empty screen until a filter changed. The
  // mounted page is the sole owner of those two — each clears its own on
  // unmount — so resetting filters is enough, since that re-runs the page's
  // own sync effect.
  useEffect(() => {
    setFilters(EMPTY_FILTERS);
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
