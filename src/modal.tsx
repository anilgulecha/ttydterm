import React, { useEffect, useId, useRef } from 'react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;

  dismissible?: boolean;
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export function ModalShell({ open, onClose, dismissible = true, className, initialFocusRef, children }: ModalShellProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus({preventScroll:true});
    }
    if (!open && dialog.open) dialog.close();
  }, [open, initialFocusRef]);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose(); }}
      onClick={(e) => { if (dismissible && e.target === ref.current) onClose(); }}
    >
      {open ? children : null}
    </dialog>
  );
}

interface ModalFormProps {
  title: string;

  description?: string;

  onClose?: () => void;
  closeLabel?: string;

  variant?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ModalForm({ title, description, onClose, closeLabel, variant, children, actions }: ModalFormProps) {
  const titleId = useId();
  return (
    <div className={'dlg' + (variant ? ' ' + variant : '')} role="group" aria-labelledby={titleId}>
      <div className="dlg-head">
        <h2 id={titleId}>{title}</h2>
        {onClose ? (
          <button className="dialog-x" type="button"
                  aria-label={closeLabel || 'Close ' + title.toLowerCase()}
                  title="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" data-icon="close" fill="none" stroke="currentColor"
                 strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </div>
      {description ? <p className="dlg-desc">{description}</p> : null}
      <div className="dlg-body">{children}</div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function ModalActions({ destructive, secondary, primary }: {
  destructive?: React.ReactNode;
  secondary?: React.ReactNode;
  primary?: React.ReactNode;
}) {
  return (
    <>
      {destructive || null}
      <span className="spacer" />
      {secondary || null}
      {primary || null}
    </>
  );
}

export function Button({ kind = 'default', onClick, disabled, children, ...rest }: {
  kind?: 'default' | 'primary' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  [attribute: string]: unknown;
}) {
  const cls = kind === 'primary' ? 'btn primary' : kind === 'danger' ? 'btn ghost-danger' : 'btn';
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} {...rest}>{children}</button>;
}

export function Field({ label, hint, hintTone, htmlFor, children }: {
  label: string;
  hint?: React.ReactNode;
  hintTone?: 'default' | 'warn' | 'error';
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className={'hint' + (hintTone === 'warn' ? ' warn' : hintTone === 'error' ? ' err' : '')}>{hint}</p> : null}
    </div>
  );
}

export function FieldGroup({ label, hint, children }: {
  label: string;
  hint?: React.ReactNode;
  children: (labelledBy: string) => React.ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="field">
      <label id={labelId}>{label}</label>
      {children(labelId)}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function CheckboxField({ label, checked, disabled, onChange, hint, hintTone }: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  hint?: React.ReactNode;
  hintTone?: 'default' | 'warn';
}) {
  return (
    <div className="field">
      <label className="check-row ps-check">
        <input type="checkbox" checked={checked} disabled={disabled}
               onChange={(e) => onChange(e.target.checked)} />
        <span>{label}</span>
      </label>
      {hint ? <p className={'hint' + (hintTone === 'warn' ? ' warn' : '')}>{hint}</p> : null}
    </div>
  );
}
