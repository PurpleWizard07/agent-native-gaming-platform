import type { Game } from "../data/games";

// Shared by the card grid and the game page, which each had their own copy —
// and each rendered a single-player game as "1 players".
export function playerCountLabel(game: Game): string {
  if (game.minPlayers === game.maxPlayers) {
    return `${game.maxPlayers} ${game.maxPlayers === 1 ? "player" : "players"}`;
  }
  return `${game.minPlayers}-${game.maxPlayers} players`;
}

export function sessionLengthLabel(game: Game): string {
  return `${game.sessionMinutes.min}-${game.sessionMinutes.max} min`;
}
