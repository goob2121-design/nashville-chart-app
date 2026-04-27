'use client';

import { useEffect, useRef, useState } from 'react';

const MAJOR_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const NOTE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '6/8', 'Cut Time'] as const;
const FEEL_OPTIONS = ['Straight', 'Swing', 'Shuffle', 'Waltz', 'Fast 2', 'Slow Ballad'] as const;
const SECTION_LABELS = [
  'intro',
  'chorus',
  'bridge',
  'break',
  'solo',
  'instrumental',
  'turnaround',
  'tag',
  'ending',
  'outro',
  'a part',
  'b part',
] as const;

type ChartMode = 'simple' | 'strict';
type KeyName = (typeof MAJOR_KEYS)[number];
type TimeSignature = (typeof TIME_SIGNATURES)[number];
type MeasureGridStyle = 'off' | 'simple-bars' | 'beat-dots';

type ChartSnapshot = {
  artist: string;
  capo: string;
  chartMode: ChartMode;
  chordChart: string;
  feel: string;
  key: KeyName;
  nashvilleChart: string;
  notes: string;
  tempo: string;
  timeSignature: TimeSignature;
  title: string;
};

type SavedChart = ChartSnapshot & {
  id: string;
  savedAt: string;
};

const STORAGE_KEY = 'nashville-chart-builder:saved-charts';
const SYMBOL_TOOLBAR_STORAGE_KEY = 'nashville-chart-builder:symbol-toolbar-expanded';

const INPUT_CLASS =
  'w-full rounded-xl border border-amber-950/40 bg-stone-950/70 px-3 py-2.5 text-base text-stone-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';
const PANEL_CLASS =
  'rounded-3xl border border-amber-950/30 bg-stone-900/75 p-5 shadow-xl shadow-black/10 backdrop-blur';
const SUBPANEL_CLASS =
  'space-y-3 rounded-2xl border border-amber-950/25 bg-stone-950/50 p-4';
const SECONDARY_BUTTON_CLASS =
  'rounded-xl border border-amber-900/40 bg-stone-950/40 px-3.5 py-2.5 text-sm font-medium text-stone-100 transition hover:bg-stone-900/80 disabled:opacity-50';
const PRIMARY_BUTTON_CLASS =
  'rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-300';
const EMPHASIS_BUTTON_CLASS =
  'rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-stone-950 transition hover:bg-emerald-300';

const SAMPLE_CHART: ChartSnapshot = {
  artist: 'Demo Artist',
  capo: '0',
  chartMode: 'simple',
  chordChart: `A B C D
A B C D`,
  feel: 'Straight',
  key: 'A',
  nashvilleChart: `1 2 3 4
1 2 3 4`,
  notes: '',
  tempo: '120',
  timeSignature: '4/4',
  title: 'Test Song',
};

const SYMBOL_BUTTONS = [
  { label: '◇', value: '◇' },
  { label: '^', value: '^' },
  { label: '•', value: '•' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '%', value: '%' },
  { label: '|', value: '|' },
  { label: '||', value: '||' },
  { label: '||:', value: '||:' },
  { label: ':||', value: ':||' },
  { label: '[Intro]', value: '[Intro]' },
  { label: '[V1]', value: '[V1]' },
  { label: '[V2]', value: '[V2]' },
  { label: '[V3]', value: '[V3]' },
  { label: '[Ch]', value: '[Ch]' },
  { label: '[Br]', value: '[Br]' },
  { label: '[Verse]', value: '[Verse]' },
  { label: '[Chorus]', value: '[Chorus]' },
  { label: '[Bridge]', value: '[Bridge]' },
  { label: '[Solo]', value: '[Solo]' },
  { label: '[Tag]', value: '[Tag]' },
  { label: '[Outro]', value: '[Outro]' },
  { label: '[Same as Verse 1]', value: '[Same as Verse 1]' },
  { label: '[Same as Verse]', value: '[Same as Verse]' },
  { label: '[Same as Chorus]', value: '[Same as Chorus]' },
  { label: '[Same as Intro]', value: '[Same as Intro]' },
  { label: '[V2 = V1]', value: '[V2 = V1]' },
  { label: '[V3 = V1]', value: '[V3 = V1]' },
  { label: '[Ch2 = Ch1]', value: '[Ch2 = Ch1]' },
  { label: '[Solo = Verse]', value: '[Solo = Verse]' },
  { label: '[Break = Chorus]', value: '[Break = Chorus]' },
  { label: '[Outro = Intro]', value: '[Outro = Intro]' },
  { label: '[Last Line Chorus]', value: '[Last Line Chorus]' },
  { label: '[Last 2 Lines Chorus]', value: '[Last 2 Lines Chorus]' },
  { label: '[Verse Chords]', value: '[Verse Chords]' },
  { label: '[Chorus Chords]', value: '[Chorus Chords]' },
  { label: '[Kick on 5]', value: '[Kick on 5]' },
  { label: '[Stop on 1]', value: '[Stop on 1]' },
  { label: '[Build]', value: '[Build]' },
  { label: '[Half-time]', value: '[Half-time]' },
  { label: '[Walk Up]', value: '[Walk Up]' },
  { label: '[N.C.]', value: '[N.C.]' },
  { label: '[Cold End]', value: '[Cold End]' },
  { label: '[Fade]', value: '[Fade]' },
  { label: '[x2]', value: '[x2]' },
  { label: '[x3]', value: '[x3]' },
  { label: '[Tag Last Line Chorus]', value: '[Tag Last Line Chorus]' },
  { label: '[Tag Last Line Chorus x2]', value: '[Tag Last Line Chorus x2]' },
  { label: '[Outro = Chorus Tag]', value: '[Outro = Chorus Tag]' },
  { label: '[Hold Last 1]', value: '[Hold Last 1]' },
  { label: '[Run Out]', value: '[Run Out]' },
  { label: '[Repeat to End]', value: '[Repeat to End]' },
  { label: '[Repeat Last Line]', value: 'Repeat last line' },
  { label: '[Turnaround]', value: '[Turnaround]' },
  { label: '[Break]', value: '[Break]' },
  { label: '[Ending]', value: '[Ending]' },
  { label: '[A Part]', value: '[A Part]' },
  { label: '[B Part]', value: '[B Part]' },
  { label: '[Banjo Kickoff]', value: '[Banjo Kickoff]' },
  { label: '[Fiddle Kickoff]', value: '[Fiddle Kickoff]' },
  { label: '[Dobro Solo]', value: '[Dobro Solo]' },
  { label: '[Mando Chop In]', value: '[Mando Chop In]' },
  { label: '[Harmony In]', value: '[Harmony In]' },
  { label: '[Tag Last Line x2]', value: '[Tag Last Line x2]' },
  { label: '𝄐', value: '𝄐' },
  { label: '⏹', value: '⏹' },
  { label: '( )', value: '( )' },
  { label: '/', value: '/' },
  { label: '-', value: '-' },
] as const;

