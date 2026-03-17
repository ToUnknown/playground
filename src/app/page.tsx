import { GameboyArcade } from "@/components/arcade/gameboy-arcade";
import { getSessionUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/enter");
  }

  return <GameboyArcade sessionUser={sessionUser} />;
}
