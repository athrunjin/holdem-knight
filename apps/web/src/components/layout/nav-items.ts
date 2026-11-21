import { Calculator, CircleUser, Coins, Users } from "lucide-react";

/**
 * Main navigation. Shown at the bottom on phones and at the side on tablets and up. A label is the
 * name its text goes by in the catalog's `shell.nav`.
 */
export const NAV_ITEMS = [
  { to: "/", label: "games", icon: Coins },
  { to: "/players", label: "players", icon: Users },
  { to: "/tools", label: "tools", icon: Calculator },
  { to: "/me", label: "me", icon: CircleUser },
] as const;
