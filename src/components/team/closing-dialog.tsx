"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";

const CloseContext = createContext<(() => void) | null>(null);

/**
 * A dialog whose form can close it (2026-10-28: "after pressing create the
 * modal should close"). Use it in place of `<Dialog>` around a form, and have
 * the form call `useCloseOnSuccess(state)`. Outside one, the hook does nothing,
 * so the same form still works inline on a page.
 */
export function ClosingDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Stable, so reopening the dialog does not re-run the form's effect and
  // shut it again straight away.
  const close = useCallback(() => setOpen(false), []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
    </Dialog>
  );
}

/**
 * Closes the surrounding `ClosingDialog` after a successful submission. Pass
 * the action's state object: each submission returns a new one, so a second
 * success closes the dialog again even though `ok` was already true.
 */
export function useCloseOnSuccess(state: { ok?: boolean }) {
  const close = useContext(CloseContext);
  useEffect(() => {
    if (state.ok) close?.();
  }, [state, close]);
}
