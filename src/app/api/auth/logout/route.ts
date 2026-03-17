import { clearSession } from "@/lib/auth/server";
import { json } from "@/lib/utils";

export async function POST() {
  await clearSession();
  return json({ status: "ok" });
}
