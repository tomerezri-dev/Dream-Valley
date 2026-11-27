// Built-in, offline rules. Fast, private, English-focused. Used on its own in
// offline mode and as a supplement (mostly style) to the other engines.

const MISSPELLINGS = {
  teh: 'the', adn: 'and', taht: 'that', thier: 'their', recieve: 'receive', recieved: 'received',
  beleive: 'believe', belive: 'believe', seperate: 'separate', seperately: 'separately',
  definately: 'definitely', definatly: 'definitely', occured: 'occurred', occuring: 'occurring',
  occurence: 'occurrence', untill: 'until', wich: 'which', whcih: 'which', alot: 'a lot',
  accross: 'across', adress: 'address', arguement: 'argument', begining: 'beginning',
  calender: 'calendar', commited: 'committed', concious: 'conscious', curiousity: 'curiosity',
  embarass: 'embarrass', enviroment: 'environment', existance: 'existence', foward: 'forward',
  goverment: 'government', grammer: 'grammar', happend: 'happened', harrass: 'harass',
  immediatly: 'immediately', independant: 'independent', judgement: 'judgment',
  knowlege: 'knowledge', liason: 'liaison', libary: 'library', lisence: 'license',
  maintainance: 'maintenance', millenium: 'millennium', mispell: 'misspell', neccessary: 'necessary',
  necessery: 'necessary', noticable: 'noticeable', ocasion: 'occasion', occassion: 'occasion',
  persue: 'pursue', posession: 'possession', prefered: 'preferred', publically: 'publicly',
  realy: 'really', reccomend: 'recommend', recomend: 'recommend', refered: 'referred',
  relevent: 'relevant', religous: 'religious', remeber: 'remember', resistence: 'resistance',
  responsability: 'responsibility', rythm: 'rhythm', sieze: 'seize', sucess: 'success',
  succesful: 'successful', successfull: 'successful', supercede: 'supersede', suprise: 'surprise',
  tommorow: 'tomorrow', tomorow: 'tomorrow', tounge: 'tongue', truely: 'truly', twelth: 'twelfth',
  tyranny: null, unforseen: 'unforeseen', unfortunatly: 'unfortunately', wierd: 'weird',
  whereever: 'wherever', writting: 'writing', yeild: 'yield', youre: "you're", dont: "don't",
  doesnt: "doesn't", didnt: "didn't", cant: "can't", wont: "won't", isnt: "isn't", wasnt: "wasn't",
  shouldnt: "shouldn't", couldnt: "couldn't", wouldnt: "wouldn't", im: "I'm", ive: "I've",
  thats: "that's", becuase: 'because', becasue: 'because', freind: 'friend', firends: 'friends',
  acheive: 'achieve', acheived: 'achieved', aparent: 'apparent', basicly: 'basically',
  buisness: 'business', comming: 'coming', completly: 'completely', definetly: 'definitely',
  dissapoint: 'disappoint', excercise: 'exercise', finaly: 'finally', fourty: 'forty',
  gaurd: 'guard', guage: 'gauge', heighth: 'height', hygeine: 'hygiene', ignorence: 'ignorance',
  occurr: 'occur', paralell: 'parallel', peice: 'piece', platfrom: 'platform', recieving: 'receiving',
  shedule: 'schedule', similiar: 'similar', strenght: 'strength', thru: 'through', tho: 'though', skiped: 'skipped', stoped: 'stopped', planed: 'planned',
  droped: 'dropped', alright: null, accomodate: 'accommodate', apparantly: 'apparently', wether: 'whether',
  untill: 'until', tomorow: 'tomorrow', tommorrow: 'tomorrow', allready: 'already', alwasy: 'always',
};
delete MISSPELLINGS.tyranny;
delete MISSPELLINGS.alright;

