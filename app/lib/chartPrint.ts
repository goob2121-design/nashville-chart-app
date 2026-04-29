export type PrintableChartData = {
  audioFilename?: string;
  audioPath?: string;
  audioUrl?: string;
  artist?: string;
  capo?: string;
  chartMode?: string;
  chordChart?: string;
  feel?: string;
  key?: string;
  nashvilleChart?: string;
  notes?: string;
  tempo?: string;
  timeSignature?: string;
  title?: string;
};

export function serializePrintableChart(chart: PrintableChartData): string {
  return encodeURIComponent(JSON.stringify(chart));
}

export function deserializePrintableChart(value: string): PrintableChartData | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as PrintableChartData;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function createSectionSeparator(line: string): string {
  const bracketMatch = line.match(/^\[(.+)\]$/);
  return bracketMatch ? `--- ${bracketMatch[1]} ---` : line;
}

export function isReferenceTag(line: string): boolean {
  return /^\[(?:Same as .+|V2 = V1|V3 = V1|Ch2 = Ch1|Solo = Verse|Break = Chorus|Outro = Intro|Outro = Chorus Tag|Last Line Chorus|Last 2 Lines Chorus|Verse Chords|Chorus Chords|Kick on 5|Stop on 1|Build|Half-time|Walk Up|N\.C\.|Cold End|Fade|Hold Last 1|Run Out|Repeat to End|x2|x3|Kickoff|Full Band Kickoff|Banjo Kickoff|Guitar Kickoff|Mandolin Kickoff|Fiddle Kickoff|Dobro Kickoff|Banjo Break|Guitar Break|Mandolin Break|Fiddle Break|Dobro Break|Bass Break|Instrumental Break|Dobro Solo|Mando Chop In|Harmony In|Tag Last Line|Tag Last Line x2|Tag Chorus|Tag Chorus x2|Tag Last Line Chorus|Tag Last Line Chorus x2)\]$/i.test(
    line.trim()
  );
}

export function getPrintableChartText(chart: PrintableChartData): string {
  return chart.nashvilleChart?.trim() || chart.chordChart?.trim() || 'No chart entered.';
}
