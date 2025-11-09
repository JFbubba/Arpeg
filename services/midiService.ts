import { MIDIAccess, MIDIInput, MIDIOutput } from '../types';

interface MidiDevices {
  inputs: MIDIInput[];
  outputs: MIDIOutput[];
}

export const requestMidiAccess = async (): Promise<MidiDevices> => {
  const devices: MidiDevices = { inputs: [], outputs: [] };
  if (navigator.requestMIDIAccess) {
    try {
      const midiAccess: MIDIAccess = await navigator.requestMIDIAccess();
      devices.inputs = Array.from(midiAccess.inputs.values());
      devices.outputs = Array.from(midiAccess.outputs.values());
      return devices;
    } catch (error) {
      console.error("Could not access your MIDI devices.", error);
      return devices;
    }
  } else {
    console.warn("Web MIDI API is not supported in this browser.");
    return devices;
  }
};

export const sendNote = (
  output: MIDIOutput,
  note: number,
  velocity = 100,
  duration = 100
) => {
  if (!output || note < 0 || note > 127) return;

  const noteOnMessage = [0x90, note, velocity]; // note on, channel 1
  const noteOffMessage = [0x80, note, 0]; // note off, channel 1

  output.send(noteOnMessage);
  setTimeout(() => {
    output.send(noteOffMessage);
  }, duration);
};
