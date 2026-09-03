import { getStore } from "@netlify/blobs";
import type { MemberState, PartyAction, PartyMember, PartyState } from "../../src/types/party";

const DEFAULT_ROOM = "current";
const VALID_ROOM = /^[a-z0-9-]{1,32}$/i;

// One party per room, so two people evaluating the live site at the same time
// don't clobber each other's session. The client picks the room (see
// src/lib/room.ts) and passes it as ?room=; anything unexpected falls back to
// the shared default rather than becoming a junk key in the store.
function roomKey(req: Request): string {
  const raw = new URL(req.url).searchParams.get("room");
  return raw && VALID_ROOM.test(raw) ? raw.toLowerCase() : DEFAULT_ROOM;
}

function computeStatus(members: PartyMember[], previousStatus: PartyState["status"]): PartyState["status"] {
  if (previousStatus === "launched") return "launched";
  if (members.length === 0) return "forming";
  // A member who declined is not a blocker — the party launches without them.
  // launch_session's tool description and the Party page's waiting copy both
  // say "responded", not "accepted", to match this.
  const pending = members.some((m) => m.state === "invited");
  const anyAccepted = members.some((m) => m.state === "accepted");
  return !pending && anyAccepted ? "ready" : "forming";
}

export default async (req: Request) => {
  // Blobs reads default to eventual consistency, which means the read at the
  // start of an invite/respond/launch can miss the write from the create that
  // just happened — reproducible on production, never on `netlify dev`, whose
  // local emulation is trivially strong. Every action here is a
  // read-modify-write on a single key, so it needs strong reads throughout.
  const store = getStore("party", { consistency: "strong" });
  const key = roomKey(req);

  if (req.method === "GET") {
    const party = await store.get(key, { type: "json" });
    return Response.json(party ?? null);
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: PartyAction;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (body.action === "reset") {
    await store.delete(key);
    return Response.json(null);
  }

  if (body.action === "create") {
    const party: PartyState = {
      id: `party-${Date.now()}`,
      gameId: body.gameId,
      hostId: body.hostId,
      members: [{ userId: body.hostId, state: "accepted" }],
      status: "forming",
      updatedAt: new Date().toISOString(),
    };
    party.status = computeStatus(party.members, "forming");
    await store.setJSON(key, party);
    return Response.json(party);
  }

  const current = (await store.get(key, { type: "json" })) as PartyState | null;
  if (!current) {
    return Response.json({ error: "no active party" }, { status: 404 });
  }

  if (body.action === "invite") {
    const members = [...current.members];
    for (const friendId of body.friendIds) {
      const idx = members.findIndex((m) => m.userId === friendId);
      if (idx >= 0) members[idx] = { userId: friendId, state: "invited" };
      else members.push({ userId: friendId, state: "invited" });
    }
    const updated: PartyState = { ...current, members, status: computeStatus(members, current.status), updatedAt: new Date().toISOString() };
    await store.setJSON(key, updated);
    return Response.json(updated);
  }

  if (body.action === "respond") {
    const nextState: MemberState = body.accept ? "accepted" : "declined";
    const members = current.members.map((m) => (m.userId === body.userId ? { ...m, state: nextState } : m));
    const updated: PartyState = { ...current, members, status: computeStatus(members, current.status), updatedAt: new Date().toISOString() };
    await store.setJSON(key, updated);
    return Response.json(updated);
  }

  if (body.action === "launch") {
    if (current.status !== "ready") {
      return Response.json({ error: "party is not ready" }, { status: 400 });
    }
    const updated: PartyState = { ...current, status: "launched", updatedAt: new Date().toISOString() };
    await store.setJSON(key, updated);
    return Response.json(updated);
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
};
