import type { Game } from "../data/games";
import type { Filters } from "../state/ViewContext";
import type { LibraryEntry } from "../data/libraries";

/**
 * How far past a stated session budget a game's long tail may run and still
 * count as fitting it. A 45-70 min game fits a 60-minute evening; a 60-120
 * min game does not, even though it *can* be played in 60.
 *
 * Exported because scripts/check-funnel.ts asserts the hero-query funnel
 * against the same rule — the dataset check and the product must never
 * disagree about what "fits ~75 minutes" means.
 */
export const SESSION_OVERRUN_FACTOR = 1.3;

export function fitsSessionBudget(session: { min: number; max: number }, budgetMinutes: number): boolean {
  return session.min <= budgetMinutes && session.max <= budgetMinutes * SESSION_OVERRUN_FACTOR;
}

/**
 * Single source of truth for "does this game match these filters" — shared
 * by the Store/Library pages and the search_games WebMCP tool, so the agent
 * and the human are always looking at the same result set for the same
 * filters.
 */
export function filterGames(games: Game[], filters: Filters, viewerLibrary?: LibraryEntry[]): Game[] {
  const query = filters.query?.trim().toLowerCase();
  // A pinned shortlist is intersected with the other filters rather than
  // replacing them, so the predicates stay independent and order-free. In
  // practice show_games pins onto cleared filters, so the intersection is the
  // shortlist itself.
  const pinned = filters.gameIds?.length ? new Set(filters.gameIds) : null;

  return games.filter((g) => {
    if (pinned && !pinned.has(g.id)) return false;
    if (query && !g.title.toLowerCase().includes(query) && !g.genres.some((genre) => genre.toLowerCase().includes(query))) return false;
    if (filters.genres.length > 0 && !filters.genres.some((genre) => g.genres.includes(genre))) return false;
    if (filters.minPlayers != null && g.maxPlayers < filters.minPlayers) return false;
    if (filters.coop && g.coopModes.length === 0) return false;
    if (filters.maxSessionMinutes != null && !fitsSessionBudget(g.sessionMinutes, filters.maxSessionMinutes)) return false;

    if ((filters.onlyUnfinished || filters.onlyInstalled || filters.onlyUnplayed) && viewerLibrary) {
      const entry = viewerLibrary.find((e) => e.gameId === g.id);
      if (filters.onlyUnfinished && entry?.completed) return false;
      if (filters.onlyInstalled && !entry?.installed) return false;
      // "Never started" is a claim about an owned game, so an unowned game
      // can't satisfy it.
      if (filters.onlyUnplayed && (entry == null || entry.playtimeMinutes > 0)) return false;
    }

    return true;
  });
}

export function allGenres(games: Game[]): string[] {
  return Array.from(new Set(games.flatMap((g) => g.genres))).sort();
}
