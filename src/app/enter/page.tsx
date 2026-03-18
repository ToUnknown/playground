import { redirect } from "next/navigation";

import { EnterForm } from "@/components/auth/enter-form";
import { GameboyCursorField } from "@/components/backgrounds/gameboy-cursor-field";
import { getSessionUser } from "@/lib/auth/server";

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7.5C4 6.67 4.67 6 5.5 6h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-13C4.67 18 4 17.33 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m5 8 6.18 4.63a1.4 1.4 0 0 0 1.64 0L19 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.9 12h16.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M12 3.5c2.2 2.45 3.4 5.5 3.4 8.5S14.2 18.05 12 20.5c-2.2-2.45-3.4-5.5-3.4-8.5S9.8 5.95 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        background: "var(--gameboy-screen-bg)",
      }}
    >
      <GameboyCursorField variant="login" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <EnterForm
          footer={
            <>
              <a
                href="mailto:Contact@to-unknown.com"
                aria-label="Email Contact@to-unknown.com"
                title="Contact@to-unknown.com"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  border: "1px solid rgba(183, 190, 159, 0.16)",
                  background: "rgba(10, 14, 9, 0.18)",
                  backdropFilter: "blur(8px)",
                  color: "#d2df93",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 1px 0 rgba(210, 223, 147, 0.04)",
                }}
              >
                <MailIcon />
              </a>
              <a
                href="https://to-unknown.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Visit to-unknown.com"
                title="https://to-unknown.com"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  border: "1px solid rgba(183, 190, 159, 0.16)",
                  background: "rgba(10, 14, 9, 0.18)",
                  backdropFilter: "blur(8px)",
                  color: "#d2df93",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 1px 0 rgba(210, 223, 147, 0.04)",
                }}
              >
                <GlobeIcon />
              </a>
            </>
          }
        />
      </div>
    </main>
  );
}
