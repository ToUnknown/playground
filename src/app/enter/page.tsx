import { redirect } from "next/navigation";

import { EnterForm } from "@/components/auth/enter-form";
import { getSessionUser } from "@/lib/auth/server";

export default async function EnterPage() {
  const sessionUser = await getSessionUser();

  if (sessionUser) {
    redirect("/");
  }

  return (
    <main
      className="enter-page-shell"
      style={{
        display: "grid",
        placeItems: "center",
        width: "100%",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      <EnterForm />
    </main>
  );
}
