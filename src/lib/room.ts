// The party service holds one party per "room". Without rooms every visitor
// to the live site would share (and clobber) a single global party, which
// breaks the moment two people evaluate the site at the same time.
//
// Resolution order, chosen so the two-window demo keeps working while
// separate visitors stay isolated:
//   1. ?room= in the URL      — an explicitly shared/copied invite link,
//                               the only thing that survives incognito or a
//                               different browser
//   2. localStorage           — a second normal window in the SAME browser
//                               joins the same room with no copying
//   3. a fresh random id      — a brand-new visitor gets their own room
//
// The resolved id is always written back into the URL so the address bar is
// a shareable invite link.

const STORAGE_KEY = "agp:roomId";
const VALID = /^[a-z0-9-]{1,32}$/i;
export const DEFAULT_ROOM = "current";

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function readStored(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && VALID.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

let resolved: string | null = null;

export function roomId(): string {
  if (resolved) return resolved;
  if (typeof window === "undefined") return DEFAULT_ROOM;

  const fromUrl = new URLSearchParams(window.location.search).get("room");
  const room = fromUrl && VALID.test(fromUrl) ? fromUrl : readStored() ?? generateRoomId();

  try {
    localStorage.setItem(STORAGE_KEY, room);
  } catch {
    // localStorage unavailable — the room still works, it just won't be
    // picked up automatically by a second window in this browser.
  }

  if (fromUrl !== room) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.history.replaceState(null, "", url);
  }

  resolved = room;
  return room;
}

/** The address to hand a second player so they land in this same party. */
export function inviteLink(): string {
  const url = new URL(window.location.origin + "/party");
  url.searchParams.set("room", roomId());
  return url.toString();
}
