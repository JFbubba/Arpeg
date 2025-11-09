export type ScaleType = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'majorPentatonic' | 'minorPentatonic' | 'chromatic';

export type ArpPattern = 'up' | 'down' | 'upDown' | 'random';

// Standard MIDIMessageEvent interface
export interface MIDIMessageEvent extends Event {
  data: Uint8Array;
}

export interface MIDIInput {
  id: string;
  name?: string;
  manufacturer?: string;
  onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
  addEventListener: (type: 'midimessage', listener: (event: MIDIMessageEvent) => void) => void;
  removeEventListener: (type: 'midimessage', listener: (event: MIDIMessageEvent) => void) => void;
}

export interface MIDIOutput {
  id: string;
  name?: string;
  manufacturer?: string;
  send: (message: number[] | Uint8Array, timestamp?: number) => void;
}

export interface MIDIAccess {
  inputs: ReadonlyMap<string, MIDIInput>;
  outputs: ReadonlyMap<string, MIDIOutput>;
}