const TEMPLATE_PRESETS: Record<string, string> = {
  'Standard Song': `[Verse]

[Chorus]

[Bridge]

[Tag]`,
  'Bluegrass Gospel': `[Intro]

[Verse]

[Chorus]

[Verse]

[Chorus]

[Tag]`,
  'Fiddle Tune': `[A Part]

[A Part]

[B Part]

[B Part]`,
  'Fast Jam': `[Intro]

[Verse]

[Solo]

[Chorus]

[Turnaround]`,
};

const SMART_REFERENCE_PATTERNS = [
  {
    pattern: /^same as verse(?:\s+(\d+))?$/i,
    format: (match: RegExpMatchArray) => `[Same as Verse${match[1] ? ` ${match[1]}` : ''}]`,
  },
  { pattern: /^same as chorus$/i, format: () => '[Same as Chorus]' },
  { pattern: /^same as intro$/i, format: () => '[Same as Intro]' },
  { pattern: /^repeat chorus$/i, format: () => '[Same as Chorus]' },
  { pattern: /^tag last line chorus$/i, format: () => '[Last Line Chorus]' },
  { pattern: /^solo over verse$/i, format: () => '[Verse Chords]' },
  { pattern: /^solo over chorus$/i, format: () => '[Chorus Chords]' },
  { pattern: /^repeat rocky top tennessee$/i, format: () => '[Tag Last Line Chorus x2]' },
  { pattern: /^hold tennessee$/i, format: () => '[Tag Last Line Chorus x2]' },
  { pattern: /^extended ending$/i, format: () => '[Tag Last Line Chorus x2]' },
  { pattern: /^tag ending$/i, format: () => '[Tag Last Line Chorus x2]' },
] as const;

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  'E#': 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const SEMITONE_TO_NUMBER = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

const CHROMATIC_SPELLINGS: Record<KeyName, string[]> = {
  C: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  D: ['D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'C', 'C#'],
  E: ['E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B', 'C', 'C#', 'D', 'D#'],
  F: ['F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E'],
  G: ['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#'],
  A: ['A', 'Bb', 'B', 'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#'],
  B: ['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#'],
};

const NUMBER_TO_OFFSET: Record<string, number> = {
  '1': 0,
  b2: 1,
  '2': 2,
  b3: 3,
  '3': 4,
  '4': 5,
  b5: 6,
  '5': 7,
  b6: 8,
  '6': 9,
  b7: 10,
  '7': 11,
};

function normalizeChartInput(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      if (!line.trim()) {
        return '';
      }

      return line.replace(/\s+/g, ' ').trim();
    })
    .join('\n');
}

function formatSuffix(suffix: string) {
  if (!suffix) {
    return '';
  }

  if (/^\d/.test(suffix)) {
    return `(${suffix})`;
  }

  return suffix;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSectionHeading(line: string) {
  const cleaned = line.trim().replace(/[:\-\s]+$/, '');
  const lower = cleaned.toLowerCase();

  if (/^verse(?:\s+\d+)?$/.test(lower)) {
    return `[${titleCase(cleaned)}]`;
  }

  if (SECTION_LABELS.includes(lower as (typeof SECTION_LABELS)[number])) {
    return `[${titleCase(cleaned)}]`;
  }

  return null;
}

function formatSmartReference(line: string) {
  const cleaned = line.trim().replace(/[:\-\s]+$/, '');

  for (const rule of SMART_REFERENCE_PATTERNS) {
    const match = cleaned.match(rule.pattern);

    if (match) {
      return rule.format(match);
    }
  }

  return null;
}

function tokenizeCompactMeasureToken(token: string) {
  if (!token) {
    return null;
  }

  const parts: string[] = [];
  let index = 0;

  while (index < token.length) {
    const current = token[index];

    if (current === '.') {
      parts.push('.');
      index += 1;
      continue;
    }

    if (/[1-7]/.test(current)) {
      parts.push(current);
      index += 1;
      continue;
    }

    if (/[A-G]/.test(current)) {
      let chord = current;
      index += 1;

      if (token[index] === '#' || token[index] === 'b') {
        chord += token[index];
        index += 1;
      }

      while (index < token.length) {
        const next = token[index];

        if (next === '.') {
          break;
        }

        if (next === '/' && /[A-G]/.test(token[index + 1] ?? '')) {
          chord += next;
          index += 1;
          chord += token[index];
          index += 1;

          if (token[index] === '#' || token[index] === 'b') {
            chord += token[index];
            index += 1;
          }

          continue;
        }

        if (/[A-G]/.test(next)) {
          break;
        }

        if (!/[a-z0-9()+-]/i.test(next)) {
          return null;
        }

        chord += next;
        index += 1;
      }

      parts.push(chord);
      continue;
    }

    return null;
  }

  return parts;
}

function isBeatShorthandToken(token: string) {
  const parts = tokenizeCompactMeasureToken(token);

  if (!parts) {
    return false;
  }

  return token.includes('.') || /^[1-7]{4}$/.test(token);
}

function isSectionLabel(line: string) {
  return /^\[.+\]$/.test(line.trim());
}

function isSingleMeasureToken(token: string) {
  return /^[1-7]$/.test(token) || /^([A-G](?:#|b)?)(?:m|min|maj|maj7|7|m7|sus|sus2|sus4|add9|dim|aug|6|9|11|13)?(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?$/.test(
    token
  );
}

function expandMeasureToken(token: string) {
  if (isBeatShorthandToken(token)) {
    return token;
  }

  if (isSingleMeasureToken(token)) {
    return `${token}...`;
  }

  return token;
}

function addMeasureGridToText(text: string, style: MeasureGridStyle) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || isSectionLabel(trimmed) || trimmed.includes('|')) {
        return line;
      }

      const measures = trimmed
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => (style === 'beat-dots' ? expandMeasureToken(token) : token));

      return measures.length > 0 ? `| ${measures.join(' | ')} |` : line;
    })
    .join('\n');
}

