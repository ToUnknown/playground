import { getSessionUser } from "@/lib/auth/server";
import { json } from "@/lib/utils";

export async function GET() {
  const sessionUser = await getSessionUser();
  return json({ user: sessionUser });
}
