import { useNavigate } from "react-router-dom";
import { useTool } from "./useTool";
import { toArray } from "./normalize";
import { FILTERABLE_PAGES, hasViewContext, isGamePage, useView, type Filters } from "../state/ViewContext";
import { useToast } from "../state/ToastContext";
import { GAME_BY_ID } from "../data/games";
import { SESSION_OVERRUN_FACTOR } from "../lib/filterGames";

const SESSION_BUDGET_DESCRIPTION = `Session budget in minutes. A game fits when its shortest session is within the budget and its longest overruns it by no more than ${Math.round((SESSION_OVERRUN_FACTOR - 1) * 100)}%.`;

interface ApplyFiltersInput extends Filters {
  clear?: boolean;
}

interface OpenGameInput {
  gameId: string;
}

// Page-context tools — registered ONLY while the player is looking at a game
// surface. This is the part a server-side MCP endpoint could never do: it
// reads and drives the screen the human is actually looking at.
//
// The gate is per-tool rather than all-or-nothing: "what am I looking at?" and
// "show me this game" make sense on a game page too, but "set the filters"
// only makes sense where there are filters.
export function ViewTools() {
  const { page, filters, setFilters, visibleGameIds, selectedGameId } = useView();
  const { notify } = useToast();
  const navigate = useNavigate();

  const onGameSurface = hasViewContext(page);
  const onFilterablePage = FILTERABLE_PAGES.includes(page);

  useTool(
    {
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
            selectedGameId: selectedGameId ?? null,
            selectedGame: game?.title ?? null,
          };
        }
        return {
          page,
          filters,
          visibleGameIds,
          visibleGames: visibleGameIds.map((id) => GAME_BY_ID[id]?.title).filter(Boolean),
        };
      },
    },
    onGameSurface,
  );

  useTool<ApplyFiltersInput>(
    {
      name: "apply_filters",
      description:
        "Set the filters on the view the player is currently looking at, updating their screen. Use it to show the player the shortlist you are reasoning about.",
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
          const cleared: Filters = { genres: [] };
          setFilters(cleared);
          notify("Filters cleared");
          return { filters: cleared };
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
        setFilters(next);
        notify("Filters updated");
        return { filters: next };
      },
    },
    onFilterablePage,
  );

  useTool<OpenGameInput>(
    {
      name: "open_game",
      description:
        "Navigate the player's screen to a game's page. Call this once you have chosen a recommendation, so the player is looking at the game you are describing.",
      inputSchema: {
        type: "object",
        properties: { gameId: { type: "string" } },
        required: ["gameId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        const game = GAME_BY_ID[input.gameId];
        if (!game) return { error: "not found" };
        navigate(`/game/${input.gameId}`);
        return { gameId: game.id, title: game.title };
      },
    },
    onGameSurface,
  );

  return null;
}
