"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export function Modal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <Panel className="modal-panel" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <div className="modal-body">{body}</div>
        <div className="button-row">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </Panel>
    </div>
  );
}
