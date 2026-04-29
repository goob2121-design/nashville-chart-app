'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AuthGate, BrandHeaderTitle } from './components/AuthGate';
import {
  dedupeCharts,
  deleteCloudChart,
  fetchCloudCharts,
  getChartAudioPublicUrl,
  getInitialCloudStatus,
  normalizeChartKey,
  removeChartAudioFile,
  uploadChartAudioFile,
  upsertCloudChart,
  type CloudStatus,
  type SavedChart as CloudSavedChart,
  isUuid,
} from './lib/cloudSync';

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
  'kickoff',
  'full band kickoff',
  'instrumental',
  'instrumental break',
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
type UiMode = 'quick' | 'pro';
type ActiveTextarea = 'input' | 'output';
type AudioAnalysisStatus = 'Waiting for file' | 'Analyzing...' | 'Analysis complete' | 'Analysis failed';
type SectionId = 'songSetup' | 'chartBuilder' | 'output' | 'advanced' | 'library';
type SectionOpenState = Record<SectionId, boolean>;

type ChartSnapshot = {
  audioFilename: string;
  audioPath: string;
  audioUrl: string;
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
const FAVORITES_STORAGE_KEY = 'nashville-chart-builder:favorite-charts';
const SETLISTS_STORAGE_KEY = 'nashville-chart-builder:setlists';
const SYMBOL_TOOLBAR_STORAGE_KEY = 'nashville-chart-builder:symbol-toolbar-expanded';
const SECTION_OPEN_STORAGE_KEY = 'nashville-chart-builder:section-open-state';
const SYMBOL_CATEGORY_STORAGE_KEY = 'nashville-chart-builder:selected-symbol-category';
const UI_MODE_STORAGE_KEY = 'nashville-chart-builder:ui-mode';
const STARTER_TEMPLATE_STORAGE_KEY = 'nashville-chart-builder:starter-template';

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

const DEFAULT_SECTION_OPEN_STATE: SectionOpenState = {
  songSetup: true,
  chartBuilder: true,
  output: true,
  advanced: false,
  library: false,
};

const SAMPLE_CHART: ChartSnapshot = {
  audioFilename: '',
  audioPath: '',
  audioUrl: '',
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

void SYMBOL_BUTTONS;

const SYMBOL_CATEGORIES = {
  Common: [
    { label: '◇', value: '◇' },
    { label: '^', value: '^' },
    { label: '•', value: '•' },
    { label: '>', value: '>' },
    { label: '<', value: '<' },
    { label: '%', value: '%' },
    { label: '|', value: '|' },
    { label: '||', value: '||' },
    { label: '/', value: '/' },
    { label: '-', value: '-' },
    { label: 'N.C.', value: '[N.C.]' },
  ],
  Sections: [
    { label: '[Intro]', value: '[Intro]' },
    { label: '[V1]', value: '[V1]' },
    { label: '[V2]', value: '[V2]' },
    { label: '[V3]', value: '[V3]' },
    { label: '[Ch]', value: '[Ch]' },
    { label: '[Br]', value: '[Br]' },
    { label: '[Break]', value: '[Break]' },
    { label: '[Tag]', value: '[Tag]' },
    { label: '[Outro]', value: '[Outro]' },
    { label: '[A Part]', value: '[A Part]' },
    { label: '[B Part]', value: '[B Part]' },
  ],
  Breaks: [
    { label: '[Break]', value: '[Break]' },
    { label: '[Instrumental Break]', value: '[Instrumental Break]' },
    { label: '[Banjo Break]', value: '[Banjo Break]' },
    { label: '[Guitar Break]', value: '[Guitar Break]' },
    { label: '[Mandolin Break]', value: '[Mandolin Break]' },
    { label: '[Fiddle Break]', value: '[Fiddle Break]' },
    { label: '[Dobro Break]', value: '[Dobro Break]' },
    { label: '[Bass Break]', value: '[Bass Break]' },
    { label: '[Mando Chop In]', value: '[Mando Chop In]' },
    { label: '[Harmony In]', value: '[Harmony In]' },
    { label: '[Turnaround]', value: '[Turnaround]' },
    { label: '[Walk Up]', value: '[Walk Up]' },
  ],
  Kickoffs: [
    { label: '[Kickoff]', value: '[Kickoff]' },
    { label: '[Full Band Kickoff]', value: '[Full Band Kickoff]' },
    { label: '[Banjo Kickoff]', value: '[Banjo Kickoff]' },
    { label: '[Guitar Kickoff]', value: '[Guitar Kickoff]' },
    { label: '[Mandolin Kickoff]', value: '[Mandolin Kickoff]' },
    { label: '[Fiddle Kickoff]', value: '[Fiddle Kickoff]' },
    { label: '[Dobro Kickoff]', value: '[Dobro Kickoff]' },
    { label: '[Kick on 5]', value: '[Kick on 5]' },
    { label: '[Stop on 1]', value: '[Stop on 1]' },
  ],
  Endings: [
    { label: '[Tag]', value: '[Tag]' },
    { label: '[Tag Last Line]', value: '[Tag Last Line]' },
    { label: '[Tag Last Line x2]', value: '[Tag Last Line x2]' },
    { label: '[Tag Chorus]', value: '[Tag Chorus]' },
    { label: '[Tag Chorus x2]', value: '[Tag Chorus x2]' },
    { label: '[Repeat Last Line]', value: '[Repeat Last Line]' },
    { label: '[Tag Last Line Chorus]', value: '[Tag Last Line Chorus]' },
    { label: '[Tag Last Line Chorus x2]', value: '[Tag Last Line Chorus x2]' },
    { label: '[Outro = Chorus Tag]', value: '[Outro = Chorus Tag]' },
    { label: '[Cold End]', value: '[Cold End]' },
    { label: '[Hold Last 1]', value: '[Hold Last 1]' },
    { label: '[Run Out]', value: '[Run Out]' },
    { label: '[Repeat to End]', value: '[Repeat to End]' },
  ],
  Bluegrass: [
    { label: '[Turnaround]', value: '[Turnaround]' },
    { label: '[Walk Up]', value: '[Walk Up]' },
    { label: '[Mando Chop In]', value: '[Mando Chop In]' },
    { label: '[Harmony In]', value: '[Harmony In]' },
    { label: '[Kick on 5]', value: '[Kick on 5]' },
    { label: '[Stop on 1]', value: '[Stop on 1]' },
    { label: '[A Part]', value: '[A Part]' },
    { label: '[B Part]', value: '[B Part]' },
  ],
  Rhythm: [
    { label: '[x2]', value: '[x2]' },
    { label: '[x3]', value: '[x3]' },
    { label: '||:', value: '||:' },
    { label: ':||', value: ':||' },
    { label: '.', value: '.' },
    { label: '/', value: '/' },
    { label: '1...', value: '1...' },
    { label: '1..4', value: '1..4' },
    { label: '1.4.', value: '1.4.' },
    { label: '| 1..4 | 1 | 4 | 1 |', value: '| 1..4 | 1 | 4 | 1 |' },
  ],
} as const;

type SymbolCategory = keyof typeof SYMBOL_CATEGORIES;

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

[Mandolin Break]

[Chorus]

[Turnaround]`,
};

const STARTER_TEMPLATES = {
  'Bluegrass Instrumental': `[Kickoff]
| 1 | 1..4 | 1 | 5/1 |

[A Part]
| 1 | 1..4 | 1 | 5/1 |
| 7/4 | 1 | 7/4 | 5..^ |
| 1 | 1..4 | 1 | 1/4 | 5/1 |

[B Part]
| 4 | 4 | 1 | 1 |
| 5 | 4 | 1 | 5 |

[Tag]
| 1 | 5 | 1 |`,
  'Gospel Song': `[Verse]
| 1 | 1 | 4 | 1 |
| 1 | 1 | 5 | 5 |
| 1 | 1 | 4 | 1 |
| 1 | 5 | 1 | 1 |

[Chorus]
| 4 | 4 | 1 | 1 |
| 1 | 1 | 5 | 5 |
| 1 | 1 | 4 | 1 |
| 1 | 5 | 1 | 1 |

[Tag]
| 1 | 5 | 1 |`,
  'Verse / Chorus / Tag': `[Verse]
| 1 | 1 | 4 | 1 |
| 1 | 1 | 5 | 5 |

[Chorus]
| 4 | 4 | 1 | 1 |
| 1 | 5 | 1 | 1 |

[Tag]
| 1 | 5 | 1 |`,
  'AABB Fiddle Tune': `[A Part]
| 1 | 1 | 4 | 1 |
| 1 | 5 | 1 | 1 |
[x2]

[B Part]
| 4 | 4 | 1 | 1 |
| 5 | 5 | 1 | 1 |
[x2]`,
  'Basic Jam Tune': `[Kickoff]
| 1 | 1 | 1 | 5 |

[Break]
| 1 | 1 | 4 | 1 |
| 1 | 5 | 1 | 1 |

[Tag]
| 1 | 5 | 1 |`,
  'Waltz / 3/4 Song': `[Verse]
| 1 | 1 | 4 | 1 |
| 1 | 1 | 5 | 5 |
| 1 | 1 | 4 | 1 |
| 1 | 5 | 1 | 1 |

[Tag]
| 1 | 5 | 1 |`,
} as const;

type StarterTemplateName = keyof typeof STARTER_TEMPLATES;

const SMART_REFERENCE_PATTERNS = [
  {
    pattern: /^same as verse(?:\s+(\d+))?$/i,
    format: (match: RegExpMatchArray) => `[Same as Verse${match[1] ? ` ${match[1]}` : ''}]`,
  },
  { pattern: /^same as chorus$/i, format: () => '[Same as Chorus]' },
  { pattern: /^same as intro$/i, format: () => '[Same as Intro]' },
  { pattern: /^repeat chorus$/i, format: () => '[Same as Chorus]' },
  { pattern: /^banjo break$/i, format: () => '[Banjo Break]' },
  { pattern: /^guitar break$/i, format: () => '[Guitar Break]' },
  { pattern: /^mandolin break$/i, format: () => '[Mandolin Break]' },
  { pattern: /^fiddle break$/i, format: () => '[Fiddle Break]' },
  { pattern: /^dobro break$/i, format: () => '[Dobro Break]' },
  { pattern: /^bass break$/i, format: () => '[Bass Break]' },
  { pattern: /^(?:instrumental )?break$/i, format: () => '[Break]' },
  { pattern: /^banjo kickoff$/i, format: () => '[Banjo Kickoff]' },
  { pattern: /^guitar kickoff$/i, format: () => '[Guitar Kickoff]' },
  { pattern: /^mandolin kickoff$/i, format: () => '[Mandolin Kickoff]' },
  { pattern: /^fiddle kickoff$/i, format: () => '[Fiddle Kickoff]' },
  { pattern: /^dobro kickoff$/i, format: () => '[Dobro Kickoff]' },
  { pattern: /^full band kickoff$/i, format: () => '[Full Band Kickoff]' },
  { pattern: /^kickoff$/i, format: () => '[Kickoff]' },
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

  if (lower === 'solo') {
    return '[Break]';
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

function expandMeasureToken(token: string): string {
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

function estimateBpmFromAudioBuffer(buffer: AudioBuffer) {
  const sampleRate = buffer.sampleRate;
  const maxSamples = Math.min(buffer.length, sampleRate * 90);
  const frameSize = 2048;
  const hopSize = 512;
  const frameRate = sampleRate / hopSize;
  const energies: number[] = [];

  for (let start = 0; start + frameSize < maxSamples; start += hopSize) {
    let sum = 0;

    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);

      for (let sampleIndex = start; sampleIndex < start + frameSize; sampleIndex += 1) {
        const sample = channel[sampleIndex] ?? 0;
        sum += sample * sample;
      }
    }

    energies.push(Math.sqrt(sum / (frameSize * buffer.numberOfChannels)));
  }

  if (energies.length < frameRate * 8) {
    return null;
  }

  const novelty = energies.map((energy, index) => Math.max(0, energy - (energies[index - 1] ?? energy)));
  const sortedNovelty = [...novelty].sort((first, second) => first - second);
  const noiseFloor = sortedNovelty[Math.floor(sortedNovelty.length * 0.55)] ?? 0;
  const strongOnset = sortedNovelty[Math.floor(sortedNovelty.length * 0.9)] ?? 0;
  const threshold = noiseFloor + (strongOnset - noiseFloor) * 0.35;
  const onsetCurve = novelty.map((value) => (value > threshold ? value - threshold : 0));

  if (!onsetCurve.some((value) => value > 0)) {
    return null;
  }

  const minBpm = 60;
  const maxBpm = 200;
  let bestBpm = 0;
  let bestScore = 0;

  for (let bpm = minBpm; bpm <= maxBpm; bpm += 1) {
    const lag = (60 / bpm) * frameRate;
    let score = 0;

    for (const multiplier of [1, 2, 0.5]) {
      const scaledLag = Math.round(lag * multiplier);

      if (scaledLag < 1 || scaledLag >= onsetCurve.length) {
        continue;
      }

      for (let index = scaledLag; index < onsetCurve.length; index += 1) {
        score += onsetCurve[index] * onsetCurve[index - scaledLag] * (multiplier === 1 ? 1 : 0.45);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  return bestScore > 0 ? bestBpm : null;
}

function estimateKeyFromAudioBuffer(buffer: AudioBuffer): KeyName | null {
  const channel = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const windowSize = 2048;
  const stepSize = Math.max(windowSize, Math.floor(sampleRate * 0.2));
  const maxSamples = Math.min(channel.length, sampleRate * 75);
  const chroma = Array.from({ length: 12 }, () => 0);

  for (let start = 0; start + windowSize < maxSamples; start += stepSize) {
    for (let midi = 36; midi <= 84; midi += 1) {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      const coefficient = (2 * Math.PI * frequency) / sampleRate;
      let real = 0;
      let imaginary = 0;

      for (let index = 0; index < windowSize; index += 1) {
        const sample = channel[start + index] ?? 0;
        real += sample * Math.cos(coefficient * index);
        imaginary -= sample * Math.sin(coefficient * index);
      }

      chroma[midi % 12] += real * real + imaginary * imaginary;
    }
  }

  const total = chroma.reduce((sum, value) => sum + value, 0);

  if (!total) {
    return null;
  }

  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const keySemitones: Record<KeyName, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let bestKey: KeyName | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const key of MAJOR_KEYS) {
    const root = keySemitones[key];
    const score = majorProfile.reduce((sum, weight, index) => sum + weight * chroma[(root + index) % 12], 0);

    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
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

function convertChordToken(chord: string, key: KeyName, chartMode: ChartMode): string {
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

function convertLine(line: string, key: KeyName, chartMode: ChartMode): string {
  return line
    .split(/(\s+)/)
    .map((token) => (token.trim() ? convertChordToken(token, key, chartMode) : token))
    .join('');
}

function buildConvertedChart(input: string, key: KeyName, chartMode: ChartMode): string {
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

function transposeChordToken(token: string, fromKey: KeyName, toKey: KeyName, chartMode: ChartMode): string {
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

function transposeChartText(input: string, fromKey: KeyName, toKey: KeyName, chartMode: ChartMode): string {
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

function createSectionSeparator(line: string): string {
  const bracketMatch = line.match(/^\[(.+)\]$/);
  return bracketMatch ? `--- ${bracketMatch[1]} ---` : line;
}

function isReferenceTag(line: string) {
  return /^\[(?:Same as .+|V2 = V1|V3 = V1|Ch2 = Ch1|Solo = Verse|Break = Chorus|Outro = Intro|Outro = Chorus Tag|Last Line Chorus|Last 2 Lines Chorus|Verse Chords|Chorus Chords|Kick on 5|Stop on 1|Build|Half-time|Walk Up|N\.C\.|Cold End|Fade|Hold Last 1|Run Out|Repeat to End|x2|x3|Kickoff|Full Band Kickoff|Banjo Kickoff|Guitar Kickoff|Mandolin Kickoff|Fiddle Kickoff|Dobro Kickoff|Banjo Break|Guitar Break|Mandolin Break|Fiddle Break|Dobro Break|Bass Break|Instrumental Break|Dobro Solo|Mando Chop In|Harmony In|Tag Last Line|Tag Last Line x2|Tag Chorus|Tag Chorus x2|Tag Last Line Chorus|Tag Last Line Chorus x2)\]$/i.test(
    line.trim()
  );
}

function buildSnapshot(values: {
  audioFilename: string;
  audioPath: string;
  audioUrl: string;
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
    audioFilename: values.audioFilename,
    audioPath: values.audioPath,
    audioUrl: values.audioUrl,
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

function normalizeSavedChart(chart: CloudSavedChart): SavedChart {
  return {
    audioFilename: chart.audioFilename ?? '',
    audioPath: chart.audioPath ?? '',
    audioUrl: chart.audioUrl ?? '',
    artist: chart.artist ?? '',
    capo: chart.capo ?? '',
    chartMode: chart.chartMode === 'strict' ? 'strict' : 'simple',
    chordChart: chart.chordChart ?? '',
    feel: chart.feel ?? '',
    id: chart.id,
    key: MAJOR_KEYS.includes(chart.key as KeyName) ? (chart.key as KeyName) : 'C',
    nashvilleChart: chart.nashvilleChart ?? '',
    notes: chart.notes ?? '',
    savedAt: chart.savedAt ?? new Date().toISOString(),
    tempo: chart.tempo ?? '',
    timeSignature: TIME_SIGNATURES.includes(chart.timeSignature as TimeSignature) ? (chart.timeSignature as TimeSignature) : '4/4',
    title: chart.title ?? '',
  };
}

function savedChartLabel(chart: SavedChart) {
  const title = chart.title?.trim() || 'Untitled Chart';
  const artist = chart.artist?.trim();
  const audioPrefix = chart.audioUrl?.trim() || chart.audioPath?.trim() ? '[MP3] ' : '';

  if (audioPrefix) {
    return `${audioPrefix}${artist ? `${title} - ${artist}` : title}`;
  }

  return artist ? `${title} — ${artist}` : title;
}

function resolveChartAudioDownloadUrl(chart: Pick<ChartSnapshot, 'audioPath' | 'audioUrl'>) {
  return getChartAudioPublicUrl(chart);
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
  onExit?: () => void;
  onPerformanceMode: () => void;
}) {
  const readOnlyChart = chart.nashvilleChart.trim()
    ? chart.nashvilleChart
    : chart.chordChart.trim()
      ? chart.chordChart
      : 'No chart entered.';
  const downloadAudioUrl = resolveChartAudioDownloadUrl(chart);

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
            {downloadAudioUrl ? (
              <>
                <a
                  href={downloadAudioUrl}
                  download={chart.audioFilename ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                >
                  Download MP3
                </a>
                {chart.audioFilename?.trim() ? <p className="text-xs text-zinc-400">{chart.audioFilename}</p> : null}
              </>
            ) : null}
            {onExit ? (
              <button
                type="button"
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
                onClick={onExit}
              >
                Open Editor
              </button>
            ) : null}
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

function SectionCard({
  title,
  description,
  isOpen,
  onToggle,
  children,
  className = '',
}: {
  title: string;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${SUBPANEL_CLASS} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">{title}</h2>
          <p className="text-xs leading-5 text-stone-400">{description}</p>
        </div>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onToggle}>
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      {isOpen ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}

export default function Page() {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const replaceAudioInputRef = useRef<HTMLInputElement>(null);
  const [audioFilename, setAudioFilename] = useState(SAMPLE_CHART.audioFilename);
  const [audioPath, setAudioPath] = useState(SAMPLE_CHART.audioPath);
  const [audioUrl, setAudioUrl] = useState(SAMPLE_CHART.audioUrl);
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
  const [showManualShareUrl, setShowManualShareUrl] = useState(false);
  const [saveLabel, setSaveLabel] = useState('Save Chart');
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [selectedSavedChartId, setSelectedSavedChartId] = useState('');
  const [currentChartId, setCurrentChartId] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(getInitialCloudStatus());
  const [cloudMessage, setCloudMessage] = useState('');
  const [audioMessage, setAudioMessage] = useState('');
  const [smartPasteMessage, setSmartPasteMessage] = useState('');
  const [isShareView, setIsShareView] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [uiMode, setUiMode] = useState<UiMode>('quick');
  const [symbolsExpanded, setSymbolsExpanded] = useState(false);
  const [selectedSymbolCategory, setSelectedSymbolCategory] = useState<SymbolCategory>('Common');
  const [isSymbolHelpOpen, setIsSymbolHelpOpen] = useState(false);
  const [templatesExpanded, setTemplatesExpanded] = useState(false);
  const [activeTextarea, setActiveTextarea] = useState<ActiveTextarea>('output');
  const [sectionOpen, setSectionOpen] = useState<SectionOpenState>(DEFAULT_SECTION_OPEN_STATE);
  const [measureGridStyle, setMeasureGridStyle] = useState<MeasureGridStyle>('off');
  const [audioAnalyzeExpanded, setAudioAnalyzeExpanded] = useState(false);
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [analysisFileName, setAnalysisFileName] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState<AudioAnalysisStatus>('Waiting for file');
  const [estimatedBpm, setEstimatedBpm] = useState<number | null>(null);
  const [estimatedKey, setEstimatedKey] = useState<KeyName | null>(null);
  const [analysisBpm, setAnalysisBpm] = useState('');
  const [analysisKey, setAnalysisKey] = useState<KeyName>(SAMPLE_CHART.key);
  const [analysisTimeSignature, setAnalysisTimeSignature] = useState<TimeSignature | ''>('');
  const [selectedStarterTemplate, setSelectedStarterTemplate] = useState<StarterTemplateName>('Bluegrass Instrumental');

  useEffect(() => {
    const mountTimer = window.setTimeout(() => {
      setHasMounted(true);
      let parsedSavedCharts: SavedChart[] = [];

      const loadSavedCharts = async () => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const storedToolbarPreference = window.localStorage.getItem(SYMBOL_TOOLBAR_STORAGE_KEY);
        const storedSectionState = window.localStorage.getItem(SECTION_OPEN_STORAGE_KEY);
        const storedSymbolCategory = window.localStorage.getItem(SYMBOL_CATEGORY_STORAGE_KEY);
        const storedUiMode = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
        const storedStarterTemplate = window.localStorage.getItem(STARTER_TEMPLATE_STORAGE_KEY);

        parsedSavedCharts = dedupeCharts(saved ? (JSON.parse(saved) as SavedChart[]) : []);
        setSavedCharts(parsedSavedCharts);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedSavedCharts));
        setSelectedSavedChartId(parsedSavedCharts[0]?.id ?? '');

        if (storedToolbarPreference === 'true' || storedToolbarPreference === 'false') {
          setSymbolsExpanded(storedToolbarPreference === 'true');
        } else {
          setSymbolsExpanded(false);
        }

        if (storedSectionState) {
          const parsedSectionState = JSON.parse(storedSectionState) as Partial<SectionOpenState>;
          setSectionOpen({ ...DEFAULT_SECTION_OPEN_STATE, ...parsedSectionState });
        }

        if (storedSymbolCategory && storedSymbolCategory in SYMBOL_CATEGORIES) {
          setSelectedSymbolCategory(storedSymbolCategory as SymbolCategory);
        }

        if (storedUiMode === 'quick' || storedUiMode === 'pro') {
          setUiMode(storedUiMode);
        }

        if (storedStarterTemplate && storedStarterTemplate in STARTER_TEMPLATES) {
          setSelectedStarterTemplate(storedStarterTemplate as StarterTemplateName);
        }

        if (getInitialCloudStatus().connected) {
          const cloudResult = await fetchCloudCharts();

          if (cloudResult.error) {
            setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${cloudResult.error}` });
            setCloudMessage('Supabase is unavailable right now. Using local saved charts.');
          } else {
            const cloudCharts = dedupeCharts(cloudResult.charts.map(normalizeSavedChart));
            parsedSavedCharts = cloudCharts;
            setSavedCharts(cloudCharts);
            setSelectedSavedChartId(cloudCharts[0]?.id ?? '');
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudCharts));
            setCloudStatus({ connected: true, label: 'Connected', message: 'Cloud Sync: Connected' });
            setCloudMessage('');
          }
        }
      } catch {
        setSavedCharts([]);
        setSelectedSavedChartId('');
        setSymbolsExpanded(false);
        setSectionOpen(DEFAULT_SECTION_OPEN_STATE);
        setCloudStatus({ connected: false, label: 'Local Only', message: 'Cloud Sync: Local Only. Local data could not be loaded.' });
      }

      const params = new URLSearchParams(window.location.search);
      const sharedChart = params.get('chart');
      const openChartId = params.get('openChart');

      if (openChartId) {
        const chartToOpen = parsedSavedCharts.find((chart) => chart.id === openChartId);

        if (chartToOpen) {
          applySnapshot(chartToOpen);
          setSelectedSavedChartId(chartToOpen.id);
          setCurrentChartId(chartToOpen.id);
        }

        window.history.replaceState(null, '', window.location.pathname);
        return;
      }

      if (!sharedChart) {
        return;
      }

      const decoded = deserializeChart(sharedChart);

      if (!decoded) {
        return;
      }

      applySnapshot(decoded);
      setCurrentChartId(null);
      setIsShareView(true);
      };

      void loadSavedCharts();
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
  const isQuickMode = uiMode === 'quick';
  const chartAudioDownloadUrl = resolveChartAudioDownloadUrl({ audioPath, audioUrl });
  const hasAttachedAudio = Boolean(audioUrl.trim() || audioPath.trim());

  function currentSnapshot() {
    return buildSnapshot({
      audioFilename,
      audioPath,
      audioUrl,
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
    setAudioMessage('');
    setAudioFilename(chart.audioFilename ?? '');
    setAudioPath(chart.audioPath ?? '');
    setAudioUrl(chart.audioUrl ?? '');
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

  function applyAudioAttachment(fields: Pick<ChartSnapshot, 'audioFilename' | 'audioPath' | 'audioUrl'>) {
    setAudioFilename(fields.audioFilename ?? '');
    setAudioPath(fields.audioPath ?? '');
    setAudioUrl(fields.audioUrl ?? '');
  }

  function persistSavedCharts(nextCharts: SavedChart[]) {
    const dedupedCharts = dedupeCharts(nextCharts);
    setSavedCharts(dedupedCharts);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dedupedCharts));
  }

  function replaceLocalChartReferences(oldId: string, nextId: string) {
    if (!oldId || oldId === nextId) {
      return;
    }

    try {
      const storedFavorites = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      const favoriteIds = storedFavorites ? (JSON.parse(storedFavorites) as string[]) : [];
      window.localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(favoriteIds.map((id) => (id === oldId ? nextId : id)))
      );

      const storedSetlists = window.localStorage.getItem(SETLISTS_STORAGE_KEY);
      const setlists = storedSetlists ? (JSON.parse(storedSetlists) as Array<{ songIds: string[] }>) : [];
      window.localStorage.setItem(
        SETLISTS_STORAGE_KEY,
        JSON.stringify(
          setlists.map((setlist) => ({
            ...setlist,
            songIds: setlist.songIds.map((songId) => (songId === oldId ? nextId : songId)),
          }))
        )
      );
    } catch {
      setCloudMessage('Chart saved, but some local favorite/setlist references could not be updated.');
    }
  }

  function handleToggleSymbols() {
    setSymbolsExpanded((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(SYMBOL_TOOLBAR_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  function handleToggleSection(section: SectionId) {
    setSectionOpen((currentValue) => {
      const nextValue = { ...currentValue, [section]: !currentValue[section] };
      window.localStorage.setItem(SECTION_OPEN_STORAGE_KEY, JSON.stringify(nextValue));
      return nextValue;
    });
  }

  function handleSetUiMode(mode: UiMode) {
    setUiMode(mode);
    window.localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
  }

  function handleSetSymbolCategory(category: SymbolCategory) {
    setSelectedSymbolCategory(category);
    window.localStorage.setItem(SYMBOL_CATEGORY_STORAGE_KEY, category);
  }

  function handleAudioAnalysisFile(file: File | null) {
    if (!file) {
      setAnalysisFile(null);
      setAnalysisFileName('');
      setEstimatedBpm(null);
      setEstimatedKey(null);
      setAnalysisStatus('Waiting for file');
      return;
    }

    setAnalysisFile(file);
    setAnalysisFileName(file.name);
    setEstimatedBpm(null);
    setEstimatedKey(null);
    setAnalysisStatus(/\.(mp3|wav|m4a)$/i.test(file.name) ? 'Waiting for file' : 'Analysis failed');
  }

  async function handleAnalyzeAudio() {
    if (!analysisFile || !analysisFileName) {
      setAnalysisStatus('Waiting for file');
      return;
    }

    if (!/\.(mp3|wav|m4a)$/i.test(analysisFileName)) {
      setAnalysisStatus('Analysis failed');
      return;
    }

    setAnalysisStatus('Analyzing...');

    try {
      const audioContext = new window.AudioContext();
      const arrayBuffer = await analysisFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const bpm = estimateBpmFromAudioBuffer(audioBuffer);
      const key = estimateKeyFromAudioBuffer(audioBuffer);
      await audioContext.close();

      if (!bpm && !key) {
        setAnalysisStatus('Analysis failed');
        return;
      }

      setEstimatedBpm(bpm);
      setEstimatedKey(key);

      if (bpm) {
        setAnalysisBpm(String(bpm));
      }

      if (key) {
        setAnalysisKey(key);
      }

      setAnalysisStatus('Analysis complete');
    } catch {
      setAnalysisStatus('Analysis failed');
    }
  }

  function handleApplyEstimatedBpm() {
    if (estimatedBpm) {
      setTempo(String(estimatedBpm));
    }
  }

  function handleApplyEstimatedKey() {
    if (estimatedKey) {
      setSelectedKey(estimatedKey);
      setTransposeToKey(estimatedKey);
    }
  }

  function handleApplyAudioAnalysis() {
    setSelectedKey(analysisKey);
    setTransposeToKey(analysisKey);

    if (analysisBpm.trim()) {
      setTempo(analysisBpm.trim());
    }

    if (analysisTimeSignature) {
      setTimeSignature(analysisTimeSignature);
    }
  }

  function handleSetStarterTemplate(templateName: StarterTemplateName) {
    setSelectedStarterTemplate(templateName);
    window.localStorage.setItem(STARTER_TEMPLATE_STORAGE_KEY, templateName);
  }

  function templateStatusText(action: 'inserted' | 'appended') {
    return `${selectedStarterTemplate} starter template ${action} for ${selectedKey}, ${timeSignature}${tempo.trim() ? `, ${tempo.trim()} BPM` : ''}.`;
  }

  function handleInsertStarterTemplate() {
    const hasContent = input.trim() || output.trim();

    if (hasContent && !window.confirm('Replace the current chart text with this starter template?')) {
      return;
    }

    const starterTemplate = STARTER_TEMPLATES[selectedStarterTemplate];
    setInput(starterTemplate);
    setOutput(starterTemplate);
    setSmartPasteMessage(templateStatusText('inserted'));
  }

  function handleAppendStarterTemplate() {
    const starterTemplate = STARTER_TEMPLATES[selectedStarterTemplate];
    setInput((current) => (current.trim() ? `${current.trim()}\n\n${starterTemplate}` : starterTemplate));
    setOutput((current) => (current.trim() ? `${current.trim()}\n\n${starterTemplate}` : starterTemplate));
    setSmartPasteMessage(templateStatusText('appended'));
  }

  function handleClearAudioAnalysis() {
    setAnalysisFile(null);
    setAnalysisFileName('');
    setEstimatedBpm(null);
    setEstimatedKey(null);
    setAnalysisBpm('');
    setAnalysisKey(selectedKey);
    setAnalysisTimeSignature('');
    setAnalysisStatus('Waiting for file');
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
    if (!cloudStatus.connected) {
      setShareLabel('Cloud Required');
      setCloudMessage('Cloud sync is required for short share links.');
      return;
    }

    if (!currentChartId || !isUuid(currentChartId)) {
      setShareLabel('Save to Cloud First');
      setCloudMessage('Save this chart to cloud before sharing.');
      return;
    }

    const url = `${window.location.origin}/share/chart/${currentChartId}`;
    setShareUrl(url);
    setShowManualShareUrl(false);

    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('Copied!');
      window.setTimeout(() => setShareLabel('Share View'), 1600);
    } catch {
      setShowManualShareUrl(true);
      setShareLabel('Copy Failed');
      window.setTimeout(() => setShareLabel('Share View'), 1600);
    }
  }

  async function saveChartRecord(overrides: Partial<SavedChart> = {}) {
    const snapshot = currentSnapshot();
    const now = new Date().toISOString();
    const existingById = currentChartId ? savedCharts.find((chart) => chart.id === currentChartId) : null;
    const existingByChartKey = savedCharts.find((chart) => normalizeChartKey(chart) === normalizeChartKey(snapshot));
    const existingChart = existingById ?? existingByChartKey ?? null;
    const id = overrides.id ?? existingChart?.id ?? currentChartId ?? (snapshot.title.trim() || `Untitled ${new Date().toLocaleString()}`);
    const savedChart = {
      ...snapshot,
      ...overrides,
      id,
      savedAt: overrides.savedAt ?? now,
    };
    const exists = savedCharts.some((chart) => chart.id === id);
    const nextCharts = exists
      ? savedCharts.map((chart) => (chart.id === id ? savedChart : chart))
      : [savedChart, ...savedCharts];

    persistSavedCharts(nextCharts);
    setSelectedSavedChartId(id);
    setCurrentChartId(id);

    if (cloudStatus.connected) {
      const result = await upsertCloudChart(savedChart);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Saved locally. Cloud sync failed, so localStorage is still your backup.');
        return savedChart;
      } else if (result.chart) {
        const cloudSavedChart = normalizeSavedChart(result.chart);
        const cloudCharts = nextCharts.some((chart) => chart.id === savedChart.id)
          ? nextCharts.map((chart) => (chart.id === savedChart.id ? cloudSavedChart : chart))
          : [cloudSavedChart, ...nextCharts];
        persistSavedCharts(cloudCharts);
        setSelectedSavedChartId(cloudSavedChart.id);
        setCurrentChartId(cloudSavedChart.id);
        if (cloudSavedChart.id !== savedChart.id) {
          replaceLocalChartReferences(savedChart.id, cloudSavedChart.id);
          setCloudMessage('Saved locally and synced to cloud. Local chart ID was updated to the cloud UUID.');
        } else {
          setCloudMessage('Saved locally and synced to cloud.');
        }
        return cloudSavedChart;
      } else {
        setCloudMessage('Saved locally and synced to cloud.');
        return savedChart;
      }
    }

    return savedChart;
  }

  async function handleSaveChart() {
    setIsSaving(true);
    setSaveLabel('Saving...');
    setSaveStatusMessage('');

    try {
      const savedChart = await saveChartRecord();
      const savedDate = new Date(savedChart.savedAt);
      setSaveLabel('Saved ✓');
      setSaveStatusMessage(Number.isNaN(savedDate.getTime()) ? 'Last saved just now' : `Last saved at ${savedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
      window.setTimeout(() => setSaveLabel('Save Chart'), 1800);
    } catch {
      setSaveLabel('Save failed');
      setSaveStatusMessage('Save failed. Try again.');
      window.setTimeout(() => setSaveLabel('Save Chart'), 2200);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUploadAudio(file: File | null) {
    if (!file) {
      return;
    }

    if (!cloudStatus.connected) {
      setAudioMessage('MP3 uploads require cloud sync.');
      return;
    }

    if (!/\.mp3$/i.test(file.name)) {
      setAudioMessage('Please choose an MP3 file.');
      return;
    }

    setAudioMessage('Saving chart before upload...');
    const savedChart = await saveChartRecord();

    if (!isUuid(savedChart.id)) {
      setAudioMessage('MP3 uploads require a cloud-synced chart record.');
      return;
    }

    const previousAudioPath = savedChart.audioPath ?? audioPath;
    const uploadResult = await uploadChartAudioFile(savedChart.id, file);

    if (!uploadResult.ok) {
      setAudioMessage(uploadResult.error || 'MP3 upload failed.');
      return;
    }

    const audioFields = {
      audioFilename: uploadResult.audioFilename,
      audioPath: uploadResult.audioPath,
      audioUrl: uploadResult.audioUrl,
    };

    applyAudioAttachment(audioFields);

    const updatedChart = await saveChartRecord({
      ...audioFields,
      id: savedChart.id,
    });
    applyAudioAttachment(updatedChart);

    if (previousAudioPath && previousAudioPath !== updatedChart.audioPath) {
      await removeChartAudioFile(previousAudioPath);
    }

    setAudioMessage(`Attached ${uploadResult.audioFilename}.`);
  }

  async function handleRemoveAudio() {
    if (!audioPath && !audioUrl && !audioFilename) {
      return;
    }

    if (!window.confirm('Remove the attached MP3 from this chart?')) {
      return;
    }

    const savedChart = await saveChartRecord();

    if (audioPath) {
      const removeResult = await removeChartAudioFile(audioPath);

      if (!removeResult.ok) {
        setAudioMessage(removeResult.error || 'Could not remove the MP3 from storage.');
        return;
      }
    }

    await saveChartRecord({
      audioFilename: '',
      audioPath: '',
      audioUrl: '',
      id: savedChart.id,
    });
    applyAudioAttachment({ audioFilename: '', audioPath: '', audioUrl: '' });
    setAudioMessage('MP3 removed from this chart.');
  }

  function handleLoadChart() {
    const chart = savedCharts.find((item) => item.id === selectedSavedChartId);
    if (chart) {
      applySnapshot(chart);
      setCurrentChartId(chart.id);
    }
  }

  async function handleDeleteChart() {
    const chart = savedCharts.find((item) => item.id === selectedSavedChartId);

    if (!chart || !window.confirm(`Delete saved chart "${chart.id}"?`)) {
      return;
    }

    const nextCharts = savedCharts.filter((item) => item.id !== chart.id);
    persistSavedCharts(nextCharts);
    setSelectedSavedChartId(nextCharts[0]?.id ?? '');
    setCurrentChartId((currentId) => (currentId === chart.id ? null : currentId));

    if (cloudStatus.connected) {
      const result = await deleteCloudChart(chart.id);

      if (!result.ok) {
        setCloudStatus({ connected: false, label: 'Local Only', message: `Cloud Sync: Local Only. ${result.error}` });
        setCloudMessage('Deleted locally. Cloud delete failed.');
      }
    }
  }

  function handleInsertSymbol(symbol: string) {
    const shouldUseInput = activeTextarea === 'input';
    const textarea = shouldUseInput ? inputRef.current : outputRef.current ?? inputRef.current;
    const currentText = shouldUseInput ? input : output;
    const setText = shouldUseInput ? setInput : setOutput;

    if (!textarea) {
      setOutput((current) => `${current}${symbol}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextText = currentText.slice(0, start) + symbol + currentText.slice(end);
    const nextCaret = symbol === '( )' ? start + 1 : start + symbol.length;

    setText(nextText);

    window.requestAnimationFrame(() => {
      const nextTextarea = shouldUseInput ? inputRef.current : outputRef.current;
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
        <ShareView chart={currentSnapshot()} onPerformanceMode={() => setPerformanceMode(true)} />
      </>
    );
  }

  return (
    <AuthGate>
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

      {isSymbolHelpOpen ? (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-amber-950/40 bg-stone-950 p-5 text-stone-100 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Symbol Help</h2>
                <p className="mt-1 text-sm text-stone-400">Quick reference for Nashville chart marks and rhythm shorthand.</p>
              </div>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setIsSymbolHelpOpen(false)}>
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-stone-300 sm:grid-cols-2">
              <p><span className="font-semibold text-stone-100">◇</span> = hold or ring chord</p>
              <p><span className="font-semibold text-stone-100">^</span> = stop or choke</p>
              <p><span className="font-semibold text-stone-100">&gt; / &lt;</span> = push or anticipation</p>
              <p><span className="font-semibold text-stone-100">%</span> = repeat previous bar</p>
              <p><span className="font-semibold text-stone-100">||: / :||</span> = repeat section</p>
              <p><span className="font-semibold text-stone-100">|</span> = bar line</p>
              <p><span className="font-semibold text-stone-100">/</span> = slash chord or bass note</p>
              <p><span className="font-semibold text-stone-100">- or m</span> = minor chord</p>
              <p><span className="font-semibold text-stone-100">[Intro]</span> = beginning section</p>
              <p><span className="font-semibold text-stone-100">[Break]</span> = bluegrass instrumental feature</p>
              <p><span className="font-semibold text-stone-100">[Banjo Break]</span> = instrument-specific break</p>
              <p><span className="font-semibold text-stone-100">[Fiddle Kickoff]</span> = instrument-specific kickoff</p>
              <p><span className="font-semibold text-stone-100">[Tag]</span> = repeat ending or last line</p>
              <p><span className="font-semibold text-stone-100">[Turnaround]</span> = short phrase leading around</p>
              <p><span className="font-semibold text-stone-100">[A Part] / [B Part]</span> = fiddle tune sections</p>
              <p><span className="font-semibold text-stone-100">1...</span> = whole measure of 1</p>
              <p><span className="font-semibold text-stone-100">1..4</span> = hold 1 for three beats, 4 on beat 4</p>
              <p><span className="font-semibold text-stone-100">1.4.</span> = two beats of 1, two beats of 4</p>
              <p><span className="font-semibold text-stone-100">.</span> = hold previous chord for one beat</p>
            </div>
          </section>
        </div>
      ) : null}

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,_#1c1917_0%,_#0c0a09_48%,_#020617_100%)] px-4 py-8 text-stone-100 sm:px-6 sm:py-12 print:bg-white print:px-0 print:py-0 print:text-black">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 print:max-w-none print:gap-4">
          <div className="no-print space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <BrandHeaderTitle />
                <nav className="flex flex-wrap gap-2">
                  <Link href="/library" className={SECONDARY_BUTTON_CLASS}>
                    Song Library
                  </Link>
                  <Link href="/setlists" className={SECONDARY_BUTTON_CLASS}>
                    Setlists
                  </Link>
                </nav>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-stone-300">
                Build bluegrass-friendly charts with a focused Quick Mode for fast song setup, or switch to Pro Mode when you need the full charting toolkit.
              </p>
              <p className={`inline-flex rounded-xl border px-3 py-2 text-sm ${cloudStatus.connected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
                {cloudStatus.message}
              </p>
              {cloudMessage ? <p className="text-sm text-stone-300">{cloudMessage}</p> : null}
            </div>

            <section className={`${PANEL_CLASS} p-4 sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Workspace Mode</h2>
                  <p className="mt-1 text-xs text-stone-400">Quick Mode keeps the essentials on screen. Pro Mode unlocks the full chart workflow.</p>
                </div>
                <div className="inline-flex rounded-2xl border border-amber-950/30 bg-stone-950/60 p-1">
                  <button
                    type="button"
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${uiMode === 'quick' ? 'bg-amber-400 text-stone-950' : 'text-stone-200 hover:bg-stone-900/80'}`}
                    onClick={() => handleSetUiMode('quick')}
                  >
                    Quick Mode
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${uiMode === 'pro' ? 'bg-emerald-400 text-stone-950' : 'text-stone-200 hover:bg-stone-900/80'}`}
                    onClick={() => handleSetUiMode('pro')}
                  >
                    Pro Mode
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className={`grid gap-6 print:grid-cols-1 ${isQuickMode ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_380px]'}`}>
            <section className={`no-print order-1 space-y-5 ${PANEL_CLASS}`}>
              <SectionCard
                title="Song Setup"
                description="Set the song title, artist, key, and other performance basics."
                isOpen={sectionOpen.songSetup}
                onToggle={() => handleToggleSection('songSetup')}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                    Title
                    <input className={INPUT_CLASS} value={songTitle} onChange={(event) => setSongTitle(event.target.value)} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                    Artist
                    <input className={INPUT_CLASS} value={artist} onChange={(event) => setArtist(event.target.value)} />
                  </label>
                </div>

                <div className={`grid gap-4 ${isQuickMode ? 'sm:grid-cols-2' : 'lg:grid-cols-3'}`}>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                    Key
                    <select className={INPUT_CLASS} value={selectedKey} onChange={(event) => setSelectedKey(event.target.value as KeyName)}>
                      {MAJOR_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                    Time Signature
                    <select className={INPUT_CLASS} value={timeSignature} onChange={(event) => setTimeSignature(event.target.value as TimeSignature)}>
                      {TIME_SIGNATURES.map((signature) => (
                        <option key={signature} value={signature}>
                          {signature}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!isQuickMode ? (
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                      Tempo / BPM
                      <input className={INPUT_CLASS} placeholder="120 BPM" value={tempo} onChange={(event) => setTempo(event.target.value)} />
                    </label>
                  ) : null}
                </div>

                {!isQuickMode ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                      Capo
                      <input className={INPUT_CLASS} inputMode="numeric" placeholder="0" value={capo} onChange={(event) => setCapo(event.target.value.replace(/[^\d]/g, ''))} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                      Feel
                      <select className={INPUT_CLASS} value={feel} onChange={(event) => setFeel(event.target.value)}>
                        {FEEL_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                      Transpose To Key
                      <select className={INPUT_CLASS} value={transposeToKey} onChange={(event) => setTransposeToKey(event.target.value as KeyName)}>
                        {MAJOR_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {key}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="rounded-2xl border border-amber-950/25 bg-amber-500/10 p-4 text-sm leading-6 text-stone-200">
                      <p>
                        <span className="font-medium text-amber-100">Key:</span> {selectedKey}
                      </p>
                      <p>
                        <span className="font-medium text-amber-100">Capo:</span> {capo || '0'}
                      </p>
                      <p>
                        <span className="font-medium text-amber-100">Play In:</span> {playInKey}
                      </p>
                    </div>
                  </div>
                ) : null}
              </SectionCard>


              <SectionCard
                title="Chart Editor"
                description="Paste or type the chord chart, then clean it up, grid it, and convert it."
                isOpen={sectionOpen.chartBuilder}
                onToggle={() => handleToggleSection('chartBuilder')}
              >
                <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                  Chord Input
                  <textarea
                    ref={inputRef}
                    className={`${INPUT_CLASS} min-h-72 font-mono text-sm leading-7 sm:min-h-80`}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onFocus={() => setActiveTextarea('input')}
                    onBlur={() => setInput(normalizeChartInput(input))}
                    spellCheck={false}
                  />
                </label>

                <div className="flex flex-col gap-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4 sm:flex-row sm:items-end sm:justify-between">
                  <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-200">
                    Measure Grid
                    <select className={INPUT_CLASS} value={measureGridStyle} onChange={(event) => setMeasureGridStyle(event.target.value as MeasureGridStyle)}>
                      <option value="off">Off</option>
                      <option value="simple-bars">Simple Bars</option>
                      <option value="beat-dots">Beat Dots</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleAddInputMeasureGrid}>
                      Apply Grid
                    </button>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleRemoveInputMeasureGrid}>
                      Remove Grid
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleSmartPaste}>
                    Smart Paste
                  </button>
                  {!isQuickMode ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleCleanUpInput}>
                      Clean Up Input
                    </button>
                  ) : null}
                  {!isQuickMode ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleTransposeChart}>
                      Transpose Chart
                    </button>
                  ) : null}
                  <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={handleConvert}>
                    Convert
                  </button>
                  <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleSaveChart} disabled={isSaving}>
                    {saveLabel}
                  </button>
                </div>

                {smartPasteMessage ? <p className="text-sm text-zinc-300">{smartPasteMessage}</p> : null}
                {saveStatusMessage ? <p className="text-sm text-stone-300">{saveStatusMessage}</p> : null}

                <p className="text-xs leading-5 text-stone-400">
                  Grid mode makes each measure/bar easier to see. A dot means hold the previous chord for one beat.
                </p>
              </SectionCard>

              <SectionCard
                title="Nashville Output"
                description="Edit the final number chart, then copy it, print it, or take it into performance mode."
                isOpen={sectionOpen.output}
                onToggle={() => handleToggleSection('output')}
                className="no-print"
              >
                <textarea
                  ref={outputRef}
                  className="no-print min-h-[28rem] w-full resize-none overflow-hidden rounded-2xl border border-emerald-900/40 bg-stone-950/85 px-4 py-4 font-mono text-lg leading-8 text-emerald-300 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                  value={output}
                  onChange={(event) => setOutput(event.target.value)}
                  onFocus={() => setActiveTextarea('output')}
                  spellCheck={false}
                />

                {!isQuickMode ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-zinc-200">
                      Output Measure Grid
                      <select className={INPUT_CLASS} value={measureGridStyle} onChange={(event) => setMeasureGridStyle(event.target.value as MeasureGridStyle)}>
                        <option value="off">Off</option>
                        <option value="simple-bars">Simple Bars</option>
                        <option value="beat-dots">Beat Dots</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleAddOutputMeasureGrid}>
                        Apply Grid
                      </button>
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleRemoveOutputMeasureGrid}>
                        Remove Grid
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleSaveChart} disabled={isSaving}>{saveLabel}</button>
                  {hasAttachedAudio ? (
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                      MP3 Attached
                    </span>
                  ) : null}
                  {chartAudioDownloadUrl ? (
                    <a
                      href={chartAudioDownloadUrl}
                      download={audioFilename || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Download MP3
                    </a>
                  ) : null}
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleCopyChart}>{copyLabel}</button>
                  {cloudStatus.connected ? (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleShareView}>
                      {shareLabel}
                    </button>
                  ) : null}
                  <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={() => setPerformanceMode(true)}>Performance Mode</button>
                  <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => window.print()}>Print Chart</button>
                </div>
                {saveStatusMessage ? <p className="text-sm text-stone-300">{saveStatusMessage}</p> : null}
                {chartAudioDownloadUrl && audioFilename.trim() ? (
                  <p className="text-sm text-stone-400">MP3: {audioFilename}</p>
                ) : null}
                {shareUrl ? (
                  showManualShareUrl ? (
                    <input className={INPUT_CLASS} value={shareUrl} readOnly onFocus={(event) => event.target.select()} aria-label="Share link" />
                  ) : (
                    <a href={shareUrl} className="block break-all rounded-2xl border border-amber-950/30 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
                      {shareUrl}
                    </a>
                  )
                ) : null}
                {!cloudStatus.connected ? <p className="text-sm text-stone-400">Cloud sync is required for short share links.</p> : null}
              </SectionCard>

              {!isQuickMode ? (
                <SectionCard
                  title="Save / Library"
                  description="Save charts on this device, recall them quickly, or generate a read-only share link."
                  isOpen={sectionOpen.library}
                  onToggle={() => handleToggleSection('library')}
                >
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleSaveChart} disabled={isSaving}>{saveLabel}</button>
                    {cloudStatus.connected ? (
                      <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleShareView}>
                        {shareLabel}
                      </button>
                    ) : null}
                  </div>
                  {saveStatusMessage ? <p className="text-sm text-stone-300">{saveStatusMessage}</p> : null}

                  {shareUrl ? (
                    showManualShareUrl ? (
                      <input className={INPUT_CLASS} value={shareUrl} readOnly onFocus={(event) => event.target.select()} aria-label="Share link" />
                    ) : (
                      <a href={shareUrl} className="block break-all rounded-2xl border border-amber-950/30 bg-stone-950/60 px-4 py-3 text-sm text-stone-300">
                        {shareUrl}
                      </a>
                    )
                  ) : null}
                  {!cloudStatus.connected ? <p className="text-sm text-stone-400">Cloud sync is required for short share links.</p> : null}

                  <section className="space-y-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-zinc-200">Chart MP3</h3>
                        <p className="mt-1 text-xs text-stone-400">Attach a downloadable MP3 from Supabase Storage.</p>
                      </div>
                      {cloudStatus.connected ? (
                        <div className="flex flex-wrap gap-2">
                          {!hasAttachedAudio ? (
                            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => audioInputRef.current?.click()}>
                              Upload MP3
                            </button>
                          ) : (
                            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => replaceAudioInputRef.current?.click()}>
                              Replace MP3
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {cloudStatus.connected ? (
                      <>
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept=".mp3,audio/mpeg"
                          className="hidden"
                          onChange={(event) => {
                            void handleUploadAudio(event.target.files?.[0] ?? null);
                            event.target.value = '';
                          }}
                        />
                        <input
                          ref={replaceAudioInputRef}
                          type="file"
                          accept=".mp3,audio/mpeg"
                          className="hidden"
                          onChange={(event) => {
                            void handleUploadAudio(event.target.files?.[0] ?? null);
                            event.target.value = '';
                          }}
                        />

                        {hasAttachedAudio ? (
                          <div className="flex flex-col gap-3 rounded-xl border border-amber-950/20 bg-stone-950/55 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-stone-100">{audioFilename || 'Attached MP3'}</p>
                              <p className="mt-1 text-xs text-stone-400">
                                {chartAudioDownloadUrl ? 'Stored in Supabase Storage' : 'Attached MP3 path saved. Reconnect cloud sync to download.'}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {chartAudioDownloadUrl ? (
                                <a
                                  href={chartAudioDownloadUrl}
                                  download={audioFilename || undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={SECONDARY_BUTTON_CLASS}
                                >
                                  Download MP3
                                </a>
                              ) : null}
                              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleRemoveAudio}>
                                Remove MP3
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-stone-400">No MP3 attached to this chart yet.</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-stone-400">MP3 uploads require cloud sync.</p>
                    )}

                    {audioMessage ? <p className="text-sm text-stone-300">{audioMessage}</p> : null}
                  </section>

                  <section className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-medium text-zinc-200">Saved Charts</h3>
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
                        {savedCharts.map((chart) => (
                          <option key={chart.id} value={chart.id}>
                            {savedChartLabel(chart)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-amber-950/40 bg-stone-950/70 px-3 py-2.5 text-base text-zinc-500">
                        Loading saved charts...
                      </div>
                    )}
                  </section>
                </SectionCard>
              ) : null}
            </section>

            <section className={`order-2 ${PANEL_CLASS} ${isQuickMode ? '' : 'xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto'} print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none`}>
              <div className="space-y-3 border-b border-amber-950/30 pb-4 print:hidden print:border-zinc-300">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold text-white print:text-black">{songTitle || 'Untitled Song'}</h2>
                  {hasAttachedAudio ? (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                      MP3
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-2 text-sm text-stone-300 sm:grid-cols-2 lg:grid-cols-3 print:text-black">
                  <p><span className="font-medium text-zinc-100 print:text-black">Artist:</span> {artist || 'N/A'}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Key:</span> {selectedKey}</p>
                  <p><span className="font-medium text-zinc-100 print:text-black">Time:</span> {timeSignature}</p>
                  {!isQuickMode ? <p><span className="font-medium text-zinc-100 print:text-black">Play In:</span> {playInKey}</p> : null}
                  {!isQuickMode ? <p><span className="font-medium text-zinc-100 print:text-black">Tempo:</span> {tempo || 'N/A'}</p> : null}
                  {!isQuickMode ? <p><span className="font-medium text-zinc-100 print:text-black">Capo:</span> {capo || '0'}</p> : null}
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


                {!isQuickMode ? <section className={`${SUBPANEL_CLASS} no-print`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">Symbols & Advanced Tools</h4>
                      <p className="text-xs text-stone-400">Work with chart shorthand, transposition, notes, templates, and advanced Nashville settings.</p>
                    </div>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => handleToggleSection('advanced')}>
                      {sectionOpen.advanced ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {sectionOpen.advanced ? <div className="mt-4 space-y-4">
                    <section className="space-y-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-zinc-200">Symbols & Tags</h4>
                          <p className="text-xs text-stone-400">Insert into the last focused chart field.</p>
                        </div>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleToggleSymbols}>
                          {symbolsExpanded ? 'Hide Symbols' : 'Show Symbols'}
                        </button>
                      </div>
                      {symbolsExpanded ? (
                        <>
                          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                            Category
                            <select className={INPUT_CLASS} value={selectedSymbolCategory} onChange={(event) => handleSetSymbolCategory(event.target.value as SymbolCategory)}>
                              {Object.keys(SYMBOL_CATEGORIES).map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                            {SYMBOL_CATEGORIES[selectedSymbolCategory].map((symbol) => (
                              <button
                                key={`${symbol.label}-${symbol.value}`}
                                type="button"
                                className={`${SECONDARY_BUTTON_CLASS} min-h-10 px-2 py-2 font-mono text-xs`}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleInsertSymbol(symbol.value)}
                              >
                                {symbol.label}
                              </button>
                            ))}
                          </div>
                          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setIsSymbolHelpOpen(true)}>
                            Symbol Help
                          </button>
                        </>
                      ) : null}
                    </section>

                    <section className="space-y-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <h4 className="text-sm font-medium text-zinc-200">Audio Analyze</h4>
                          <p className="text-xs text-stone-400">Audio analysis is experimental. Review results by ear.</p>
                        </div>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setAudioAnalyzeExpanded((current) => !current)}>
                          {audioAnalyzeExpanded ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      {audioAnalyzeExpanded ? (
                        <div className="space-y-3">
                          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                            Audio File
                            <input
                              className={INPUT_CLASS}
                              type="file"
                              accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a"
                              onChange={(event) => handleAudioAnalysisFile(event.target.files?.[0] ?? null)}
                            />
                          </label>

                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void handleAnalyzeAudio()} disabled={!analysisFileName || analysisStatus === 'Analyzing...'}>
                              Analyze Audio
                            </button>
                            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleClearAudioAnalysis}>
                              Clear Audio Analysis
                            </button>
                            <span className="text-sm text-stone-300">{analysisStatus}</span>
                          </div>
                          {analysisStatus === 'Analysis failed' ? (
                            <p className="text-sm text-amber-200">Could not estimate BPM. Enter manually.</p>
                          ) : null}

                          {analysisStatus === 'Analysis complete' ? (
                            <div className="space-y-2 rounded-xl border border-emerald-900/30 bg-emerald-500/10 p-3">
                              <div className="grid gap-2 text-sm text-stone-200 sm:grid-cols-2 xl:grid-cols-1">
                                <p className="truncate"><span className="font-medium text-emerald-100">File:</span> {analysisFileName || 'N/A'}</p>
                                <p><span className="font-medium text-emerald-100">Estimated BPM:</span> {estimatedBpm ? `${estimatedBpm} BPM` : 'N/A'}</p>
                                <p><span className="font-medium text-emerald-100">Estimated Key:</span> {estimatedKey ?? 'N/A'}</p>
                                <p><span className="font-medium text-emerald-100">Time:</span> {analysisTimeSignature || 'No change'}</p>
                              </div>
                              <p className="text-xs text-stone-400">Review by ear. Key detection is experimental. Select the key manually if needed.</p>
                              <div className="flex flex-wrap gap-2">
                                {estimatedBpm ? (
                                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleApplyEstimatedBpm}>
                                    Apply BPM to Chart
                                  </button>
                                ) : null}
                                {estimatedKey ? (
                                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleApplyEstimatedKey}>
                                    Apply Key to Chart
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ) : analysisFileName ? (
                            <p className="truncate text-xs text-stone-400">File: {analysisFileName}</p>
                          ) : null}

                          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                              Manual BPM
                              <input className={INPUT_CLASS} inputMode="numeric" placeholder="120" value={analysisBpm} onChange={(event) => setAnalysisBpm(event.target.value)} />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                              Likely Key
                              <select className={INPUT_CLASS} value={analysisKey} onChange={(event) => setAnalysisKey(event.target.value as KeyName)}>
                                {MAJOR_KEYS.map((key) => (
                                  <option key={key} value={key}>
                                    {key}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                              Time Signature
                              <select className={INPUT_CLASS} value={analysisTimeSignature} onChange={(event) => setAnalysisTimeSignature(event.target.value as TimeSignature | '')}>
                                <option value="">No change</option>
                                {TIME_SIGNATURES.map((signature) => (
                                  <option key={signature} value={signature}>
                                    {signature}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <button type="button" className={EMPHASIS_BUTTON_CLASS} onClick={handleApplyAudioAnalysis}>
                            Apply Manual Values
                          </button>

                          <section className="space-y-3 rounded-xl border border-amber-950/20 bg-stone-950/45 p-3">
                            <div className="space-y-1">
                              <h5 className="text-sm font-medium text-zinc-200">Starter Template</h5>
                              <p className="text-xs text-stone-500">Starter template only; this is not an AI transcription.</p>
                            </div>
                            <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                              Template
                              <select className={INPUT_CLASS} value={selectedStarterTemplate} onChange={(event) => handleSetStarterTemplate(event.target.value as StarterTemplateName)}>
                                {Object.keys(STARTER_TEMPLATES).map((templateName) => (
                                  <option key={templateName} value={templateName}>
                                    {templateName}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleInsertStarterTemplate}>
                                Insert Template
                              </button>
                              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleAppendStarterTemplate}>
                                Append Template
                              </button>
                            </div>
                          </section>
                        </div>
                      ) : null}
                    </section>

                    <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
                      Notes
                      <textarea
                        className={`${INPUT_CLASS} min-h-24 text-sm leading-6`}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Arrangement notes, breaks, endings, or reminders for the band."
                      />
                    </label>

                    <section className="space-y-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-zinc-200">Templates</h4>
                          <p className="mt-1 text-xs text-zinc-400">Optional song-form starters.</p>
                        </div>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setTemplatesExpanded((current) => !current)}>
                          {templatesExpanded ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {templatesExpanded ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(TEMPLATE_PRESETS).map((name) => (
                            <button key={name} type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => handleInsertTemplate(name)}>
                              {name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </section>

                    <section className="space-y-3 rounded-2xl border border-amber-950/20 bg-black/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="text-sm font-medium text-zinc-200">Rare Settings</h4>
                          <p className="mt-1 text-xs text-zinc-400">Chart style and transposition tools.</p>
                        </div>
                        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={handleTransposeChart}>
                          Transpose
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-950/30 bg-stone-950/45 px-4 py-3 text-sm text-zinc-200">
                          <input type="radio" name="chart-mode" value="simple" checked={chartMode === 'simple'} onChange={() => setChartMode('simple')} className="mt-1" />
                          <span>Simple Bluegrass Mode</span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-950/30 bg-stone-950/45 px-4 py-3 text-sm text-zinc-200">
                          <input type="radio" name="chart-mode" value="strict" checked={chartMode === 'strict'} onChange={() => setChartMode('strict')} className="mt-1" />
                          <span>Strict Nashville Mode</span>
                        </label>
                      </div>
                      <p className="text-xs leading-5 text-zinc-400">
                        Simple mode is designed for quick band charts. Strict mode follows chromatic Nashville theory.
                      </p>
                    </section>
                  </div> : null}
                </section> : null}

                <div className="print-only print-chart-text -mt-1 text-black">
                  <ChartLines text={printChartText} />
                </div>

                {notes.trim() ? (
                  <section className="print-only text-black">
                    <h4 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-zinc-100 print:mb-1 print:text-black">Notes</h4>
                    <p className="whitespace-pre-wrap leading-7 print:leading-5">{notes}</p>
                  </section>
                ) : null}

              </div>
            </section>
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
