import { dayOff } from './dates';

export interface QuickAdd {
  title: string;
  due?: string; // set only if the text contained a date word
  priority?: 3; // set only if the text ended with "!"
}

const WORDS: Record<string, number> = { 'היום': 0, 'מחר': 1, 'מחרתיים': 2 };
// "!" may touch the word before it; date words must be separate words.
const TAIL = /(?:\s*(!+)|\s+(היום|מחרתיים|מחר))$/;

/** Parses trailing "היום" / "מחר" / "מחרתיים" and "!" off a quick-add line. */
export function parseQuickAdd(input: string, base: Date = new Date()): QuickAdd {
  let title = input.trim();
  const out: QuickAdd = { title };
  let m: RegExpMatchArray | null;
  while ((m = title.match(TAIL)) && m.index! > 0) {
    if (m[1]) out.priority = 3;
    else if (out.due === undefined) out.due = dayOff(WORDS[m[2]], base); // rightmost word wins
    title = title.slice(0, m.index).trim();
  }
  out.title = title;
  return out;
}
