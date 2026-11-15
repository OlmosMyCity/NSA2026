'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import {
  OPERATOR_PASSWORD_MIN,
  operatorAccessService,
  type OperatorAccess,
} from '../services/operatorAccessService';

const EMPTY_FORM = { name: '', email: '', password: '' };

/**
 * Acceso de supervisión desde Tierra: el cirujano de vuelo crea las cuentas de operador
 * y decide qué misión ve cada una. Un operador sin misión asignada no ve a nadie.
 */
export function OperatorAccessPanel() {
  const [access, setAccess] = useState<OperatorAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccess(await operatorAccessService.getAccess());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load operator access.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreated(null);

    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Enter a name and an email.');
      return;
    }
    if (form.password.length < OPERATOR_PASSWORD_MIN) {
      setFormError(`Use a password of at least ${OPERATOR_PASSWORD_MIN} characters.`);
      return;
    }

    try {
      setIsCreating(true);
      setFormError(null);
      const operator = await operatorAccessService.createOperator(form);
      setForm(EMPTY_FORM);
      setCreated(operator.email);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The account could not be created.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssign = async (missionId: string, operatorId: string | null) => {
    if (!access) return;
    const previous = access;
    // Respuesta inmediata; se revierte si el servidor rechaza el cambio.
    setAccess({
      ...access,
      missions: access.missions.map((m) => (m.id === missionId ? { ...m, operatorId } : m)),
    });
    setAssignError(null);
    try {
      await operatorAccessService.assignMission(missionId, operatorId);
    } catch (err) {
      setAccess(previous);
      setAssignError(err instanceof Error ? err.message : 'The assignment was not saved.');
    }
  };

  return (
    <section aria-labelledby="operator-access-title" className="mt-14 border-t border-line pt-10">
      <h2 id="operator-access-title" className="text-xl font-bold tracking-tight text-blueberry">
        Ground operator access
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-stem">
        Operators see the full record of the crew on the missions assigned to them: status, location,
        readiness and clinical values. They see nothing from other missions.
      </p>

      {loadError ? (
        <p role="alert" className="ui-callout-critical mt-6 text-sm text-status-critical">
          {loadError}
        </p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-blueberry">Mission assignment</h3>
            {!access ? (
              <p className="mt-4 text-sm text-stem" aria-busy="true">
                Loading missions…
              </p>
            ) : access.missions.length === 0 ? (
              <p className="mt-4 text-sm text-stem">No missions yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line/60">
                {access.missions.map((mission) => (
                  <li key={mission.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                    <label htmlFor={`operator-${mission.id}`} className="min-w-0 flex-1 text-sm text-blueberry">
                      {mission.name}
                    </label>
                    <select
                      id={`operator-${mission.id}`}
                      value={mission.operatorId ?? ''}
                      onChange={(e) => void handleAssign(mission.id, e.target.value || null)}
                      className="ui-select w-full text-sm sm:w-56"
                    >
                      <option value="">No operator</option>
                      {access.operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
            {assignError && (
              <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-status-critical">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {assignError}
              </p>
            )}
            {access && access.operators.length === 0 && (
              <p className="mt-3 text-xs text-stem">Create an operator account to assign a mission.</p>
            )}
          </div>

          <form onSubmit={handleCreate} noValidate className="space-y-4">
            <h3 className="text-sm font-semibold text-blueberry">New operator account</h3>
            <div>
              <label htmlFor="operator-name" className="text-xs font-medium text-stem">
                Name
              </label>
              <input
                id="operator-name"
                type="text"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="ui-input text-sm"
              />
            </div>
            <div>
              <label htmlFor="operator-email" className="text-xs font-medium text-stem">
                Email
              </label>
              <input
                id="operator-email"
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="ui-input text-sm"
              />
            </div>
            <div>
              <label htmlFor="operator-password" className="text-xs font-medium text-stem">
                Initial password
              </label>
              <input
                id="operator-password"
                type="password"
                autoComplete="new-password"
                aria-describedby="operator-password-hint"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="ui-input text-sm"
              />
              <span id="operator-password-hint" className="mt-1 block text-[11px] text-stem">
                At least {OPERATOR_PASSWORD_MIN} characters. Share it with the operator through a secure channel.
              </span>
            </div>

            {formError && (
              <p role="alert" className="flex items-center gap-2 text-xs text-status-critical">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {formError}
              </p>
            )}
            {created && (
              <p role="status" className="flex items-center gap-2 text-xs text-status-nominal">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Account created for {created}. Assign it a mission to give it access.
              </p>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="tactile-press inline-flex items-center gap-2 rounded-pill bg-blueberry px-5 py-2 text-xs font-semibold text-plate hover:bg-berry disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {isCreating ? 'Creating…' : 'Create operator'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
