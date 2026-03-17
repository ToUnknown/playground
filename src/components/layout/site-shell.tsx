import Link from "next/link";
import type { PropsWithChildren } from "react";

import type { SessionUser } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";

export function SiteShell({
  children,
  sessionUser,
  gameLayout = false,
}: PropsWithChildren<{
  sessionUser: SessionUser | null;
  gameLayout?: boolean;
}>) {
  return (
    <div className={cn("site-shell", gameLayout && "site-shell-game")}>
      <header className={cn("site-header", gameLayout && "site-header-game")}>
        <Link href="/" className="brand">
          Friends
          <span>Arcade</span>
        </Link>
        <nav className="site-nav">
          <Link href="/">Games</Link>
          <Link href="/leaderboards">Leaderboards</Link>
          {sessionUser ? (
            <div className="nav-user">
              <span className="user-chip">{sessionUser.username}</span>
              <LogoutButton />
            </div>
          ) : (
            <Link href="/enter" className="nav-cta">
              Enter
            </Link>
          )}
        </nav>
      </header>
      <main className={cn("site-main", gameLayout && "site-main-game")}>
        {children}
      </main>
    </div>
  );
}
