export type MemberState = "invited" | "accepted" | "declined";

export interface PartyMember {
  userId: string;
  state: MemberState;
}

export type PartyStatus = "forming" | "ready" | "launched";

export interface PartyState {
  id: string;
  gameId: string;
  hostId: string;
  members: PartyMember[];
  status: PartyStatus;
  updatedAt: string;
}

export type PartyAction =
  | { action: "create"; gameId: string; hostId: string }
  | { action: "invite"; friendIds: string[] }
  | { action: "respond"; userId: string; accept: boolean }
  | { action: "launch" }
  | { action: "reset" };
