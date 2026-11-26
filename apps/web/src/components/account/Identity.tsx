import { playerNumberText } from "@holdem-knight/core";
import { Link } from "@tanstack/react-router";
import { User } from "lucide-react";
import type { ReactNode } from "react";
import { InfoButton } from "@/components/InfoButton";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { useAccount, useSession } from "@/data/session";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";
import type { MyPlayerState } from "@/lib/my-player";

/** Who is using the app, as the header of 我的 shows them. */
export type Identity =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly name: string;
      /** The record's number, where it has one to tell it from a namesake */
      readonly number?: string | undefined;
      /** The avatar's first character comes from `name`. Missing for the guest's placeholder */
      readonly avatar?: { readonly id: string; readonly ground: string } | undefined;
      /** The muted line under the name, and what its (i) says */
      readonly line: string;
      readonly about: string;
      /** A guest who can sign in: the block leads to the sign-in page, with its pill */
      readonly signIn: boolean;
    };

/**
 * Who is using the app: the guest, or the account signed in by its name, or the part of its
 * address before the `@` until it has one, with a neutral avatar. Signed in with a player chosen
 * as oneself, that player instead, with their own avatar and number. Waits while a chosen player
 * is looked up, so the name never flips from the account's to the player's.
 */
export function useIdentity({ mine }: Pick<MyPlayerState, "mine">): Identity {
  const session = useSession();
  const { data: account } = useAccount(session.status === "signed-in" ? session.userId : undefined);

  switch (session.status) {
    case "loading":
      return { status: "loading" };
    case "unavailable":
      return {
        status: "ready",
        name: t.me.header.guest,
        line: t.me.header.localOnly,
        about: t.me.guestOnly.body,
        signIn: false,
      };
    case "signed-out":
      return {
        status: "ready",
        name: t.me.header.guest,
        line: t.me.header.localOnly,
        about: t.me.signedOut.body,
        signIn: true,
      };
    case "signed-in": {
      if (mine.status === "loading") return { status: "loading" };
      if (mine.status === "chosen") {
        const { player } = mine;
        return {
          status: "ready",
          name: player.name,
          number: player.number === undefined ? undefined : playerNumberText(player.number),
          // No ground of its own: the player's avatar keeps theirs
          avatar: { id: player.id, ground: "" },
          line: t.me.header.synced,
          about: t.me.account.note,
          signIn: false,
        };
      }
      const name = account?.displayName || session.email.split("@")[0] || session.email;
      return {
        status: "ready",
        name,
        avatar: { id: session.userId, ground: "bg-line" },
        line: t.me.header.synced,
        about: t.me.account.note,
        signIn: false,
      };
    }
  }
}

/**
 * The left of 我的's header: an avatar, the name and a muted line under it with its (i). A guest
 * who can sign in has the avatar and name as one link to the sign-in page, with a small pill
 * saying so after the name; the (i) is a target of its own beside it.
 */
export function IdentityHeader({ myPlayer }: { myPlayer: MyPlayerState }) {
  const identity = useIdentity(myPlayer);
  // While the session is read, the header keeps its height so nothing moves when it arrives
  if (identity.status === "loading") return <div className="h-11" />;

  const { name, number, avatar, line, about, signIn } = identity;
  const block: ReactNode = (
    <>
      {avatar ? (
        <PlayerAvatar id={avatar.id} name={name} size="header" className={avatar.ground} />
      ) : (
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-line text-muted"
        >
          <User className="size-5" strokeWidth={1.75} />
        </span>
      )}
      <span className="flex min-w-0 flex-col">
        {/* The name gives way before the number and the pill do */}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-base leading-6 font-semibold">{name}</span>
          {number !== undefined && (
            <span className="shrink-0 text-sm text-muted tabular-nums">{number}</span>
          )}
          {signIn && (
            <span className="shrink-0 rounded-lg border border-highlight px-1.5 text-xs leading-5 font-medium text-highlight">
              {t.common.signIn}
            </span>
          )}
        </span>
        <span className="text-xs leading-4 text-muted">{line}</span>
      </span>
    </>
  );
  const blockClass = "flex min-h-11 min-w-0 items-center gap-2.5";

  return (
    <div className="flex min-w-0 items-center">
      {signIn ? (
        <Link to="/me/sign-in" className={cn(blockClass, "rounded-lg")}>
          {block}
        </Link>
      ) : (
        <div className={blockClass}>{block}</div>
      )}
      {/* Moved down to the line it explains, beside the block and not over it */}
      <span className="relative top-3 shrink-0">
        <InfoButton title={line} text={about} target />
      </span>
    </div>
  );
}
