import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { lockPageScroll } from "./scroll-lock";

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement;
    const releaseScroll = lockPageScroll();
    try {
      element.showModal();
    } catch (error) {
      releaseScroll();
      throw error;
    }
    return () => {
      element.close();
      releaseScroll();
      // Rotation can change the underlying overlay while this dialog is open.
      const foreground =
        document.querySelector<HTMLElement>("dialog[open]") ||
        document.querySelector<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        );
      if (foreground && !foreground.contains(previous))
        foreground
          .querySelector<HTMLElement>(
            "button:not(:disabled), a[href], input:not(:disabled), [tabindex='0']",
          )
          ?.focus({ preventScroll: true });
      else if (previous instanceof HTMLElement && previous.isConnected) {
        let target: HTMLElement | null = previous;
        // A responsive breakpoint can hide the opener while the dialog is open.
        while (target && target.getClientRects().length === 0)
          target = target.parentElement;
        if (target && target !== previous)
          target =
            [
              ...target.querySelectorAll<HTMLElement>(
                "button:not(:disabled), a[href], input:not(:disabled), [tabindex='0']",
              ),
            ].find((candidate) => candidate.getClientRects().length > 0) ??
            null;
        target?.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <dialog
      className={`modal ${wide ? "modal-wide" : ""} ${className}`}
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) {
          const rect = dialog.current.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
      aria-label={title}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
