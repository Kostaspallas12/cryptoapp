import type { Note } from '../store/user';

/** How a note's idea played out: % move since the note and whether the call was right.
    right = null for neutral notes or when the move is too small to judge (< 0.5%). */
export function noteOutcome(note: Pick<Note, 'price' | 'sentiment'>, priceNow: number | null | undefined) {
  if (!priceNow || !note.price) return { change: null, right: null as boolean | null };
  const change = ((priceNow - note.price) / note.price) * 100;
  if (note.sentiment === 'neutral' || Math.abs(change) < 0.5) return { change, right: null as boolean | null };
  return { change, right: note.sentiment === 'bullish' ? change > 0 : change < 0 };
}

export const SENTIMENT_ICON = { bullish: '▲', bearish: '▼', neutral: '●' } as const;
export const SENTIMENT_CLASS = { bullish: 'up', bearish: 'down', neutral: 'flat' } as const;
