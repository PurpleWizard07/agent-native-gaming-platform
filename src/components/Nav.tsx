import { NavLink } from "react-router-dom";
import { UserSwitcher } from "./UserSwitcher";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/store", label: "Store" },
  { to: "/library", label: "Library" },
  { to: "/friends", label: "Friends" },
  { to: "/party", label: "Party" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="text-sm font-semibold tracking-tight text-white">Nightfall Arcade</span>
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
        </nav>
        <div className="ml-auto">
          <UserSwitcher />
        </div>
      </div>
    </header>
  );
}
