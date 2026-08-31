import type { Game } from "../data/games";
import type { Filters } from "../state/ViewContext";
import type { LibraryEntry } from "../data/libraries";

/**
 * Single source of truth for "does this game match these filters" — shared
 * by the Store/Library pages and the search_games WebMCP tool, so the agent
 * and the human are always looking at the same result set for the same
 * filters.
 */
export function filterGames(games: Game[], filters: Filters, viewerLibrary?: LibraryEntry[]): Game[] {
  return games.filter((g) => {
    if (filters.genres.length > 0 && !filters.genres.some((genre) => g.genres.includes(genre))) return false;
    if (filters.minPlayers != null && g.maxPlayers < filters.minPlayers) return false;
    if (filters.coop && g.coopModes.length === 0) return false;
    if (filters.maxSessionMinutes != null && g.sessionMinutes.min > filters.maxSessionMinutes) return false;

    if ((filters.onlyUnfinished || filters.onlyInstalled) && viewerLibrary) {
      const entry = viewerLibrary.find((e) => e.gameId === g.id);
      if (filters.onlyUnfinished && entry?.completed) return false;
      if (filters.onlyInstalled && !entry?.installed) return false;
    }

    return true;
  });
}

export function allGenres(games: Game[]): string[] {
  return Array.from(new Set(games.flatMap((g) => g.genres))).sort();
}