const PHRASES = [
  // [regex, replacement(s), message, category]
  [/\b(could|should|would|must|might) of\b/gi, (m, v) => `${v} have`, 'Use "have" after modal verbs, not "of".', 'grammar'],
  [/\birregardless\b/gi, 'regardless', '"Irregardless" is nonstandard. Use "regardless".', 'grammar'],
  [/\bfor all intensive purposes\b/gi, 'for all intents and purposes', 'The idiom is "for all intents and purposes".', 'grammar'],
  [/\bin order to\b/gi, 'to', '"In order to" can usually be shortened to "to".', 'style'],
  [/\bdue to the fact that\b/gi, 'because', 'Wordy phrase. Try "because".', 'style'],
  [/\bat this point in time\b/gi, 'now', 'Wordy phrase. Try "now".', 'style'],
  [/\bat the present time\b/gi, 'now', 'Wordy phrase. Try "now".', 'style'],
  [/\bin the event that\b/gi, 'if', 'Wordy phrase. Try "if".', 'style'],
  [/\bin spite of the fact that\b/gi, 'although', 'Wordy phrase. Try "although".', 'style'],
  [/\bhas the ability to\b/gi, 'can', 'Wordy phrase. Try "can".', 'style'],
  [/\bfor the purpose of\b/gi, 'for', 'Wordy phrase. Try "for".', 'style'],
  [/\bwith regard to\b/gi, 'about', 'Wordy phrase. Try "about".', 'style'],
  [/\bin close proximity\b/gi, 'near', 'Wordy phrase. Try "near".', 'style'],
  [/\ba large number of\b/gi, 'many', 'Wordy phrase. Try "many".', 'style'],
  [/\bthe majority of\b/gi, 'most', 'Wordy phrase. Try "most".', 'style'],
  [/\bvery unique\b/gi, 'unique', '"Unique" is absolute; "very" is unnecessary.', 'clarity'],
  [/\bend result\b/gi, 'result', 'Redundant phrase. "Result" is enough.', 'clarity'],
  [/\bfuture plans\b/gi, 'plans', 'Redundant phrase. Plans are about the future.', 'clarity'],
  [/\bpast history\b/gi, 'history', 'Redundant phrase. "History" is enough.', 'clarity'],
  [/\bfree gift\b/gi, 'gift', 'Redundant phrase. Gifts are free.', 'clarity'],
  [/\bclose proximity\b/gi, 'proximity', 'Redundant phrase.', 'clarity'],
  [/\bactually\b/gi, '', '"Actually" is often filler. Consider removing it.', 'style', true],
  [/\bbasically\b/gi, '', '"Basically" is often filler. Consider removing it.', 'style', true],
];

const AN_EXCEPTIONS_A = /^(uni|use|usu|uti|eu|one|once|ewe|ure|uro|ufo|u-)/i; // "a university", "a one-off"
const AN_EXCEPTIONS_AN = /^(hour|honest|honou?r|heir|herb\b|fbi|mba|mri|nba|sql|x-?ray|html|llm|ngo|fyi)/i;

function preserveCase(src, rep) {
  if (!rep) return rep;
  if (src === src.toUpperCase() && src.length > 1) return rep.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
}

