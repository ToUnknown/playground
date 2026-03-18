"use client";

import { useEffect, useState, type ReactNode } from "react";

const PAGE_FADE_MS = 700;

type FlowState = {
  username: string;
  password: string;
  pending: boolean;
  error: string | null;
  confirmCreate: boolean;
};

export function EnterForm({ footer }: { footer?: ReactNode }) {
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
  const [confirmButtonHovered, setConfirmButtonHovered] = useState<"cancel" | "create" | null>(null);
  const [loginCardHovered, setLoginCardHovered] = useState(false);
  const [confirmCardHovered, setConfirmCardHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [pageExiting, setPageExiting] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPageVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  async function leavePage(nextLocation: string) {
    setPageExiting(true);

    await new Promise((resolve) => {
      window.setTimeout(resolve, PAGE_FADE_MS);
    });

    window.location.assign(nextLocation);
  }

  async function submit(mode: "enter" | "confirm") {
    if (state.pending || pageExiting) {
      return;
    }

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

    await leavePage("/");
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          width: "360px",
          maxWidth: "calc(100vw - 48px)",
          zIndex: 1,
          opacity: state.confirmCreate ? 0.22 : 1,
          transform: state.confirmCreate ? "translate(-50%, -50%) scale(0.98)" : "translate(-50%, -50%) scale(1)",
          filter: state.confirmCreate ? "blur(6px)" : "blur(0px)",
          pointerEvents: state.confirmCreate ? "none" : "auto",
          transition: "opacity 180ms ease, transform 180ms ease, filter 180ms ease",
        }}
      >
        <div
          className="enter-simple-card"
          onMouseEnter={() => setLoginCardHovered(true)}
          onMouseLeave={() => setLoginCardHovered(false)}
          style={{
            width: "100%",
            padding: "18px",
            borderRadius: "28px",
            border: "1px solid rgba(183, 190, 159, 0.16)",
            background: loginCardHovered ? "rgba(4, 6, 4, 0.74)" : "rgba(7, 10, 7, 0.34)",
            backdropFilter: loginCardHovered ? "blur(22px)" : "blur(12px)",
            boxShadow: "inset 0 1px 0 rgba(210, 223, 147, 0.04)",
            transition: "background-color 180ms ease, backdrop-filter 180ms ease",
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
      {state.confirmCreate ? (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12,
            display: "grid",
            placeItems: "center",
            padding: "24px",
            background: "rgba(0, 0, 0, 0.2)",
            backdropFilter: "blur(14px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-account-title"
            onMouseEnter={() => setConfirmCardHovered(true)}
            onMouseLeave={() => setConfirmCardHovered(false)}
            style={{
              width: "360px",
              maxWidth: "calc(100vw - 48px)",
              padding: "18px",
              borderRadius: "28px",
              border: "1px solid rgba(183, 190, 159, 0.16)",
              background: confirmCardHovered ? "rgba(4, 6, 4, 0.78)" : "rgba(7, 10, 7, 0.38)",
              backdropFilter: confirmCardHovered ? "blur(22px)" : "blur(12px)",
              boxShadow: "inset 0 1px 0 rgba(210, 223, 147, 0.04)",
              transition: "background-color 180ms ease, backdrop-filter 180ms ease",
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
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              Playdround
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  borderRadius: "20px",
                  border: "1px solid rgba(183, 190, 159, 0.12)",
                  background: "rgba(7, 10, 7, 0.56)",
                  padding: "18px",
                  textAlign: "center",
                }}
              >
                <h2
                  id="create-account-title"
                  style={{
                    color: "#f4f2ed",
                    fontSize: "1.1rem",
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Create New Account?
                </h2>
                <p
                  style={{
                    marginTop: "12px",
                    color: "#b9bfd6",
                    fontSize: "0.96rem",
                    lineHeight: 1.65,
                  }}
                >
                  The name <strong style={{ color: "#f4f2ed" }}>{state.username}</strong> does not exist yet.
                  Create a new account with this name and password?
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginTop: "4px",
                }}
              >
                <button
                  type="button"
                  onMouseEnter={() => setConfirmButtonHovered("cancel")}
                  onMouseLeave={() => setConfirmButtonHovered((current) => (current === "cancel" ? null : current))}
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      confirmCreate: false,
                      pending: false,
                    }))
                  }
                  style={{
                    minHeight: "46px",
                    border: "1px solid rgba(183, 190, 159, 0.16)",
                    borderRadius: "999px",
                    background:
                      confirmButtonHovered === "cancel" ? "rgba(22, 28, 18, 0.34)" : "rgba(10, 14, 9, 0.28)",
                    boxShadow:
                      confirmButtonHovered === "cancel"
                        ? "inset 0 1px 0 rgba(210, 223, 147, 0.04)"
                        : "none",
                    color: "#b9bfd6",
                    appearance: "none",
                    WebkitAppearance: "none",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    transition:
                      "transform 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                    transform: confirmButtonHovered === "cancel" ? "translateY(-1px)" : "translateY(0)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={state.pending}
                  onMouseEnter={() => setConfirmButtonHovered("create")}
                  onMouseLeave={() => setConfirmButtonHovered((current) => (current === "create" ? null : current))}
                  onClick={() => {
                    void submit("confirm");
                  }}
                  style={{
                    minHeight: "46px",
                    border: "1px solid rgba(183, 190, 159, 0.16)",
                    borderRadius: "999px",
                    background:
                      confirmButtonHovered === "create" ? "rgba(47, 71, 34, 0.28)" : "rgba(126, 138, 179, 0.1)",
                    boxShadow:
                      confirmButtonHovered === "create"
                        ? "inset 0 1px 0 rgba(210, 223, 147, 0.06)"
                        : "none",
                    color: "#d2df93",
                    appearance: "none",
                    WebkitAppearance: "none",
                    cursor: state.pending ? "wait" : "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    transition:
                      "transform 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease",
                    transform: confirmButtonHovered === "create" ? "translateY(-1px)" : "translateY(0)",
                  }}
                >
                  {state.pending ? "..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {footer ? (
        <div
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            opacity: pageVisible && !pageExiting ? 1 : 0,
            transform: pageVisible && !pageExiting ? "translateY(0)" : "translateY(8px)",
            transition: `opacity ${PAGE_FADE_MS}ms ease, transform ${PAGE_FADE_MS}ms ease`,
            pointerEvents: pageExiting ? "none" : "auto",
          }}
        >
          {footer}
        </div>
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "#000000",
          opacity: pageVisible && !pageExiting ? 0 : 1,
          transition: `opacity ${PAGE_FADE_MS}ms ease`,
          pointerEvents: pageExiting ? "auto" : "none",
        }}
      />
    </>
  );
}
