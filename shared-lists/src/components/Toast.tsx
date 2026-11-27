import { useEffect } from 'react';

export interface ToastMsg { msg: string; undo?: () => void; key: number }

export function Toast({ t, onDone }: { t: ToastMsg | null; onDone: () => void }) {
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(onDone, 5000);
    return () => clearTimeout(h);
  }, [t, onDone]);
  if (!t) return null;
  return (
    <div className="toast" role="status">
      <span>{t.msg}</span>
      {t.undo && <button onClick={() => { t.undo!(); onDone(); }}>ביטול</button>}
    </div>
  );
}
