import { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children }) => {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-primary/75 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-sand shadow-xl shadow-primary/30">
        <header className="flex items-center justify-between border-b border-primary/15 px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-primary/50 transition hover:bg-secondary/20 hover:text-primary"
            aria-label="Close modal"
          >
            ✕
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6 text-primary/80">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
