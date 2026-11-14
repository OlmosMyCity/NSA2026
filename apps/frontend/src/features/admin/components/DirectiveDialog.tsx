'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Send, X } from 'lucide-react';
import { adminTriageService } from '../services/adminTriageService';
import type { CrewMemberTriage } from '../domain/types';

interface DirectiveDialogProps {
  member: CrewMemberTriage;
  onClose: () => void;
  onSent: () => void;
}

export function DirectiveDialog({ member, onClose, onSent }: DirectiveDialogProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!text.trim()) return;
    setError(null);
    try {
      setIsSending(true);
      const res = await adminTriageService.sendClinicalDirectives(member.astronautId, text.trim());
      setSentMessage(res.message);
      onSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The directive could not be transmitted. Try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="directive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-blueberry/25 p-4 backdrop-blur-sm animate-materialize"
    >
      <div className="surface-elevated w-full max-w-lg border border-line p-6 space-y-5">
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <h3 id="directive-modal-title" className="text-lg font-bold text-blueberry">
              Clinical Directive for {member.astronautName}
            </h3>
            <p className="mt-0.5 text-xs text-stem">
              Mission: {member.missionName} · Module: {member.environment}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="tactile-press flex h-8 w-8 items-center justify-center rounded-pill text-stem hover:bg-surface-subtle hover:text-blueberry"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sentMessage ? (
          <div className="rounded-lg border border-[var(--status-nominal-border)] bg-[var(--status-nominal-bg)] p-5 text-center text-xs text-status-nominal">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2" />
            <p className="font-medium">{sentMessage}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="directive-textarea" className="text-xs font-semibold text-blueberry block">
                Medical instruction or countermeasure protocol
              </label>
              <textarea
                id="directive-textarea"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Increase ARED session to 75 min, hydrate with 500 mL Ringer-lactate solution, and rest for 4 hours..."
                className="w-full rounded-md border border-line bg-surface-subtle p-3 text-sm text-blueberry placeholder:text-stem/60 focus:border-blueberry focus:bg-surface focus:outline-none focus:ring-1 focus:ring-blueberry"
              />
              <span className="text-[11px] text-stem block">
                The directive will be transmitted with acknowledgment and logged in the crew member&apos;s medical record.
              </span>
            </div>

            {error && (
              <div role="alert" className="ui-callout-critical flex items-start gap-2 text-xs text-status-critical">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="tactile-press rounded-pill border border-line bg-surface px-4 py-2 text-xs font-semibold text-berry hover:border-blueberry hover:text-blueberry"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending || !text.trim()}
                onClick={send}
                className="tactile-press inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Transmit to Capsule</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
