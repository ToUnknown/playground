"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.assign("/enter");
      }}
    >
      {pending ? "Leaving..." : "Log out"}
    </Button>
  );
}
