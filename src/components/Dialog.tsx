import { useEffect, useRef } from "react";
/** Native modal semantics provide Escape dismissal and keyboard focus containment. */
export function Dialog({
  children,
  onClose,
  labelledBy,
  alert = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
  alert?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal native-dialog"
      aria-labelledby={labelledBy}
      role={alert ? "alertdialog" : "dialog"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
