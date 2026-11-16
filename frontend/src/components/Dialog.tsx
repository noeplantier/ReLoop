import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Shared modal: green aura, focus kept inside, Escape and backdrop close, focus returns to the opener. */
export function Dialog({ title, onClose, children, footer, wide, eyebrow }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  eyebrow?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const box = ref.current!;
    const focusables = () =>
      Array.from(box.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
    (box.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? box).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dlg aura ${wide ? "dlg--wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <header className="dlg__head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id={id} className="dlg__title">{title}</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </header>
        <div className="dlg__body">{children}</div>
        {footer && <footer className="dlg__foot">{footer}</footer>}
      </div>
    </div>
  );
}
