"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Bottom sheet on phones, centred dialog on larger screens. Built on native <dialog>. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes the sheet.
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-4 sm:px-8 sm:pt-7">
            <h2 className="truncate font-display text-[26px] leading-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-2 transition hover:border-ink hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <div className="overflow-y-auto px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-8">{children}</div>
        </div>
      )}
    </dialog>
  );
}
