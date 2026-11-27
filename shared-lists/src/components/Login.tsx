import { useState, type FormEvent } from 'react';
import { sb } from '../supabase';
import { Check } from './Icons';

/** Email sign-in: a magic link, plus a code to type (needed in the home-screen app on iPhone). */
export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const addr = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(addr)) { setMsg('כתובת המייל לא תקינה'); return; }
    setBusy(true); setMsg('');
    const { error } = await sb.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    setBusy(false);
    if (error) {
      setMsg(error.status === 429 ? 'נשלחו יותר מדי מיילים. נסו שוב בעוד כמה דקות.' : 'השליחה נכשלה. בדקו את החיבור ונסו שוב.');
      return;
    }
    setSent(true);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, '');
    if (token.length < 6) { setMsg('הקלידו את הקוד מהמייל'); return; }
    setBusy(true); setMsg('');
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(false);
    if (error) setMsg('הקוד שגוי או שפג תוקפו. אפשר לשלוח מייל חדש.');
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand big"><i><Check size={20} /></i>רשימות</div>
        {!sent ? (
          <form onSubmit={send}>
            <h1>כניסה</h1>
            <p className="mute">נשלח לכם מייל עם קישור כניסה. לא צריך סיסמה.</p>
            <label htmlFor="em">אימייל</label>
            <input id="em" className="f" type="email" inputMode="email" autoComplete="email" dir="ltr"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoFocus />
            {msg && <p className="err">{msg}</p>}
            <button className="btn wide" disabled={busy}>{busy ? 'שולח…' : 'שליחת קישור כניסה'}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1>בדקו את המייל</h1>
            <p className="mute">
              שלחנו מייל ל־<bdi dir="ltr">{email.trim()}</bdi>. לחצו על הקישור שבו, או הקלידו כאן את הקוד מהמייל.
            </p>
            <label htmlFor="code">קוד</label>
            <input id="code" className="f code" inputMode="numeric" autoComplete="one-time-code" dir="ltr"
              value={code} onChange={e => setCode(e.target.value)} maxLength={10} placeholder="123456" />
            {msg && <p className="err">{msg}</p>}
            <button className="btn wide" disabled={busy}>{busy ? 'בודק…' : 'כניסה'}</button>
            <div className="row between">
              <button type="button" className="link" onClick={() => send()} disabled={busy}>שליחה מחדש</button>
              <button type="button" className="link" onClick={() => { setSent(false); setCode(''); setMsg(''); }}>מייל אחר</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
