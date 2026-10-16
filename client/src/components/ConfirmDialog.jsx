import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

export default function ConfirmDialog({ title, children, busy, error, onCancel, onConfirm, confirmLabel = "Delete" }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog ref={ref} className="confirmation-dialog" aria-labelledby="confirm-title"
      onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
      <div className="flex items-center justify-between">
        <span className="rounded-2xl bg-orange-50 p-3 text-orange-700"><AlertTriangle size={24}/></span>
        <button type="button" className="icon-button" aria-label="Close confirmation" onClick={onCancel} disabled={busy}><X size={20}/></button>
      </div>
      <h2 id="confirm-title" className="mt-5 text-2xl font-extrabold">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-stone-600">{children}</div>
      {error && <p role="alert" className="error-box mt-4">{error}</p>}
      <div className="mt-7 flex justify-end gap-3">
        <button type="button" autoFocus className="btn-secondary" disabled={busy} onClick={onCancel}>Keep it</button>
        <button type="button" className="btn-danger" disabled={busy} onClick={onConfirm}>
          {busy && <Loader2 size={16} className="animate-spin"/>}{busy ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
