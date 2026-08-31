import { useTool } from "./useTool";
import { toArray } from "./normalize";
import { useSession } from "../state/SessionContext";
import { GAMES, GAME_BY_ID } from "../data/games";
import { libraryFor, ownsGame } from "../data/libraries";
import { filterGames } from "../lib/filterGames";

interface LibraryFilterInput {
  onlyUnfinished?: boolean;
  onlyInstalled?: boolean;
}

interface FriendLibrariesInput {
  friendIds: string[];
}

interface SearchGamesInput {
  query?: string;
  genres?: string[];
  minPlayers?: number;
  coop?: boolean;
  maxSessionMinutes?: number;
}

interface GameDetailsInput {
  gameIds: string[];
}

// Read-only tools, available on every page — the baseline catalog/library/
// friends surface an agent needs regardless of what the player is looking at.
export function ReadTools() {
  const { library, friends } = useSession();

  useTool({
    name: "get_online_friends",
    description:
      "List the player's friends with online status and what each is playing right now. Call this first for any request involving 'us', 'we', or named friends, to confirm who is actually available before recommending anything.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    execute: () =>
      friends.map((f) => ({
        id: f.id,
        name: f.name,
        presence: f.presence,
        playingGameId: f.playingGameId ?? null,
      })),
  });

  useTool<LibraryFilterInput>({
    name: "get_my_library",
    description:
      "List the games the signed-in player owns, with playtime, completion state, install state and last played date. The starting set for both solo picks and group matching.",
    inputSchema: {
      type: "object",
      properties: {
        onlyUnfinished: { type: "boolean", description: "If true, only include games not yet completed." },
        onlyInstalled: { type: "boolean", description: "If true, only include installed games." },
      },
      additionalProperties: false,
    },
    execute: (input) =>
      library
        .filter((e) => (!input.onlyUnfinished || !e.completed) && (!input.onlyInstalled || e.installed))
        .map((e) => ({
          gameId: e.gameId,
          title: GAME_BY_ID[e.gameId]?.title,
          playtimeMinutes: e.playtimeMinutes,
          completed: e.completed,
          installed: e.installed,
          lastPlayedAt: e.lastPlayedAt,
        })),
  });

  useTool<FriendLibrariesInput>({
    name: "get_friend_libraries",
    description:
      "List which games each named friend owns and which they have completed. Pass every friend at once. Returns ownership and completion only — call get_game_details for player counts and session length.",
    inputSchema: {
      type: "object",
      properties: {
        friendIds: { type: "array", items: { type: "string" }, description: "Friend user ids, from get_online_friends." },
      },
      required: ["friendIds"],
      additionalProperties: false,
    },
    execute: (input) => {
      const result: Record<string, { gameId: string; title?: string; completed: boolean }[]> = {};
      for (const friendId of toArray(input.friendIds)) {
        result[friendId] = libraryFor(friendId).map((e) => ({
          gameId: e.gameId,
          title: GAME_BY_ID[e.gameId]?.title,
          completed: e.completed,
        }));
      }
      return result;
    },
  });

  useTool<SearchGamesInput>({
    name: "search_games",
    description:
      "Search and filter the catalog by text, genre, supported player count, co-op support and typical session length. Prefer this over reading the page when you need games matching hard constraints like 'supports 4' or 'under 75 minutes'. Does not know who owns what — intersect with the library tools.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search against the title." },
        genres: { type: "array", items: { type: "string" } },
        minPlayers: { type: "number", description: "Minimum player count the game must support, e.g. 4 for 'supports 4 players'." },
        coop: { type: "boolean", description: "If true, only games with a co-op mode." },
        maxSessionMinutes: { type: "number", description: "Only games whose typical session fits within this many minutes." },
      },
      additionalProperties: false,
    },
    execute: (input) => {
      let games = filterGames(GAMES, {
        genres: toArray(input.genres),
        minPlayers: input.minPlayers,
        coop: input.coop,
        maxSessionMinutes: input.maxSessionMinutes,
      });
      if (input.query) {
        const q = input.query.toLowerCase();
        games = games.filter((g) => g.title.toLowerCase().includes(q));
      }
      return games.map((g) => ({
        gameId: g.id,
        title: g.title,
        genres: g.genres,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        sessionMinutes: g.sessionMinutes,
      }));
    },
  });

  useTool<GameDetailsInput>({
    name: "get_game_details",
    description:
      "Full detail for one or more games: genres, player counts, co-op modes, typical session length, description, and which of the player's friends own it. Use after narrowing candidates, to compare them precisely.",
    inputSchema: {
      type: "object",
      properties: { gameIds: { type: "array", items: { type: "string" } } },
      required: ["gameIds"],
      additionalProperties: false,
    },
    execute: (input) =>
      toArray(input.gameIds).map((id) => {
        const game = GAME_BY_ID[id];
        if (!game) return { gameId: id, error: "not found" };
        const friendsWhoOwn = friends.filter((f) => ownsGame(f.id, id)).map((f) => ({ id: f.id, name: f.name }));
        return { ...game, friendsWhoOwn };
      }),
  });

  return null;
}
