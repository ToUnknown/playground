import type { PropsWithChildren } from "react";

export function DesktopOnlyGate({ children }: PropsWithChildren) {
  return (
    <>
      <div className="desktop-only-app">{children}</div>
      <div className="desktop-only-splash" aria-hidden="true">
        <div className="desktop-only-splash__panel">
          <div className="desktop-only-splash__badge">Desktop Only</div>
          <h1 className="desktop-only-splash__title">Playground</h1>
          <p className="desktop-only-splash__copy">This site is made for desktop.</p>
          <div className="desktop-only-splash__device" role="presentation">
            <div className="desktop-only-splash__screen">
              <span className="desktop-only-splash__pixel" />
              <span className="desktop-only-splash__pixel" />
              <span className="desktop-only-splash__pixel" />
            </div>
            <div className="desktop-only-splash__base" />
          </div>
        </div>
      </div>
    </>
  );
}
