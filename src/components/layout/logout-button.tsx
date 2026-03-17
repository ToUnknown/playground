"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => {
        setPending(true);
        startTransition(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.refresh();
          router.push("/");
          setPending(false);
        });
      }}
    >
      {pending ? "Leaving..." : "Log out"}
    </Button>
  );
}
