import { getSessionUser } from "@/lib/auth/server";
import { json, randomRoomCode } from "@/lib/utils";

export async function POST() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return json({ error: "Log in before creating rooms." }, { status: 401 });
  }

  const roomCode = randomRoomCode();
  return json({
    roomCode,
    href: `/games/snake/room/${roomCode}`,
  });
}