function removeMeasureGridFromText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || isSectionLabel(trimmed)) {
        return line;
      }

      return line
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    })
    .join('\n');
}

function isChordLikeToken(token: string) {
  const cleaned = token.trim().replace(/^[([{"]+|[)\]}".,;:!?]+$/g, '');

  if (!cleaned) {
    return false;
  }

  if (isBeatShorthandToken(cleaned)) {
    return true;
  }

  if (
    cleaned === '|' ||
    cleaned === '||' ||
    cleaned === '||:' ||
    cleaned === ':||' ||
    cleaned === '%' ||
    cleaned === '◇' ||
    cleaned === '^' ||
    cleaned === '•' ||
    cleaned === '>' ||
    cleaned === '<' ||
    cleaned === '-' ||
    cleaned === '/'
  ) {
    return true;
  }

  return /^([A-G](?:#|b)?)(?:m|min|maj|maj7|7|m7|sus|sus2|sus4|add9|dim|aug|6|9|11|13)?(?:\([^)]+\))?(?:\/[A-G](?:#|b)?)?$/.test(
    cleaned
  );
}

function isMostlyChordLine(line: string) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  const chordLikeCount = tokens.filter(isChordLikeToken).length;
  return chordLikeCount / tokens.length >= 0.6;
}

function extractChordChartFromSheet(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const extracted: string[] = [];
  let chordLinesFound = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (extracted.length > 0 && extracted.at(-1) !== '') {
        extracted.push('');
      }
      continue;
    }

    const heading = formatSectionHeading(line);

    if (heading) {
      if (extracted.length > 0 && extracted.at(-1) !== '') {
        extracted.push('');
      }
      extracted.push(heading);
      continue;
    }

    const reference = formatSmartReference(line);

    if (reference) {
      if (extracted.length > 0 && extracted.at(-1) !== '') {
        extracted.push('');
      }
      extracted.push(reference);
      continue;
    }

    if (isMostlyChordLine(line)) {
      extracted.push(line.replace(/\s+/g, ' '));
      chordLinesFound += 1;
    }
  }

  while (extracted[0] === '') {
    extracted.shift();
  }

  while (extracted.at(-1) === '') {
    extracted.pop();
  }

  return {
    chordLinesFound,
    extracted: extracted.join('\n'),
  };
}

function convertStrictRoot(root: string, key: KeyName) {
  const noteValue = NOTE_TO_SEMITONE[root];
  const keyValue = NOTE_TO_SEMITONE[key];

  if (noteValue === undefined || keyValue === undefined) {
    return null;
  }

  return SEMITONE_TO_NUMBER[(noteValue - keyValue + 12) % 12];
}

function convertSimpleRoot(root: string, key: KeyName) {
  const rootLetter = root[0] as (typeof NOTE_LETTERS)[number];
  const keyIndex = NOTE_LETTERS.indexOf(key);
  const rootIndex = NOTE_LETTERS.indexOf(rootLetter);

  if (keyIndex === -1 || rootIndex === -1) {
    return null;
  }

  return String(((rootIndex - keyIndex + NOTE_LETTERS.length) % NOTE_LETTERS.length) + 1);
}

function convertRoot(root: string, key: KeyName, chartMode: ChartMode) {
  return chartMode === 'simple' ? convertSimpleRoot(root, key) : convertStrictRoot(root, key);
}

function convertChordToken(chord: string, key: KeyName, chartMode: ChartMode) {
  if (chord === '|') {
    return chord;
  }

  if (isBeatShorthandToken(chord)) {
    const parts = tokenizeCompactMeasureToken(chord);

    if (!parts) {
      return chord;
    }

    return parts
      .map((part) => {
        if (part === '.' || /^[1-7]$/.test(part)) {
          return part;
        }

        const convertedPart = convertChordToken(part, key, chartMode);
        return convertedPart;
      })
      .join('');
  }

  const match = chord.match(/^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/);

  if (!match) {
    return chord;
  }

  const [, root, suffix, bassRoot] = match;
  const convertedRoot = convertRoot(root, key, chartMode);

  if (!convertedRoot) {
    return chord;
  }

  const convertedBass = bassRoot ? convertRoot(bassRoot, key, chartMode) : null;
  return `${convertedRoot}${formatSuffix(suffix)}${bassRoot ? `/${convertedBass ?? bassRoot}` : ''}`;
}

function convertLine(line: string, key: KeyName, chartMode: ChartMode) {
  return line
    .split(/(\s+)/)
    .map((token) => (token.trim() ? convertChordToken(token, key, chartMode) : token))
    .join('');
}

function buildConvertedChart(input: string, key: KeyName, chartMode: ChartMode) {
  if (!input.trim()) {
    return '';
  }

  return normalizeChartInput(input)
    .split('\n')
    .map((line) => convertLine(line, key, chartMode))
    .join('\n');
}

function rootFromStrictNumber(number: string, key: KeyName) {
  const offset = NUMBER_TO_OFFSET[number];
  return offset === undefined ? null : CHROMATIC_SPELLINGS[key][offset];
}

function rootFromSimpleNumber(number: string, key: KeyName) {
  const degree = Number.parseInt(number, 10);
  const keyIndex = NOTE_LETTERS.indexOf(key);

  if (!Number.isInteger(degree) || degree < 1 || degree > 7 || keyIndex === -1) {
    return null;
  }

  return NOTE_LETTERS[(keyIndex + degree - 1) % NOTE_LETTERS.length];
}

function rootFromNumber(number: string, key: KeyName, chartMode: ChartMode) {
  return chartMode === 'simple' ? rootFromSimpleNumber(number, key) : rootFromStrictNumber(number, key);
}

function transposeChordToken(token: string, fromKey: KeyName, toKey: KeyName, chartMode: ChartMode) {
  if (token === '|') {
    return token;
  }

  if (isBeatShorthandToken(token)) {
    const parts = tokenizeCompactMeasureToken(token);

    if (!parts) {
      return token;
    }

    return parts
      .map((part) => {
        if (part === '.' || /^[1-7]$/.test(part)) {
          return part;
        }

        return transposeChordToken(part, fromKey, toKey, chartMode);
      })
      .join('');
  }

  const match = token.match(/^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/);

  if (!match) {
    return token;
  }

  const [, root, suffix, bassRoot] = match;
  const numberRoot = convertRoot(root, fromKey, chartMode);

  if (!numberRoot) {
    return token;
  }

  const nextRoot = rootFromNumber(numberRoot, toKey, chartMode);
  const nextBass = bassRoot
    ? rootFromNumber(convertRoot(bassRoot, fromKey, chartMode) ?? '', toKey, chartMode)
    : null;

  return nextRoot ? `${nextRoot}${suffix}${bassRoot ? `/${nextBass ?? bassRoot}` : ''}` : token;
}

function transposeChartText(input: string, fromKey: KeyName, toKey: KeyName, chartMode: ChartMode) {
  return normalizeChartInput(input)
    .split('\n')
    .map((line) =>
      line
        .split(/(\s+)/)
        .map((token) => (token.trim() ? transposeChordToken(token, fromKey, toKey, chartMode) : token))
        .join('')
    )
    .join('\n');
}

function serializeChart(chart: ChartSnapshot) {
  return encodeURIComponent(JSON.stringify(chart));
}

function deserializeChart(value: string) {
  try {
    return JSON.parse(decodeURIComponent(value)) as ChartSnapshot;
  } catch {
    return null;
  }
}

function getPlayInKey(concertKey: KeyName, capo: string) {
  const capoValue = Number.parseInt(capo, 10);

  if (Number.isNaN(capoValue) || capoValue <= 0) {
    return concertKey;
  }

  const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const concertSemitone = NOTE_TO_SEMITONE[concertKey];
  return names[(concertSemitone - (capoValue % 12) + 12) % 12];
}

function createSectionSeparator(line: string) {
  const bracketMatch = line.match(/^\[(.+)\]$/);
  return bracketMatch ? `--- ${bracketMatch[1]} ---` : line;
}

function isReferenceTag(line: string) {
  return /^\[(?:Same as .+|V2 = V1|V3 = V1|Ch2 = Ch1|Solo = Verse|Break = Chorus|Outro = Intro|Outro = Chorus Tag|Last Line Chorus|Last 2 Lines Chorus|Verse Chords|Chorus Chords|Kick on 5|Stop on 1|Build|Half-time|Walk Up|N\.C\.|Cold End|Fade|Hold Last 1|Run Out|Repeat to End|x2|x3|Banjo Kickoff|Fiddle Kickoff|Dobro Solo|Mando Chop In|Harmony In|Tag Last Line x2|Tag Last Line Chorus|Tag Last Line Chorus x2)\]$/i.test(
    line.trim()
  );
}

function buildSnapshot(values: {
  artist: string;
  capo: string;
  chartMode: ChartMode;
  chordChart: string;
  feel: string;
  key: KeyName;
  nashvilleChart: string;
  notes: string;
  tempo: string;
  timeSignature: TimeSignature;
  title: string;
}): ChartSnapshot {
  return {
    artist: values.artist,
    capo: values.capo,
    chartMode: values.chartMode,
    chordChart: values.chordChart,
    feel: values.feel,
    key: values.key,
    nashvilleChart: values.nashvilleChart,
    notes: values.notes,
    tempo: values.tempo,
    timeSignature: values.timeSignature,
    title: values.title,
  };
}

function ChartLines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, index) => {
        const isSection = /^\[.+\]$/.test(line);
        const isReference = isReferenceTag(line);
        const displayLine = isSection ? createSectionSeparator(line) : line;
        const className = isSection ? (isReference ? 'font-bold italic tracking-wide' : 'font-bold tracking-wide') : '';

        return (
          <div key={`${line}-${index}`} className={className}>
            {displayLine || '\u00A0'}
          </div>
        );
      })}
    </>
  );
}

