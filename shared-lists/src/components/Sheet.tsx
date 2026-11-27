import { useEffect, useRef, type ReactNode } from 'react';

/** Bottom sheet on phones, centred dialog on wider screens. Escape / scrim call onClose. */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', k);
    document.body.classList.add('locked');
    return () => {
      document.removeEventListener('keydown', k);
      document.body.classList.remove('locked');
    };
  }, []);
  return (
    <>
      <div className="scrim on" onClick={() => close.current()} />
      <div className="sheet on" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </>
  );
}
