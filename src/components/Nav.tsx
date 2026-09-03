import { NavLink } from "react-router-dom";
import { UserSwitcher } from "./UserSwitcher";
import { useSession } from "../state/SessionContext";
import { useParty } from "../state/PartyContext";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/store", label: "Store" },
  { to: "/library", label: "Library" },
  { to: "/friends", label: "Friends" },
];

export function Nav() {
  const { viewer } = useSession();
  const { party } = useParty();
  const pendingInvite = party?.members.some((m) => m.userId === viewer.id && m.state === "invited") ?? false;

  return (
    <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          {/* Same mark as public/favicon.svg, so the tab and the header match. */}
          <svg viewBox="0 0 64 64" aria-hidden="true" className="h-[22px] w-[22px] shrink-0">
            <defs>
              <linearGradient id="claw-mark" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#63c5f5" />
                <stop offset="1" stopColor="#1c7db0" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="16" fill="url(#claw-mark)" />
            {/* Three tapered slashes: pointed ends read as a claw rake,
                where uniform strokes read as signal bars. */}
            <g fill="#fff" transform="rotate(-24 32 32)">
              <path d="M16 14q11 16 10 34-8-16-10-34Z" />
              <path d="M30 10q12 19 11 40-9-20-11-40Z" />
              <path d="M44 14q11 16 10 33-8-16-10-33Z" />
            </g>
          </svg>
          <span className="text-base font-semibold tracking-tight text-white">
            Captain <span className="text-accent-400">Claw</span>
          </span>
        </NavLink>
        <nav className="flex flex-wrap gap-4 text-sm">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "font-medium text-white" : "text-neutral-400 hover:text-neutral-200")}
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/party"
            className={({ isActive }) => `relative ${isActive ? "font-medium text-white" : "text-neutral-400 hover:text-neutral-200"}`}
          >
            Party
            {pendingInvite && <span className="absolute -right-2.5 -top-1 h-2 w-2 rounded-full bg-accent-500" />}
          </NavLink>
        </nav>
        <div className="ml-auto">
          <UserSwitcher />
        </div>
      </div>
    </header>
  );
}
