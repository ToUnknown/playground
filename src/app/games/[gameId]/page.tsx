import { redirect } from "next/navigation";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  await params;
  redirect("/");
}
