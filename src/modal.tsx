import React, { useEffect, useId, useRef } from 'react';

/* =====================================================================
   THE MODAL SYSTEM — one shell, one form, one footer.

   Every overlay in this app used to author its own surface: its own <dialog>
   wrapper, its own <h2>, its own close affordance (or none), its own padding
   and its own footer row. They drifted, and the drift was visible — pane
   settings read as a different product from folder settings because it was
   built as a different component.

   So there is now exactly ONE dialog implementation. `ModalShell` owns the
   native element, the backdrop, Escape, backdrop-dismissal and focus
   restoration. `ModalForm` composes it into the standard settings surface:
   header, optional description, scrollable body, footer. A view supplies
   FIELDS and ACTIONS — never geometry.

   The palette is the one deliberate variant: it is a search surface, not a
   form, so it uses the same shell with its own body. It is a variant of the
   shell, not a second dialog.
   ===================================================================== */

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /* `false` for the first-run dialog: there is nothing to go back to. */
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
  /* One line under the title. Views that need more say it in a field note. */
  description?: string;
  /* Omitted when there is nowhere to dismiss to (first run). */
  onClose?: () => void;
  closeLabel?: string;
  /* Extra class on the surface, for width/behaviour variants only. */
  variant?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

/* The standard settings surface. Note what a caller can NOT do here: it cannot
   change the padding, the heading level, the close button's position or the
   footer's alignment. That is the point. */
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

/* The footer, in ONE order everywhere: destructive far left, then a spacer,
   then secondary, then primary. Views hand over buttons, never placement. */
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

/* A labelled control. The label/­control/hint relationship — including the
   generated id that ties them together — belongs here, so no view can ship a
   control that is only visually labelled. */
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

/* A group of controls that are not a single input (icon grids, swatch
   radiogroups, font sizes). Same caption treatment as Field, but the group is
   labelled by the caption rather than by `for`. */
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

/* A checkbox is a ROW: box and words on one line, sharing a label element.
   This shipped once as a dim uppercase caption because a view styled its own —
   every assertion passed and only the screenshot showed it. There is one
   implementation now. */
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
