import React, { useCallback, useState } from 'react';

/**
 * Drop-in HTML replacement for window.confirm / window.alert. Two
 * modes:
 *   - confirm: Cancel + primary action (variant: primary | danger)
 *   - alert:   single OK button (omit onCancel)
 *
 * Use the `useConfirmModal()` hook below for the common case where
 * a component needs an async confirm() that resolves to bool.
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel  = 'Cancel',
  variant      = 'primary',         // 'primary' | 'danger'
  onConfirm,
  onCancel,                          // undefined → no Cancel button (alert-style)
}) {
  const close = onCancel || onConfirm;
  const primaryClass = variant === 'danger' ? 'btn-primary danger' : 'btn-primary';
  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
        {title && <h3 className="modal-title">{title}</h3>}
        <div className="modal-help">{message}</div>
        <div className="modal-actions">
          {onCancel && (
            <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          )}
          <button className={primaryClass} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook that returns a `{ confirm, alert, modal }` triplet.
 *
 *   const { confirm, alert, modal } = useConfirmModal();
 *
 *   const ok = await confirm({ message: 'Delete?', variant: 'danger', confirmLabel: 'Delete' });
 *   if (!ok) return;
 *
 *   await alert({ message: 'Generate keydetails first.' });
 *
 *   return <>{...your UI...}{modal}</>;
 */
export function useConfirmModal() {
  const [state, setState] = useState(null);

  const finish = useCallback((result) => {
    setState(prev => {
      if (prev) prev._resolve(result);
      return null;
    });
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setState({
      title:        opts?.title,
      message:      opts?.message,
      confirmLabel: opts?.confirmLabel ?? 'OK',
      cancelLabel:  opts?.cancelLabel  ?? 'Cancel',
      variant:      opts?.variant      ?? 'primary',
      isAlert:      false,
      _resolve:     resolve,
    });
  }), []);

  const alert = useCallback((opts) => new Promise((resolve) => {
    setState({
      title:        opts?.title,
      message:      opts?.message,
      confirmLabel: opts?.confirmLabel ?? 'OK',
      isAlert:      true,
      _resolve:     resolve,
    });
  }), []);

  const modal = state ? (
    <ConfirmModal
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      variant={state.variant}
      onConfirm={() => finish(true)}
      onCancel={state.isAlert ? undefined : () => finish(false)}
    />
  ) : null;

  return { confirm, alert, modal };
}
