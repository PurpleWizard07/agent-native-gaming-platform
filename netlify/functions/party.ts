import { getStore } from "@netlify/blobs";
import type { MemberState, PartyAction, PartyMember, PartyState } from "../../src/types/party";

const KEY = "current";

function computeStatus(members: PartyMember[], previousStatus: PartyState["status"]): PartyState["status"] {
  if (previousStatus === "launched") return "launched";
  if (members.length === 0) return "forming";
  const pending = members.some((m) => m.state === "invited");
  const anyAccepted = members.some((m) => m.state === "accepted");
  return !pending && anyAccepted ? "ready" : "forming";
}

export default async (req: Request) => {
  const store = getStore("party");

  if (req.method === "GET") {
    const party = await store.get(KEY, { type: "json" });
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
    await store.delete(KEY);
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
    await store.setJSON(KEY, party);
    return Response.json(party);
  }

  const current = (await store.get(KEY, { type: "json" })) as PartyState | null;
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
    await store.setJSON(KEY, updated);
    return Response.json(updated);
  }

  if (body.action === "respond") {
    const nextState: MemberState = body.accept ? "accepted" : "declined";
    const members = current.members.map((m) => (m.userId === body.userId ? { ...m, state: nextState } : m));
    const updated: PartyState = { ...current, members, status: computeStatus(members, current.status), updatedAt: new Date().toISOString() };
    await store.setJSON(KEY, updated);
    return Response.json(updated);
  }

  if (body.action === "launch") {
    if (current.status !== "ready") {
      return Response.json({ error: "party is not ready" }, { status: 400 });
    }
    const updated: PartyState = { ...current, status: "launched", updatedAt: new Date().toISOString() };
    await store.setJSON(KEY, updated);
    return Response.json(updated);
  }

  return Response.json({ error: "unknown action" }, { status: 400 });
};
