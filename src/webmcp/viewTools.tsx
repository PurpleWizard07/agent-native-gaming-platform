import { useNavigate } from "react-router-dom";
import { useTool } from "./useTool";
import { toArray } from "./normalize";
import { FILTERABLE_PAGES, useView, type Filters } from "../state/ViewContext";
import { GAME_BY_ID } from "../data/games";

interface ApplyFiltersInput extends Filters {
  clear?: boolean;
}

interface OpenGameInput {
  gameId: string;
}

// Page-context tools — registered ONLY while the player is on Store or
// Library. This is the part a server-side MCP endpoint could never do: it
// reads and drives the screen the human is actually looking at.
export function ViewTools() {
  const { page, filters, setFilters, visibleGameIds, selectedGameId } = useView();
  const navigate = useNavigate();
  const enabled = FILTERABLE_PAGES.includes(page);

  useTool(
    {
      name: "get_current_view",
      description:
        "Describe what the player is looking at right now: the current page, the filters they set by hand, and the games visible on screen. Call this whenever the request refers to the screen — 'these', 'this list', 'what I'm looking at' — instead of searching the catalog from scratch.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => ({
        page,
        filters,
        visibleGameIds,
        visibleGames: visibleGameIds.map((id) => GAME_BY_ID[id]?.title).filter(Boolean),
        selectedGameId,
      }),
    },
    enabled,
  );

  useTool<ApplyFiltersInput>(
    {
      name: "apply_filters",
      description:
        "Set the filters on the view the player is currently looking at, updating their screen. Use it to show the player the shortlist you are reasoning about.",
      inputSchema: {
        type: "object",
        properties: {
          genres: { type: "array", items: { type: "string" } },
          minPlayers: { type: "number" },
          coop: { type: "boolean" },
          maxSessionMinutes: { type: "number" },
          onlyUnfinished: { type: "boolean" },
          onlyInstalled: { type: "boolean" },
          clear: { type: "boolean", description: "If true, ignore every other field and clear all filters." },
        },
        additionalProperties: false,
      },
      execute: (input) => {
        if (input.clear) {
          const cleared: Filters = { genres: [] };
          setFilters(cleared);
          return { filters: cleared };
        }
        const next: Filters = {
          genres: toArray(input.genres),
          minPlayers: input.minPlayers,
          coop: input.coop,
          maxSessionMinutes: input.maxSessionMinutes,
          onlyUnfinished: input.onlyUnfinished,
          onlyInstalled: input.onlyInstalled,
        };
        setFilters(next);
        return { filters: next };
      },
    },
    enabled,
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
      execute: (input) => {
        const game = GAME_BY_ID[input.gameId];
        if (!game) return { error: "not found" };
        navigate(`/game/${input.gameId}`);
        return { gameId: game.id, title: game.title };
      },
    },
    enabled,
  );

  return null;
}
