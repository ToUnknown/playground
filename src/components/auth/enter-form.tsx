"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";

type FlowState = {
  username: string;
  password: string;
  pending: boolean;
  error: string | null;
  confirmCreate: boolean;
};

export function EnterForm() {
  const [state, setState] = useState<FlowState>({
    username: "",
    password: "",
    pending: false,
    error: null,
    confirmCreate: false,
  });
  const [hoveredInput, setHoveredInput] = useState<"username" | "password" | null>(null);
  const [focusedInput, setFocusedInput] = useState<"username" | "password" | null>(null);
  const [buttonHovered, setButtonHovered] = useState(false);

  async function submit(mode: "enter" | "confirm") {
    setState((current) => ({ ...current, pending: true, error: null }));

    const endpoint =
      mode === "confirm" ? "/api/auth/confirm" : "/api/auth/enter";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: state.username,
        password: state.password,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setState((current) => ({
        ...current,
        pending: false,
        error: payload.error ?? "Something went sideways.",
        confirmCreate: false,
      }));
      return;
    }

    if (payload.status === "needs_confirmation") {
      setState((current) => ({
        ...current,
        pending: false,
        confirmCreate: true,
      }));
      return;
    }

    window.location.assign("/");
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "360px",
          maxWidth: "calc(100vw - 48px)",
          zIndex: 1,
        }}
      >
        <div
          className="enter-simple-card"
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "28px",
            border: "1px solid rgba(183, 190, 159, 0.16)",
            background: "rgba(10, 14, 9, 0.18)",
            backdropFilter: "blur(8px)",
            boxShadow: "none",
          }}
        >
          <form
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: "10px",
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit("enter");
            }}
          >
            <div
              style={{
                color: "#d2df93",
                fontSize: "2rem",
                fontFamily: "var(--font-display)",
                lineHeight: "1.05",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                paddingTop: "6px",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              Playdround
            </div>
            <input
              name="username"
              value={state.username}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              autoComplete="username"
              placeholder="Name"
              onMouseEnter={() => setHoveredInput("username")}
              onMouseLeave={() => setHoveredInput((current) => (current === "username" ? null : current))}
              onFocus={() => setFocusedInput("username")}
              onBlur={() => setFocusedInput((current) => (current === "username" ? null : current))}
              style={{
                width: "100%",
                height: "56px",
                borderRadius: "18px",
                border:
                  focusedInput === "username"
                    ? "1px solid rgba(210, 223, 147, 0.34)"
                    : hoveredInput === "username"
                      ? "1px solid rgba(183, 190, 159, 0.22)"
                      : "1px solid rgba(183, 190, 159, 0.12)",
                background:
                  focusedInput === "username"
                    ? "rgba(12, 18, 10, 0.38)"
                    : hoveredInput === "username"
                      ? "rgba(12, 18, 10, 0.32)"
                      : "rgba(10, 14, 9, 0.28)",
                boxShadow:
                  focusedInput === "username"
                    ? "inset 0 1px 0 rgba(210, 223, 147, 0.05), 0 0 0 4px rgba(139, 172, 15, 0.08)"
                    : "none",
                color: "#f4f2ed",
                padding: "0 18px",
                fontSize: "1rem",
                outline: "none",
                appearance: "none",
                WebkitAppearance: "none",
                transition:
                  "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
              }}
            />
            <input
              name="password"
              type="password"
              value={state.password}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              autoComplete="current-password"
              placeholder="Password"
              onMouseEnter={() => setHoveredInput("password")}
              onMouseLeave={() => setHoveredInput((current) => (current === "password" ? null : current))}
              onFocus={() => setFocusedInput("password")}
              onBlur={() => setFocusedInput((current) => (current === "password" ? null : current))}
              style={{
                width: "100%",
                height: "56px",
                borderRadius: "18px",
                border:
                  focusedInput === "password"
                    ? "1px solid rgba(210, 223, 147, 0.34)"
                    : hoveredInput === "password"
                      ? "1px solid rgba(183, 190, 159, 0.22)"
                      : "1px solid rgba(183, 190, 159, 0.12)",
                background:
                  focusedInput === "password"
                    ? "rgba(12, 18, 10, 0.38)"
                    : hoveredInput === "password"
                      ? "rgba(12, 18, 10, 0.32)"
                      : "rgba(10, 14, 9, 0.28)",
                boxShadow:
                  focusedInput === "password"
                    ? "inset 0 1px 0 rgba(210, 223, 147, 0.05), 0 0 0 4px rgba(139, 172, 15, 0.08)"
                    : "none",
                color: "#f4f2ed",
                padding: "0 18px",
                fontSize: "1rem",
                outline: "none",
                appearance: "none",
                WebkitAppearance: "none",
                transition:
                  "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
              }}
            />
            {state.error ? (
              <p style={{ color: "#ff6b7d", fontSize: "0.95rem" }}>{state.error}</p>
            ) : null}
            <button
              type="submit"
              disabled={state.pending}
              onMouseEnter={() => setButtonHovered(true)}
              onMouseLeave={() => setButtonHovered(false)}
              style={{
                width: "100%",
                minHeight: "46px",
                marginTop: "8px",
                border: "1px solid rgba(183, 190, 159, 0.16)",
                borderRadius: "999px",
                background: buttonHovered ? "rgba(47, 71, 34, 0.28)" : "rgba(126, 138, 179, 0.1)",
                boxShadow: buttonHovered
                  ? "inset 0 1px 0 rgba(210, 223, 147, 0.06)"
                  : "none",
                color: "#d2df93",
                fontSize: "1rem",
                appearance: "none",
                WebkitAppearance: "none",
                transform: buttonHovered ? "translateY(-1px)" : "translateY(0)",
                transition:
                  "transform 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease",
                cursor: state.pending ? "wait" : "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {state.pending ? "..." : "Enter"}
            </button>
          </form>
        </div>
      </div>
      <Modal
        open={state.confirmCreate}
        title="Create account?"
        body={
          <p>
            <strong>{state.username}</strong>
          </p>
        }
        confirmLabel={state.pending ? "..." : "Create"}
        onCancel={() =>
          setState((current) => ({
            ...current,
            confirmCreate: false,
            pending: false,
          }))
        }
        onConfirm={() => {
          void submit("confirm");
        }}
      />
    </>
  );
}
