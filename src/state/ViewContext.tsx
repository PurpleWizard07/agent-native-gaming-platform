import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  /**
   * An explicit shortlist, pinned by the show_games tool. Not a predicate like
   * the fields above: it names the exact games to display.
   *
   * It exists because an agent's answer usually isn't expressible as a filter.
   * "These three, because all four of you own them and they fit the evening"
   * is the product of reasoning across several tools; there is no genre or
   * player-count combination that selects exactly those three. Without this,
   * an agent could describe a shortlist in chat but never put it on screen.
   */
  gameIds?: string[];
}

export const EMPTY_FILTERS: Filters = { genres: [] };

interface ViewContextValue {
  /** Route path of the page currently mounted, e.g. "/store". */
  page: string;
  filters: Filters;
  setFilters: (updater: Filters | ((prev: Filters) => Filters)) => void;
  /**
   * Set the filters a page should adopt when it mounts, for the case where the
   * caller is about to navigate there. Call this *before* navigate().
   *
   * Needed because the reset below fires on every pathname change: filters set
   * in the same tick as a navigation would be wiped the moment the new page
   * mounted. Staging them survives that reset, so apply_filters and show_games
   * can work from a page that has no filter bar of its own.
   */
  stageFiltersFor: (page: string, filters: Filters) => void;
  visibleGameIds: string[];
  setVisibleGameIds: (ids: string[]) => void;
  selectedGameId: string | null;
  setSelectedGameId: (id: string | null) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

/** Pages with a filter bar — the only ones that can render a filtered list. */
export const FILTERABLE_PAGES = ["/store", "/library"];

/**
 * Where a filter or a shortlist goes when the player is on a page that cannot
 * display one. The Store, because it holds the whole catalog: a shortlist sent
 * to the Library would silently drop any game the player doesn't own.
 */
export const DEFAULT_FILTER_PAGE = "/store";

export function isGamePage(page: string): boolean {
  return page.startsWith("/game/");
}

export function isFilterablePage(page: string): boolean {
  return FILTERABLE_PAGES.includes(page);
}

/**
 * Pages where the player is looking at a game surface, so "what am I looking
 * at?" has a list or a selection to report. Pages outside this set (Friends,
 * Party) still answer get_current_view — they just answer with no games.
 */
export function hasViewContext(page: string): boolean {
  return isFilterablePage(page) || isGamePage(page);
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [visibleGameIds, setVisibleGameIds] = useState<string[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const pendingRef = useRef<{ page: string; filters: Filters } | null>(null);
  const lastPathRef = useRef(location.pathname);

  const stageFiltersFor = useCallback((page: string, next: Filters) => {
    pendingRef.current = { page, filters: next };
  }, []);

  // Reset filters on navigation so Store's filters don't leak into Library or
  // vice versa. Deliberately does NOT clear visibleGameIds/selectedGameId:
  // React runs child effects before parent ones, so clearing them here would
  // wipe the values the page being mounted has just published, leaving
  // get_current_view reporting an empty screen until a filter changed. The
  // mounted page is the sole owner of those two — each clears its own on
  // unmount — so resetting filters is enough, since that re-runs the page's
  // own sync effect.
  //
  // Filters staged for the page being navigated to are adopted instead of
  // being reset. The staged page has to match: an agent that stages for the
  // Store while the player clicks through to the Library should not have its
  // shortlist land on the wrong page.
  useEffect(() => {
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;

    const pending = pendingRef.current;
    pendingRef.current = null;
    setFilters(pending?.page === location.pathname ? pending.filters : EMPTY_FILTERS);
  }, [location.pathname]);

  const value = useMemo<ViewContextValue>(
    () => ({
      page: location.pathname,
      filters,
      setFilters,
      stageFiltersFor,
      visibleGameIds,
      setVisibleGameIds,
      selectedGameId,
      setSelectedGameId,
    }),
    [location.pathname, filters, stageFiltersFor, visibleGameIds, selectedGameId],
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used within a ViewProvider");
  return ctx;
}
