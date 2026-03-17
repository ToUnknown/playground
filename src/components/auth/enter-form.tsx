"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/ui/modal";

type FlowState = {
  username: string;
  password: string;
  pending: boolean;
  error: string | null;
  confirmCreate: boolean;
};

export function EnterForm() {
  const router = useRouter();
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

    startTransition(() => {
      router.refresh();
      router.push("/");
    });
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
        }}
      >
        <div
          className="enter-simple-card"
          style={{
            width: "100%",
            padding: "28px 24px 24px",
            borderRadius: "28px",
            border: "1px solid rgba(123, 138, 185, 0.22)",
            background: "rgba(5, 6, 10, 0.98)",
            boxShadow: "0 24px 100px rgba(0, 0, 0, 0.45)",
          }}
        >
          <form
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: "12px",
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit("enter");
            }}
          >
            <div
              style={{
                color: "#74f7b2",
                fontSize: "1.6rem",
                fontFamily: "var(--font-display)",
                lineHeight: "1.05",
                letterSpacing: "0.04em",
                textAlign: "center",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              Friends Arcade
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
                    ? "1px solid rgba(116, 247, 178, 0.52)"
                    : hoveredInput === "username"
                      ? "1px solid rgba(116, 247, 178, 0.3)"
                      : "1px solid rgba(123, 138, 185, 0.22)",
                background:
                  focusedInput === "username"
                    ? "rgba(255, 255, 255, 0.05)"
                    : hoveredInput === "username"
                      ? "rgba(255, 255, 255, 0.045)"
                      : "rgba(255, 255, 255, 0.03)",
                boxShadow:
                  focusedInput === "username"
                    ? "0 0 0 4px rgba(116, 247, 178, 0.08)"
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
                    ? "1px solid rgba(116, 247, 178, 0.52)"
                    : hoveredInput === "password"
                      ? "1px solid rgba(116, 247, 178, 0.3)"
                      : "1px solid rgba(123, 138, 185, 0.22)",
                background:
                  focusedInput === "password"
                    ? "rgba(255, 255, 255, 0.05)"
                    : hoveredInput === "password"
                      ? "rgba(255, 255, 255, 0.045)"
                      : "rgba(255, 255, 255, 0.03)",
                boxShadow:
                  focusedInput === "password"
                    ? "0 0 0 4px rgba(116, 247, 178, 0.08)"
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
                height: "58px",
                marginTop: "8px",
                border: "none",
                borderRadius: "999px",
                background: buttonHovered
                  ? "linear-gradient(135deg, #2daf78 0%, #63d8a6 100%)"
                  : "linear-gradient(135deg, #3bcf91 0%, #77e7bb 100%)",
                boxShadow: buttonHovered
                  ? "0 12px 34px rgba(59, 207, 145, 0.22)"
                  : "none",
                color: "#07130f",
                fontSize: "1rem",
                appearance: "none",
                WebkitAppearance: "none",
                transform: buttonHovered ? "translateY(-1px)" : "translateY(0)",
                transition: "transform 160ms ease, background 160ms ease, box-shadow 160ms ease",
                cursor: state.pending ? "wait" : "pointer",
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
