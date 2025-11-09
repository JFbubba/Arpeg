import React from 'react';
import { NOTE_NAMES } from '../constants';

interface MidiVisualizerProps {
  activeNotes: Set<number>;
  baseNote?: number;
  numKeys?: number;
}

const KEY_LAYOUT = [
  { isBlack: false }, { isBlack: true }, { isBlack: false }, { isBlack: true }, { isBlack: false },
  { isBlack: false }, { isBlack: true }, { isBlack: false }, { isBlack: true }, { isBlack: false },
  { isBlack: true }, { isBlack: false },
];

const MidiVisualizer: React.FC<MidiVisualizerProps> = ({ activeNotes, baseNote = 48, numKeys = 24 }) => {
  const notesToShow = Array.from({ length: numKeys }, (_, i) => baseNote + i);

  return (
    <div className="relative flex h-32 w-max p-1 bg-gray-700 rounded-lg shadow-inner overflow-hidden">
      {/* White Keys */}
      <div className="flex">
        {notesToShow.filter(n => !KEY_LAYOUT[n % 12].isBlack).map(noteNumber => {
          const isActive = activeNotes.has(noteNumber);
          const noteName = NOTE_NAMES[noteNumber % 12];
          const octave = Math.floor(noteNumber / 12);
          return (
            <div
              key={noteNumber}
              className={`relative h-full w-10 border-2 border-gray-600 rounded-b-md bg-gray-200 transition-colors duration-50 ${isActive ? 'bg-cyan-400 border-cyan-200' : ''}`}
            >
              {noteNumber % 12 === 0 && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm text-gray-800 font-semibold">
                  {noteName}{octave}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {/* Black Keys */}
      <div className="absolute top-0 left-0 h-20 pointer-events-none">
        {notesToShow.filter(n => KEY_LAYOUT[n % 12].isBlack).map(noteNumber => {
          const whiteKeysBefore = notesToShow.slice(0, noteNumber - baseNote).filter(n => !KEY_LAYOUT[n % 12].isBlack).length;
          const isActive = activeNotes.has(noteNumber);
          return (
            <div
              key={noteNumber}
              className={`absolute h-full w-6 bg-gray-800 border-2 border-gray-600 rounded-b-md z-10 transition-colors duration-50 ${isActive ? 'bg-orange-500 border-orange-300' : ''}`}
              style={{ left: `${whiteKeysBefore * 2.5 - 0.75}rem` }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MidiVisualizer;
