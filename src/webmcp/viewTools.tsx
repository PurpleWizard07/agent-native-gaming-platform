import { useNavigate } from "react-router-dom";
import { useTool } from "./useTool";
import { toArray } from "./normalize";
import {
  DEFAULT_FILTER_PAGE,
  EMPTY_FILTERS,
  isFilterablePage,
  isGamePage,
  useView,
  type Filters,
} from "../state/ViewContext";
import { useToast } from "../state/ToastContext";
import { GAME_BY_ID } from "../data/games";
import { SESSION_OVERRUN_FACTOR } from "../lib/filterGames";

const SESSION_BUDGET_DESCRIPTION = `Session budget in minutes. A game fits when its shortest session is within the budget and its longest overruns it by no more than ${Math.round((SESSION_OVERRUN_FACTOR - 1) * 100)}%.`;

interface ApplyFiltersInput extends Filters {
  clear?: boolean;
}

interface ShowGamesInput {
  gameIds: string[];
}

interface OpenGameInput {
  gameId: string;
}

// View tools — the part a server-side MCP endpoint could never do: they read
// and drive the screen the human is actually looking at.
//
// All three register on every page, unconditionally. An earlier version gated
// them by route, which looked tidy and broke the product: a player who opened
// the site normally landed on Home, where the tool list contained no way to
// change the screen at all. An agent asked to find a game could only reach
// search_games, so it answered perfectly in chat and left the page untouched.
//
// Route-gating is also fragile against hosts that snapshot the tool list at
// the start of a turn: tools that appear only after the player navigates may
// not be visible until the next turn, or ever. Registering everywhere and
// navigating on demand keeps the capability constant and moves the routing
// decision inside the tool, where it can be handled instead of merely
// preventing the call.
export function ViewTools() {
  const { page, filters, setFilters, stageFiltersFor, visibleGameIds, selectedGameId } = useView();
  const { notify } = useToast();
  const navigate = useNavigate();

  /**
   * Put a filter state on screen, navigating first if the current page has no
   * filter bar to render it in. Returns where it landed so the tool result can
   * tell the agent which page the player is now looking at.
   */
  const showFilters = (next: Filters): { page: string; navigated: boolean } => {
    if (isFilterablePage(page)) {
      setFilters(next);
      return { page, navigated: false };
    }
    // Staged rather than set: ViewProvider resets filters on every pathname
    // change, so setting them in the same tick as the navigation would lose
    // them the moment the target page mounted.
    stageFiltersFor(DEFAULT_FILTER_PAGE, next);
    navigate(DEFAULT_FILTER_PAGE);
    return { page: DEFAULT_FILTER_PAGE, navigated: true };
  };

  useTool({
    name: "get_current_view",
    description:
      "Describe what the player is looking at right now: the current page, the filters they set by hand, and the games visible on screen — or, on a game page, which game is in focus. Call this whenever the request refers to the screen — 'these', 'this list', 'this game', 'what I'm looking at' — instead of searching the catalog from scratch.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: () => {
      // Shaped per page rather than one union of every field: a game page has
      // no list and no filters, and reporting the list the player left behind
      // on the Store would be worse than reporting nothing.
      if (isGamePage(page)) {
        const game = selectedGameId ? GAME_BY_ID[selectedGameId] : undefined;
        return {
          page,
          filterable: false,
          selectedGameId: selectedGameId ?? null,
          selectedGame: game?.title ?? null,
        };
      }

      const visibleGames = visibleGameIds.map((id) => GAME_BY_ID[id]?.title).filter(Boolean);

      if (isFilterablePage(page)) {
        return { page, filterable: true, filters, visibleGameIds, visibleGames };
      }

      // Friends and Party show no games at all. Saying so plainly, with where
      // the games are, beats an empty list the agent has to interpret.
      return {
        page,
        filterable: false,
        visibleGameIds,
        visibleGames,
        note:
          visibleGameIds.length > 0
            ? "This page shows games but has no filter bar. apply_filters and show_games will move the player to the Store."
            : "This page shows no games. Use show_games or apply_filters to put games on the player's screen — either will move them to the Store.",
      };
    },
  });

  useTool<ApplyFiltersInput>({
    name: "apply_filters",
    description:
      "Set the filters on the player's screen, changing which games they see. Works from any page: if they are not on a page with filters, this moves them to the Store first. Use it when your answer is a filter — a genre, a player count, a session budget. When your answer is a specific set of games you picked by reasoning, use show_games instead.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search against title and genre." },
        genres: { type: "array", items: { type: "string" } },
        minPlayers: { type: "number" },
        coop: { type: "boolean" },
        maxSessionMinutes: { type: "number", description: SESSION_BUDGET_DESCRIPTION },
        onlyUnfinished: { type: "boolean", description: "Library only: hide games already completed." },
        onlyUnplayed: { type: "boolean", description: "Library only: show only games never started." },
        onlyInstalled: { type: "boolean", description: "Library only: show only installed games." },
        clear: { type: "boolean", description: "If true, ignore every other field and clear all filters." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: (input) => {
      if (input.clear) {
        // Clearing is the one case that must not navigate: there is nothing to
        // clear on a page with no filters, and yanking the player to the Store
        // to prove it would be worse than saying so.
        if (!isFilterablePage(page)) {
          return { page, cleared: false, reason: "no filters on this page to clear" };
        }
        setFilters(EMPTY_FILTERS);
        notify("Filters cleared");
        return { page, cleared: true, filters: EMPTY_FILTERS };
      }

      const next: Filters = {
        query: input.query,
        genres: toArray(input.genres),
        minPlayers: input.minPlayers,
        coop: input.coop,
        maxSessionMinutes: input.maxSessionMinutes,
        onlyUnfinished: input.onlyUnfinished,
        onlyInstalled: input.onlyInstalled,
        onlyUnplayed: input.onlyUnplayed,
      };
      const landed = showFilters(next);
      notify("Filters updated");
      return { ...landed, filters: next };
    },
  });

  useTool<ShowGamesInput>({
    name: "show_games",
    description:
      "Put an exact set of games on the player's screen. This is how you show a shortlist you arrived at by reasoning — the games everyone owns, the ones that fit tonight — when no combination of filters would select exactly those games. Call it once you have decided, so the player is looking at the same games you are describing to them. Works from any page and will move the player to the Store if needed. On the Library it can only show games the player owns.",
    inputSchema: {
      type: "object",
      properties: {
        gameIds: {
          type: "array",
          items: { type: "string" },
          description: "The game ids to display, from search_games, get_my_library or get_game_details.",
        },
      },
      required: ["gameIds"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: (input) => {
      const requested = toArray(input.gameIds);
      const known = requested.filter((id) => GAME_BY_ID[id]);
      const unknown = requested.filter((id) => !GAME_BY_ID[id]);

      // Refusing outright beats pinning an empty set, which would leave the
      // player staring at "No games match these filters" with no way to tell
      // that the agent passed ids that don't exist.
      if (known.length === 0) {
        throw new Error(
          `none of these game ids exist: ${requested.join(", ") || "(empty list)"}. Call search_games to get valid ids.`,
        );
      }

      // Pinned onto cleared filters, not merged into the current ones: a genre
      // or session filter left over from the player's own clicking would hide
      // part of the shortlist, and the agent would have no idea.
      const landed = showFilters({ genres: [], gameIds: known });
      notify(`Showing ${known.length} ${known.length === 1 ? "pick" : "picks"}`);

      return {
        ...landed,
        shownGameIds: known,
        shownGames: known.map((id) => GAME_BY_ID[id]?.title),
        unknownGameIds: unknown,
      };
    },
  });

  useTool<OpenGameInput>({
    name: "open_game",
    description:
      "Navigate the player's screen to a game's page. Call this once you have chosen a single recommendation, so the player is looking at the game you are describing. Works from any page.",
    inputSchema: {
      type: "object",
      properties: { gameId: { type: "string" } },
      required: ["gameId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute: (input) => {
      const game = GAME_BY_ID[input.gameId];
      if (!game) throw new Error(`no game with id "${input.gameId}". Call search_games to get valid ids.`);
      navigate(`/game/${input.gameId}`);
      return { page: `/game/${game.id}`, gameId: game.id, title: game.title };
    },
  });

  return null;
}
