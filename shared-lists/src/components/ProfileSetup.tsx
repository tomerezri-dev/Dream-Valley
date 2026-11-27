import { useState, type FormEvent } from 'react';
import { errorText, sb } from '../supabase';
import type { Profile } from '../types';
import { Check } from './Icons';

export function ProfileSetup({ me, onDone }: { me: string; onDone: (p: Profile) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    const display_name = name.trim();
    if (!display_name) return;
    setBusy(true);
    const { data, error } = await sb.from('profiles').upsert({ id: me, display_name }).select('id,display_name').single();
    setBusy(false);
    if (error) setMsg(errorText(error));
    else onDone(data as Profile);
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={save}>
        <div className="brand big"><i><Check size={20} /></i>רשימות</div>
        <h1>איך לקרוא לך?</h1>
        <p className="mute">השם יופיע למי שתשתפו איתם רשימות.</p>
        <label htmlFor="dn">שם</label>
        <input id="dn" className="f" value={name} onChange={e => setName(e.target.value)} maxLength={60} autoFocus autoComplete="given-name" />
        {msg && <p className="err">{msg}</p>}
        <button className="btn wide" disabled={busy || !name.trim()}>המשך</button>
        <button type="button" className="link" onClick={() => sb.auth.signOut()}>התנתקות</button>
      </form>
    </div>
  );
}
