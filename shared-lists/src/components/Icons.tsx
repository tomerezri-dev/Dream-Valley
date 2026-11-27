import type { ReactNode } from 'react';

export function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  );
}

const Cal = () => (<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);

export const IcToday = () => <Icon><Cal /><circle cx="12" cy="15" r="1.6" fill="currentColor" /></Icon>;
export const IcWeek = () => <Icon><Cal /><path d="M8 15h8" /></Icon>;
export const IcAll = () => <Icon><path d="M4 13l2.5-7.5h11L20 13v5.5H4z" /><path d="M4 13h4.5l1 2h5l1-2H20" /></Icon>;
export const IcDone = () => <Icon><circle cx="12" cy="12" r="8.5" /><path d="M8 12.3l2.7 2.7L16 9.6" /></Icon>;
export const IcSubs = () => <Icon size={14}><path d="M5 12l4 4 10-10" /></Icon>;
export const IcNotes = () => <Icon size={14}><path d="M5 6h14M5 12h14M5 18h9" /></Icon>;

export const IcMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export const IcMore = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);
export const Check = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8.5l3 3 7-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Flag = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 15V2.2m0 0h8.5L10.3 5.4 12 8.6H3.5" fill={color} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="empty">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="40" fill="var(--accs)" />
        <rect x="28" y="26" width="40" height="46" rx="7" fill="var(--card)" stroke="var(--line)" />
        <path d="M36 40l4 4 8-8M36 56h22M36 63h14" stroke="var(--acc)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <b>{title}</b>
      {sub}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ch = (name.trim()[0] || '?').toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="av" style={{ width: size, height: size, fontSize: size * 0.45, background: `hsl(${h} 55% 52%)` }} aria-hidden="true">
      {ch}
    </span>
  );
}
