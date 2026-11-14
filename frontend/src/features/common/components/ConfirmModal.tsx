'use client';

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-blueberry/35 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="surface-elevated w-full max-w-md p-6 relative animate-materialize"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="tactile-press absolute top-4 right-4 rounded-md p-1 text-stem hover:bg-surface-tinted hover:text-blueberry"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md ${
              isDestructive
                ? 'bg-status-critical/10 text-status-critical'
                : 'bg-surface-tinted text-blueberry'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="flex-1 pr-6">
            <h3 className="text-base font-bold text-blueberry">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stem">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-line pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="tactile-press rounded-md border border-line bg-surface px-4 py-2 text-xs font-semibold text-blueberry hover:bg-surface-tinted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`tactile-press rounded-md px-4 py-2 text-xs font-semibold text-plate disabled:opacity-50 ${
              isDestructive
                ? 'bg-status-critical hover:bg-status-critical/90'
                : 'bg-blueberry hover:bg-berry'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

