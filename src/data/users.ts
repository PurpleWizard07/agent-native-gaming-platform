export type Presence = "online" | "offline";

export interface User {
  id: string;
  name: string;
  /** Hex color for the avatar — no licensed artwork used. */
  avatar: string;
  presence: Presence;
  playingGameId?: string;
}

export const SIGNED_IN_USER_ID = "alex";

export const USERS: User[] = [
  { id: "alex", name: "Alex", avatar: "#a855f7", presence: "online" },
  { id: "justin", name: "Justin", avatar: "#f97316", presence: "online", playingGameId: "ridge-runners" },
  { id: "robert", name: "Robert", avatar: "#22c55e", presence: "online" },
  { id: "sarah", name: "Sarah", avatar: "#0ea5e9", presence: "online" },
  { id: "andrew", name: "Andrew", avatar: "#64748b", presence: "offline" },
];

export const USER_BY_ID: Record<string, User> = Object.fromEntries(USERS.map((u) => [u.id, u]));

export const FRIENDSHIPS: Record<string, string[]> = {
  alex: ["justin", "robert", "sarah", "andrew"],
  justin: ["alex", "robert", "sarah"],
  robert: ["alex", "justin", "sarah"],
  sarah: ["alex", "justin", "robert"],
  andrew: ["alex"],
};