function ShareView({
  chart,
  onExit,
  onPerformanceMode,
}: {
  chart: ChartSnapshot;
  onExit: () => void;
  onPerformanceMode: () => void;
}) {
  const readOnlyChart = chart.nashvilleChart.trim()
    ? chart.nashvilleChart
    : chart.chordChart.trim()
      ? chart.chordChart
      : 'No chart entered.';

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-chart-text {
            white-space: pre-wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 16pt;
            line-height: 1.3;
          }
        }
      `}</style>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Share View</p>
            <h1 className="text-2xl font-semibold text-white">{chart.title || 'Untitled Song'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              onClick={() => window.print()}
            >
              Print
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              onClick={onPerformanceMode}
            >
              Performance Mode
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
              onClick={onExit}
            >
              Open Editor
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-black/70 p-6 shadow-xl shadow-black/20 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
          <div className="space-y-3 border-b border-zinc-800 pb-4 print:hidden print:border-zinc-300">
            <h2 className="text-3xl font-semibold text-white print:text-black">
              {chart.title || 'Untitled Song'}
            </h2>
            <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-2 lg:grid-cols-4 print:text-black">
              <p><span className="font-medium text-zinc-100 print:text-black">Artist:</span> {chart.artist || 'N/A'}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Concert Key:</span> {chart.key}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Time:</span> {chart.timeSignature}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Style:</span> {chart.chartMode === 'simple' ? 'Simple Bluegrass Mode' : 'Strict Nashville Mode'}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Tempo:</span> {chart.tempo || 'N/A'}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Capo:</span> {chart.capo || '0'}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Play In:</span> {getPlayInKey(chart.key, chart.capo)}</p>
              <p><span className="font-medium text-zinc-100 print:text-black">Feel:</span> {chart.feel || 'N/A'}</p>
            </div>
          </div>

          <div className="print-only border-b border-zinc-300 pb-2 text-black">
            <h2 className="text-xl font-semibold">{chart.title || 'Untitled Song'}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5">
              {chart.artist.trim() ? <p><span className="font-semibold">Artist:</span> {chart.artist}</p> : null}
              <p><span className="font-semibold">Key:</span> {chart.key}</p>
              {chart.timeSignature.trim() ? <p><span className="font-semibold">Time:</span> {chart.timeSignature}</p> : null}
              {chart.tempo.trim() ? <p><span className="font-semibold">Tempo:</span> {chart.tempo}</p> : null}
              {chart.capo.trim() ? <p><span className="font-semibold">Capo:</span> {chart.capo}</p> : null}
            </div>
          </div>

          {chart.notes.trim() ? (
            <section className="mt-5 space-y-2 print:mt-2">
              <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400 print:text-black">Notes</h3>
              <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-200 print:leading-5 print:text-black">{chart.notes}</p>
            </section>
          ) : null}

          {chart.chordChart.trim() ? (
            <section className="mt-5 space-y-2 print:hidden print:mt-4">
              <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400 print:text-black">Chord Chart</h3>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-4 font-mono text-base leading-7 text-zinc-100 print:border-0 print:bg-white print:px-0 print:py-0 print:text-black">{chart.chordChart}</pre>
            </section>
          ) : null}

          <section className="mt-5 space-y-2 print:mt-2">
            <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400 print:hidden print:text-black">Nashville Chart</h3>
            <div className="print-chart-text overflow-x-auto whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-4 font-mono text-lg leading-8 text-emerald-300 print:border-0 print:bg-white print:px-0 print:py-0 print:text-black">
              <ChartLines text={readOnlyChart} />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const [songTitle, setSongTitle] = useState(SAMPLE_CHART.title);
  const [artist, setArtist] = useState(SAMPLE_CHART.artist);
  const [selectedKey, setSelectedKey] = useState<KeyName>(SAMPLE_CHART.key);
  const [transposeToKey, setTransposeToKey] = useState<KeyName>(SAMPLE_CHART.key);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>(SAMPLE_CHART.timeSignature);
  const [tempo, setTempo] = useState(SAMPLE_CHART.tempo);
  const [capo, setCapo] = useState(SAMPLE_CHART.capo);
  const [feel, setFeel] = useState(SAMPLE_CHART.feel);
  const [notes, setNotes] = useState(SAMPLE_CHART.notes);
  const [chartMode, setChartMode] = useState<ChartMode>(SAMPLE_CHART.chartMode);
  const [input, setInput] = useState(SAMPLE_CHART.chordChart);
  const [output, setOutput] = useState(SAMPLE_CHART.nashvilleChart);
  const [copyLabel, setCopyLabel] = useState('Copy Chart');
  const [shareLabel, setShareLabel] = useState('Share View');
  const [shareUrl, setShareUrl] = useState('');
  const [hasMounted, setHasMounted] = useState(false);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [selectedSavedChartId, setSelectedSavedChartId] = useState('');
  const [smartPasteMessage, setSmartPasteMessage] = useState('');
  const [isShareView, setIsShareView] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [symbolsExpanded, setSymbolsExpanded] = useState(false);
  const [measureGridStyle, setMeasureGridStyle] = useState<MeasureGridStyle>('off');

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      setHasMounted(true);

      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const storedToolbarPreference = window.localStorage.getItem(SYMBOL_TOOLBAR_STORAGE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved) as SavedChart[];
          setSavedCharts(parsed);
          setSelectedSavedChartId(parsed[0]?.id ?? '');
        }

        if (storedToolbarPreference === 'true' || storedToolbarPreference === 'false') {
          setSymbolsExpanded(storedToolbarPreference === 'true');
        } else {
          setSymbolsExpanded(false);
        }
      } catch {
        setSavedCharts([]);
        setSelectedSavedChartId('');
        setSymbolsExpanded(false);
      }

      const params = new URLSearchParams(window.location.search);
      const sharedChart = params.get('chart');

      if (!sharedChart) {
        return;
      }

      const decoded = deserializeChart(sharedChart);

      if (!decoded) {
        return;
      }

      applySnapshot(decoded);
      setIsShareView(true);
    }, 0);

    return () => window.clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    const textarea = outputRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [output]);

  const normalizedInput = normalizeChartInput(input);
  const convertedChart = buildConvertedChart(normalizedInput, selectedKey, chartMode);
  const activeNashvilleChart = output.trim() ? output : convertedChart.trim() ? convertedChart : '';
  const printChartText = activeNashvilleChart || 'No chart entered.';
  const playInKey = getPlayInKey(selectedKey, capo);

  function currentSnapshot() {
    return buildSnapshot({
      artist,
      capo,
      chartMode,
      chordChart: normalizedInput,
      feel,
      key: selectedKey,
      nashvilleChart: activeNashvilleChart,
      notes,
      tempo,
      timeSignature,
      title: songTitle,
    });
  }

  function applySnapshot(chart: ChartSnapshot) {
    setSongTitle(chart.title);
    setArtist(chart.artist);
    setSelectedKey(chart.key);
    setTransposeToKey(chart.key);
    setTimeSignature(chart.timeSignature);
    setTempo(chart.tempo);
    setCapo(chart.capo);
    setFeel(chart.feel);
    setNotes(chart.notes);
    setChartMode(chart.chartMode);
    setInput(chart.chordChart);
    setOutput(chart.nashvilleChart);
  }

  function persistSavedCharts(nextCharts: SavedChart[]) {
    setSavedCharts(nextCharts);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCharts));
  }

  function handleToggleSymbols() {
    setSymbolsExpanded((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(SYMBOL_TOOLBAR_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  function handleCleanUpInput() {
    setInput(normalizedInput);
  }

  function handleSmartPaste() {
    const { chordLinesFound, extracted } = extractChordChartFromSheet(input);

    if (chordLinesFound === 0) {
      setSmartPasteMessage('No chord lines were detected. Paste a lyric/chord sheet with chord symbols and try again.');
      return;
    }

    setInput(extracted);
    setSmartPasteMessage(`Extracted ${chordLinesFound} chord line${chordLinesFound === 1 ? '' : 's'} from the pasted sheet.`);
  }

  function handleConvert() {
    setInput(normalizedInput);
    setOutput(buildConvertedChart(normalizedInput, selectedKey, chartMode));
  }

  function handleTransposeChart() {
    const transposedInput = transposeChartText(normalizedInput, selectedKey, transposeToKey, chartMode);
    setInput(transposedInput);
    setOutput(output.trim() ? output : buildConvertedChart(transposedInput, transposeToKey, chartMode));
    setSelectedKey(transposeToKey);
  }

  function handleAddInputMeasureGrid() {
    if (measureGridStyle === 'off') {
      setInput(removeMeasureGridFromText(input));
      return;
    }

    setInput(addMeasureGridToText(input, measureGridStyle));
  }

  function handleRemoveInputMeasureGrid() {
    setInput(removeMeasureGridFromText(input));
  }

  function handleAddOutputMeasureGrid() {
    if (measureGridStyle === 'off') {
      setOutput(removeMeasureGridFromText(output || printChartText));
      return;
    }

    setOutput(addMeasureGridToText(output || printChartText, measureGridStyle));
  }

  function handleRemoveOutputMeasureGrid() {
    setOutput(removeMeasureGridFromText(output || printChartText));
  }

  async function handleCopyChart() {
    const text = [
      songTitle || 'Untitled Song',
      artist ? `Artist: ${artist}` : '',
      `Concert Key: ${selectedKey}`,
      `Capo: ${capo || '0'}`,
      `Play In: ${playInKey}`,
      `Time Signature: ${timeSignature}`,
      `Tempo: ${tempo || 'N/A'}`,
      `Feel: ${feel || 'N/A'}`,
      `Chart Style: ${chartMode === 'simple' ? 'Simple Bluegrass Mode' : 'Strict Nashville Mode'}`,
      notes ? `Notes: ${notes}` : '',
      '',
      printChartText,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy Chart'), 1600);
    } catch {
      setCopyLabel('Copy Failed');
      window.setTimeout(() => setCopyLabel('Copy Chart'), 1600);
    }
  }

  async function handleShareView() {
    const url = `${window.location.origin}${window.location.pathname}?chart=${serializeChart(currentSnapshot())}`;
    setShareUrl(url);

    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('Link Copied');
      window.setTimeout(() => setShareLabel('Share View'), 1600);
    } catch {
      setShareLabel('Share Link Ready');
      window.setTimeout(() => setShareLabel('Share View'), 1600);
    }
  }

  function handleSaveChart() {
    const snapshot = currentSnapshot();
    const id = snapshot.title.trim() || `Untitled ${new Date().toLocaleString()}`;
    const exists = savedCharts.some((chart) => chart.id === id);

    if (exists && !window.confirm(`Overwrite saved chart "${id}"?`)) {
      return;
    }

    const nextCharts = [
      { ...snapshot, id, savedAt: new Date().toISOString() },
      ...savedCharts.filter((chart) => chart.id !== id),
    ];

    persistSavedCharts(nextCharts);
    setSelectedSavedChartId(id);
  }

  function handleLoadChart() {
    const chart = savedCharts.find((item) => item.id === selectedSavedChartId);
    if (chart) {
      applySnapshot(chart);
    }
  }

  function handleDeleteChart() {
    const chart = savedCharts.find((item) => item.id === selectedSavedChartId);

    if (!chart || !window.confirm(`Delete saved chart "${chart.id}"?`)) {
      return;
    }

    const nextCharts = savedCharts.filter((item) => item.id !== chart.id);
    persistSavedCharts(nextCharts);
    setSelectedSavedChartId(nextCharts[0]?.id ?? '');
  }

  function handleInsertSymbol(symbol: string) {
    const textarea = outputRef.current;

    if (!textarea) {
      setOutput((current) => `${current}${symbol}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextOutput = output.slice(0, start) + symbol + output.slice(end);
    const nextCaret = symbol === '( )' ? start + 1 : start + symbol.length;

    setOutput(nextOutput);

    window.requestAnimationFrame(() => {
      const nextTextarea = outputRef.current;
      if (!nextTextarea) {
        return;
      }
      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleInsertTemplate(name: string) {
    const template = TEMPLATE_PRESETS[name];

    if (!template) {
      return;
    }

    if (!input.trim()) {
      setInput(template);
      return;
    }

    const replace = window.confirm(`Replace the current chord chart with the "${name}" template? Click Cancel to append it instead.`);
    setInput(replace ? template : `${normalizeChartInput(input)}\n\n${template}`);
  }

  function handleExitShareView() {
    window.location.href = window.location.pathname;
  }

  const performanceOverlay = performanceMode ? (
    <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-black px-4 py-6 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Performance Mode</p>
            <h1 className="text-3xl font-semibold">{songTitle || 'Untitled Song'}</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {artist || 'N/A'} • Concert {selectedKey} • Play {playInKey} • {timeSignature}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
            onClick={() => setPerformanceMode(false)}
          >
            Exit
          </button>
        </div>

        <pre className="whitespace-pre-wrap font-mono text-3xl leading-[1.7] text-emerald-300 sm:text-4xl">
          {printChartText}
        </pre>
      </div>
    </div>
  ) : null;

  if (isShareView) {
    return (
      <>
        {performanceOverlay}
        <ShareView chart={currentSnapshot()} onExit={handleExitShareView} onPerformanceMode={() => setPerformanceMode(true)} />
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @media print {
          .no-print,
          button,
          input,
          select,
          textarea {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .print-chart-text {
            white-space: pre-wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 16pt;
            line-height: 1.45;
          }
        }
      `}</style>

      {performanceOverlay}

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-8 text-stone-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 print:max-w-none print:gap-4">
          <div className="no-print space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-300/80">Nashville Number System</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Chart Builder</h1>
            <p className="max-w-3xl text-sm text-stone-300">
              Build bluegrass-friendly chord charts, paste lyric sheets, save them locally, and print a clean Nashville sheet.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr] print:grid-cols-1">
            <section className={`no-print space-y-5 ${PANEL_CLASS}`}>
              <section className={SUBPANEL_CLASS}>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Song Info</h2>
                  <p className="mt-1 text-xs text-stone-400">Core song details, key, feel, and capo reference.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Song Title
                  <input className={INPUT_CLASS} value={songTitle} onChange={(event) => setSongTitle(event.target.value)} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Artist
                  <input className={INPUT_CLASS} value={artist} onChange={(event) => setArtist(event.target.value)} />
                </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Concert Key
                  <select className={INPUT_CLASS} value={selectedKey} onChange={(event) => setSelectedKey(event.target.value as KeyName)}>
                    {MAJOR_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Transpose To Key
                  <select className={INPUT_CLASS} value={transposeToKey} onChange={(event) => setTransposeToKey(event.target.value as KeyName)}>
                    {MAJOR_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Time Signature
                  <select className={INPUT_CLASS} value={timeSignature} onChange={(event) => setTimeSignature(event.target.value as TimeSignature)}>
                    {TIME_SIGNATURES.map((signature) => <option key={signature} value={signature}>{signature}</option>)}
                  </select>
                </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Tempo
                  <input className={INPUT_CLASS} placeholder="120 BPM" value={tempo} onChange={(event) => setTempo(event.target.value)} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Capo
                  <input className={INPUT_CLASS} inputMode="numeric" placeholder="0" value={capo} onChange={(event) => setCapo(event.target.value.replace(/[^\d]/g, ''))} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Feel
                  <select className={INPUT_CLASS} value={feel} onChange={(event) => setFeel(event.target.value)}>
                    {FEEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <div className="rounded-2xl border border-amber-950/25 bg-amber-500/10 p-4 text-sm text-stone-200">
                  <p><span className="font-medium text-amber-100">Concert Key:</span> {selectedKey}</p>
                  <p><span className="font-medium text-amber-100">Capo:</span> {capo || '0'}</p>
                  <p><span className="font-medium text-amber-100">Play In:</span> {playInKey}</p>
                </div>
                </div>
              </section>

              <section className={SUBPANEL_CLASS}>
                <h2 className="text-sm font-medium text-zinc-200">Chart Style</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-200">
                    <input type="radio" name="chart-mode" value="simple" checked={chartMode === 'simple'} onChange={() => setChartMode('simple')} className="mt-1" />
                    <span>Simple Bluegrass Mode</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-700 px-4 py-3 text-sm text-zinc-200">
                    <input type="radio" name="chart-mode" value="strict" checked={chartMode === 'strict'} onChange={() => setChartMode('strict')} className="mt-1" />
                    <span>Strict Nashville Mode</span>
                  </label>
                </div>
                <p className="text-sm leading-6 text-zinc-400">
                  Simple mode is designed for quick band charts when players type chords by letter names. Strict mode follows chromatic Nashville theory.
                </p>
              </section>

              <section className={SUBPANEL_CLASS}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-medium text-zinc-200">Template Presets</h2>
                  <p className="text-xs text-zinc-400">Replace or append common bluegrass forms.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(TEMPLATE_PRESETS).map((name) => (
                    <button key={name} type="button" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800" onClick={() => handleInsertTemplate(name)}>
                      {name}
                    </button>
                  ))}
                </div>
              </section>

              <section className={SUBPANEL_CLASS}>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Chart Input</h2>
                  <p className="mt-1 text-xs text-stone-400">Paste a chord sheet, clean it up, and prepare it for conversion.</p>
                </div>
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Notes
                  <textarea className={`${INPUT_CLASS} min-h-24 text-sm leading-6`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Arrangement notes, solos, endings, or reminders for the band." />
                </label>

              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-medium text-zinc-200">Chord Chart</h2>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                      Measure Grid Style
                      <select className="rounded-lg border border-amber-950/40 bg-stone-950/70 px-3 py-2 text-sm normal-case tracking-normal text-stone-100 outline-none transition focus:border-amber-500" value={measureGridStyle} onChange={(event) => setMeasureGridStyle(event.target.value as MeasureGridStyle)}>
                        <option value="off">Off</option>
                        <option value="simple-bars">Simple Bars</option>
                        <option value="beat-dots">Beat Dots</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleSmartPaste}>
                      Smart Paste / Extract Chords
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleCleanUpInput}>
                      Clean Up Input
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleAddInputMeasureGrid}>
                      Apply Grid
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleRemoveInputMeasureGrid}>
                      Remove Grid
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleTransposeChart}>
                      Transpose Chart
                    </button>
                  </div>
                </div>
                <textarea className={`${INPUT_CLASS} min-h-64 font-mono`} value={input} onChange={(event) => setInput(event.target.value)} onBlur={() => setInput(normalizeChartInput(input))} spellCheck={false} />
                {smartPasteMessage ? <p className="text-sm text-zinc-400">{smartPasteMessage}</p> : null}
                <p className="text-xs text-stone-400">Grid mode makes each measure/bar easier to see. Simple Bars adds bar lines only. Beat Dots also expands single-measure chords. A dot means hold the previous chord for one beat.</p>
              </section>

              <section className="rounded-2xl border border-amber-950/20 bg-black/10 p-4 text-sm text-stone-300">
                <h4 className="mb-3 text-sm font-medium text-stone-100">Rhythm Help</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  <p><span className="font-semibold text-stone-100">1..4</span> = hold 1 for three beats, then 4 on beat 4</p>
                  <p><span className="font-semibold text-stone-100">1...</span> = whole measure of 1</p>
                  <p><span className="font-semibold text-stone-100">1.4.</span> = two beats of 1, two beats of 4</p>
                  <p><span className="font-semibold text-stone-100">1451</span> = one beat each</p>
                  <p><span className="font-semibold text-stone-100">.</span> = hold previous chord for one beat</p>
                  <p><span className="font-semibold text-stone-100">|</span> = optional bar separator</p>
                </div>
              </section>
              </section>

              <section className={SUBPANEL_CLASS}>
                <div className="mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Saved Charts</h2>
                  <p className="mt-1 text-xs text-stone-400">Keep reusable charts on this device and recall them quickly.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={handleConvert}>
                  Convert to Nashville Numbers
                </button>
                <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleSaveChart}>
                  Save Chart
                </button>
              </div>

              <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-medium text-zinc-200">Saved Charts</h2>
                  {hasMounted ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleLoadChart} disabled={!selectedSavedChartId}>
                        Load Chart
                      </button>
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleDeleteChart} disabled={!selectedSavedChartId}>
                        Delete Chart
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">Loading saved charts...</p>
                  )}
                </div>
                {hasMounted ? (
                  <select className={INPUT_CLASS} value={selectedSavedChartId} onChange={(event) => setSelectedSavedChartId(event.target.value)}>
                    <option value="">Select a saved chart</option>
                    {savedCharts.map((chart) => <option key={chart.id} value={chart.id}>{chart.id}</option>)}
                  </select>
                ) : (
                  <div className="rounded-xl border border-amber-950/40 bg-stone-950/70 px-3 py-2.5 text-base text-zinc-500">
                    Loading saved charts...
                  </div>
                )}
              </section>
              </section>
            </section>

            <section className={`${PANEL_CLASS} print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none`}>
              <div className="space-y-3 border-b border-amber-950/30 pb-4 print:hidden print:border-zinc-300">
                <h2 className="text-2xl font-semibold text-white print:text-black">{songTitle || 'Untitled Song'}</h2>
                <div className="grid gap-2 text-sm text-stone-300 sm:grid-cols-2 lg:grid-cols-4 print:text-black">
                  <p><span className="font-medium text-zinc-100 print:text-black">Artist:</span> {artist || 'N/A'}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Concert Key:</span> {selectedKey}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Play In:</span> {playInKey}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Capo:</span> {capo || '0'}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Time:</span> {timeSignature}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Tempo:</span> {tempo || 'N/A'}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Feel:</span> {feel || 'N/A'}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Style:</span> {chartMode === 'simple' ? 'Simple Bluegrass Mode' : 'Strict Nashville Mode'}</p>
                </div>
              </div>

              <div className="print-only border-b border-zinc-300 pb-2 text-black">
                <h2 className="text-xl font-semibold">{songTitle || 'Untitled Song'}</h2>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5">
                  {artist.trim() ? <p><span className="font-semibold">Artist:</span> {artist}</p> : null}
                  <p><span className="font-semibold">Key:</span> {selectedKey}</p>
                  {timeSignature.trim() ? <p><span className="font-semibold">Time:</span> {timeSignature}</p> : null}
                  {tempo.trim() ? <p><span className="font-semibold">Tempo:</span> {tempo}</p> : null}
                  {capo.trim() ? <p><span className="font-semibold">Capo:</span> {capo}</p> : null}
                </div>
              </div>

              <div className="mt-5 space-y-4 print:mt-2 print:space-y-2">
                <section className={`${SUBPANEL_CLASS} no-print`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Save / Share / Print</h3>
                      <p className="mt-1 text-xs text-stone-400">Export, print, and use the chart live without losing your place.</p>
                    </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleCopyChart}>{copyLabel}</button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleShareView}>{shareLabel}</button>
                    <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={() => setPerformanceMode(true)}>Performance Mode</button>
                    <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => window.print()}>Print Chart</button>
                  </div>
                </div>
                </section>

                {shareUrl ? (
                  <a href={shareUrl} className="no-print block break-all rounded-2xl border border-amber-950/30 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
                    {shareUrl}
                  </a>
                ) : null}

                <section className={`${SUBPANEL_CLASS} no-print`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Symbols & Tags</h4>
                      <p className="text-xs text-stone-400">Insert common Nashville chart marks at the cursor position.</p>
                    </div>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleToggleSymbols}>
                      {symbolsExpanded ? 'Hide Symbols' : 'Show Symbols'}
                    </button>
                  </div>
                  {symbolsExpanded ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {SYMBOL_BUTTONS.map((symbol) => (
                          <button
                            key={`${symbol.label}-${symbol.value}`}
                            type="button"
                            className={`${SECONDARY_BUTTON_CLASS} font-mono`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleInsertSymbol(symbol.value)}
                          >
                            {symbol.label}
                          </button>
                        ))}
                      </div>
                      <section className="rounded-2xl border border-amber-950/20 bg-black/10 p-4 text-sm text-stone-300">
                        <h4 className="mb-3 text-sm font-medium text-stone-100">Symbol Help</h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <p>◇ = hold/ring chord</p>
                          <p>^ = stop/choke</p>
                          <p>&gt; or &lt; = push/anticipation</p>
                          <p>% = repeat previous bar</p>
                          <p>||: and :|| = repeat section</p>
                          <p>| = bar line</p>
                          <p>/ = slash chord or bass note</p>
                          <p>- or m = minor chord</p>
                          <p>[Intro] = beginning section</p>
                          <p>[Tag] = repeat the ending/last line</p>
                          <p>[Turnaround] = short phrase leading back around</p>
                          <p>[Break] = instrumental break</p>
                          <p>[A Part] / [B Part] = fiddle tune sections</p>
                        </div>
                      </section>
                    </>
                  ) : null}
                </section>

                <section className={`${SUBPANEL_CLASS} no-print`}>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Nashville Output</h3>
                    <p className="mt-1 text-xs text-stone-400">Editable number chart ready for printing, sharing, or stage use.</p>
                  </div>
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-stone-400">
                      Measure Grid Style
                      <select className="rounded-lg border border-amber-950/40 bg-stone-950/70 px-3 py-2 text-sm normal-case tracking-normal text-stone-100 outline-none transition focus:border-amber-500" value={measureGridStyle} onChange={(event) => setMeasureGridStyle(event.target.value as MeasureGridStyle)}>
                        <option value="off">Off</option>
                        <option value="simple-bars">Simple Bars</option>
                        <option value="beat-dots">Beat Dots</option>
                      </select>
                    </label>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleAddOutputMeasureGrid}>
                      Apply Grid
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleRemoveOutputMeasureGrid}>
                      Remove Grid
                    </button>
                  </div>
                <textarea
                  ref={outputRef}
                  className="no-print min-h-80 w-full resize-none overflow-hidden rounded-2xl border border-emerald-900/40 bg-stone-950/85 px-4 py-4 font-mono text-lg leading-8 text-emerald-300 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                  value={output}
                  onChange={(event) => setOutput(event.target.value)}
                  spellCheck={false}
                />
                  <p className="mt-3 text-xs text-stone-400">Grid mode makes each measure/bar easier to see. Simple Bars adds bar lines only. Beat Dots also expands single-measure chords. A dot means hold the previous chord for one beat.</p>
                </section>

                <div className="print-only print-chart-text -mt-1 text-black">
                  <ChartLines text={printChartText} />
                </div>

                {notes.trim() ? (
                  <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-300 print:order-first print:mb-1 print:border-0 print:bg-white print:p-0 print:text-black">
                    <h4 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-100 print:mb-1 print:text-black">Notes</h4>
                    <p className="whitespace-pre-wrap leading-7 print:leading-5">{notes}</p>
                  </section>
                ) : null}

              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
