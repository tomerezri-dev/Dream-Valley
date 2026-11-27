import { useState } from 'react';
import { Sheet } from './Sheet';

interface Props {
  name: string;
  email: string;
  onSaveName: (name: string) => void;
  onSignOut: () => void;
  onClose: () => void;
}

export function AccountSheet({ name, email, onSaveName, onSignOut, onClose }: Props) {
  const [n, setN] = useState(name);
  const close = () => {
    if (n.trim() && n.trim() !== name) onSaveName(n.trim());
    onClose();
  };
  return (
    <Sheet label="החשבון שלי" onClose={close}>
      <h3>החשבון שלי</h3>
      <label htmlFor="an">שם</label>
      <input className="f" id="an" value={n} onChange={e => setN(e.target.value)} maxLength={60} />
      <label>אימייל</label>
      <p className="ltr-val"><bdi dir="ltr">{email}</bdi></p>
      <div className="acts">
        <button className="btn ghost" onClick={onSignOut}>התנתקות</button>
        <button className="btn" onClick={close}>סיום</button>
      </div>
    </Sheet>
  );
}
