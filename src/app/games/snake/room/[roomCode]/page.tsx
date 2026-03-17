import { redirect } from "next/navigation";

export default async function SnakeRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  await params;
  redirect("/");
}
