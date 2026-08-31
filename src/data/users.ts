export type Presence = "online" | "offline";

export interface User {
  id: string;
  name: string;
  /** Hex color for the avatar — no licensed artwork used. */
  avatar: string;
  presence: Presence;
  playingGameId?: string;
}

export const SIGNED_IN_USER_ID = "purple";

export const USERS: User[] = [
  { id: "purple", name: "Purple", avatar: "#a855f7", presence: "online" },
  { id: "alex", name: "Alex", avatar: "#f97316", presence: "online", playingGameId: "ridge-runners" },
  { id: "sam", name: "Sam", avatar: "#22c55e", presence: "online" },
  { id: "maya", name: "Maya", avatar: "#0ea5e9", presence: "online" },
  { id: "chris", name: "Chris", avatar: "#64748b", presence: "offline" },
];

export const USER_BY_ID: Record<string, User> = Object.fromEntries(USERS.map((u) => [u.id, u]));

export const FRIENDSHIPS: Record<string, string[]> = {
  purple: ["alex", "sam", "maya", "chris"],
  alex: ["purple", "sam", "maya"],
  sam: ["purple", "alex", "maya"],
  maya: ["purple", "alex", "sam"],
  chris: ["purple"],
};
