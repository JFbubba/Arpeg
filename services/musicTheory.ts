
import { ScaleType, ArpPattern } from '../types';
import { SCALE_INTERVALS } from '../constants';

export const generateArpeggio = (
  rootNote: number,
  scaleType: ScaleType,
  pattern: ArpPattern,
  octaves: number
): number[] => {
  const intervals = SCALE_INTERVALS[scaleType];
  if (!intervals) return [];

  let notes: number[] = [];
  for (let o = 0; o < octaves; o++) {
    for (const interval of intervals) {
      const note = rootNote + o * 12 + interval;
      if (note <= 127) {
        notes.push(note);
      }
    }
  }
   // Add the root note of the next octave to resolve the scale
  const finalNote = rootNote + octaves * 12;
  if(finalNote <= 127) notes.push(finalNote);


  switch (pattern) {
    case 'up':
      return notes;
    case 'down':
      return notes.slice().reverse();
    case 'upDown':
      return [...notes, ...notes.slice(1, -1).reverse()];
    case 'random':
      return notes.slice().sort(() => Math.random() - 0.5);
    default:
      return notes;
  }
};
