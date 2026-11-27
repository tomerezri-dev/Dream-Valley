import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Login } from './components/Login';
import { Planner } from './components/Planner';
import { ProfileSetup } from './components/ProfileSetup';
import { configured, sb } from './supabase';
import type { Profile } from './types';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!configured) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="gate"><div className="gate-card">
        <h1>חסרות הגדרות</h1>
        <p className="mute">יש להגדיר את VITE_SUPABASE_URL ואת VITE_SUPABASE_ANON_KEY (ב־Vercel: Settings → Environment Variables) ולפרוס מחדש.</p>
      </div></div>
    );
  }
  if (session === undefined) return <p className="empty">טוען…</p>;
  if (!session) return <Login />;
  return <SignedIn key={session.user.id} me={session.user.id} email={session.user.email ?? ''} />;
}

function SignedIn({ me, email }: { me: string; email: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    sb.from('profiles').select('id,display_name').eq('id', me).maybeSingle().then(({ data, error }) => {
      if (error) setFailed(true);
      else setProfile((data as Profile | null) ?? null);
    });
  }, [me]);

  if (failed) {
    return (
      <div className="gate"><div className="gate-card">
        <h1>אין חיבור</h1>
        <p className="mute">לא הצלחנו לטעון את החשבון. בדקו את החיבור לאינטרנט.</p>
        <button className="btn wide" onClick={() => location.reload()}>נסו שוב</button>
      </div></div>
    );
  }
  if (profile === undefined) return <p className="empty">טוען…</p>;
  if (!profile?.display_name) return <ProfileSetup me={me} onDone={setProfile} />;
  return <Planner me={me} email={email} profile={profile} onProfile={setProfile} />;
}
