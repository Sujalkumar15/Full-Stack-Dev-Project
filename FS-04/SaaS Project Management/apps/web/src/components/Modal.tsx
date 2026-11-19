import { useEffect, type ReactNode } from "react";

interface ModalProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, description, onClose, children }: ModalProps) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onMouseDown={onClose}>
      <section className="max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 id="dialog-title" className="text-2xl font-bold tracking-[-0.025em] text-ink">{title}</h2>
            {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Close dialog">×</button>
        </div>
        <div className="mt-7">{children}</div>
      </section>
    </div>
  );
}