function check(text) {
  const issues = [];
  const add = (offset, length, message, category, replacements, rule) =>
    issues.push({ offset, length, message, category, replacements, rule, source: 'offline' });
  let m;

  // Misspellings
  const wordRe = /\b[A-Za-z]+\b/g;
  while ((m = wordRe.exec(text))) {
    const lower = m[0].toLowerCase();
    const fix = MISSPELLINGS[lower];
    if (fix && !(lower === 'im' && m[0] !== 'im')) {
      add(m.index, m[0].length, `Possible spelling mistake: "${m[0]}".`, 'spelling', [preserveCase(m[0], fix)], 'MISSPELLING');
    }
  }

  // Lowercase "i" as a pronoun
  const iRe = /(^|[\s"(])i(?=[\s,.;:!?'’)]|$)/g;
  while ((m = iRe.exec(text))) {
    add(m.index + m[1].length, 1, 'The pronoun "I" is always capitalized.', 'grammar', ['I'], 'LOWERCASE_I');
  }

  // Repeated words: "the the"
  const repRe = /\b([A-Za-z']+)(\s+)\1\b/gi;
  while ((m = repRe.exec(text))) {
    if (/^(had|that|is|very|so|bye|ha|no|yeah|really)$/i.test(m[1])) continue;
    add(m.index, m[0].length, `Repeated word: "${m[1]}".`, 'grammar', [m[1]], 'REPEATED_WORD');
  }

  // a / an
  const aRe = /\b(a|an|A|An)\s+([A-Za-z][\w-]*)/g;
  while ((m = aRe.exec(text))) {
    const art = m[1].toLowerCase();
    const word = m[2];
    const vowel = /^[aeiou]/i.test(word);
    let wantAn = vowel;
    if (vowel && AN_EXCEPTIONS_A.test(word)) wantAn = false;
    if (!vowel && AN_EXCEPTIONS_AN.test(word)) wantAn = true;
    if (word.length === 1) continue; // "a b c" lists, variables
    if (art === 'a' && wantAn) {
      add(m.index, m[1].length, `Use "an" before a vowel sound ("an ${word}").`, 'grammar', [m[1] === 'A' ? 'An' : 'an'], 'A_AN');
    } else if (art === 'an' && !wantAn) {
      add(m.index, m[1].length, `Use "a" before a consonant sound ("a ${word}").`, 'grammar', [m[1] === 'An' ? 'A' : 'a'], 'A_AN');
    }
  }

  // Sentence should start with a capital letter
  const capRe = /([.!?])(\s+)([a-z])/g;
  while ((m = capRe.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 4), m.index + 1);
    if (/\b(e\.g|i\.e|etc|vs|approx|cf)\.$/i.test(before) || /\.\.$/.test(before)) continue;
    if (/\d\.$/.test(before)) continue;
    const at = m.index + 1 + m[2].length;
    add(at, 1, 'Start a sentence with a capital letter.', 'grammar', [m[3].toUpperCase()], 'SENTENCE_CAPITAL');
  }
  const first = text.match(/^\s*([a-z])/);
  if (first && /[a-z]{2,}/.test(text.slice(first.index, first.index + 40)) && !/^\s*[a-z]+:\/\//.test(text)) {
    const at = first[0].length - 1;
    if (/^[a-z]+[\s,.!?]/.test(text.slice(at)) && !/^i[\s,.!?]/.test(text.slice(at))) {
      add(at, 1, 'Start a sentence with a capital letter.', 'grammar', [first[1].toUpperCase()], 'SENTENCE_CAPITAL');
    }
  }

  // Whitespace and punctuation
  const dblRe = /([^\s]) {2,}(?=[^\s])/g;
  while ((m = dblRe.exec(text))) add(m.index + 1, m[0].length - 1, 'Use a single space.', 'punctuation', [' '], 'DOUBLE_SPACE');
  const beforePunct = /(\S)( +)([,.;:!?])(?=\s|$)/g;
  while ((m = beforePunct.exec(text))) {
    if (/[.]/.test(m[3]) && /\.\.\./.test(text.slice(m.index + 1 + m[2].length, m.index + 4 + m[2].length))) continue;
    add(m.index + 1, m[2].length, `Remove the space before "${m[3]}".`, 'punctuation', [''], 'SPACE_BEFORE_PUNCT');
  }
  const afterComma = /([a-z])([,;])([A-Za-z])/g;
  while ((m = afterComma.exec(text))) add(m.index + 1, 1, `Add a space after "${m[2]}".`, 'punctuation', [`${m[2]} `], 'SPACE_AFTER_PUNCT');
  const multiPunct = /([!?]){2,}|,,+/g;
  while ((m = multiPunct.exec(text))) {
    if (/^[!?]+$/.test(m[0]) && new Set(m[0]).size > 1) continue; // "?!" is fine
    add(m.index, m[0].length, 'Repeated punctuation.', 'punctuation', [m[0][0]], 'REPEATED_PUNCT');
  }

  // Phrase-level rules
  for (const [re, rep, message, category, removeOnly] of PHRASES) {
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      let offset = m.index;
      let length = m[0].length;
      let replacement = typeof rep === 'function' ? rep(...m) : preserveCase(m[0], rep);
      if (removeOnly) {
        // Remove the word together with one adjacent space/comma.
        const after = text.slice(offset + length).match(/^,?\s/);
        if (after) length += after[0].length;
        replacement = '';
        if (offset === 0 || /[.!?]\s*$/.test(text.slice(0, offset))) {
          const next = text.slice(offset + length).match(/^[a-z]/);
          if (next) { length += 1; replacement = next[0].toUpperCase(); }
        }
      }
      add(offset, length, message, category, [replacement], 'PHRASE');
    }
  }

  // Very long sentences (clarity hint, no replacement)
  const sentRe = /[^.!?\n]+[.!?]?/g;
  while ((m = sentRe.exec(text))) {
    const words = m[0].trim().split(/\s+/).filter(Boolean).length;
    if (words > 40) {
      const lead = m[0].length - m[0].trimStart().length;
      // Only mark the first word so other issues inside the sentence still show.
      const firstWord = m[0].trim().match(/^\S+/)[0].replace(/[,;:]$/, '');
      add(m.index + lead, firstWord.length, `This sentence is long (${words} words). Consider splitting it.`, 'clarity', [], 'LONG_SENTENCE');
    }
  }

  return issues;
}

module.exports = { check, MISSPELLINGS };
