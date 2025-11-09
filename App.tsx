import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ScaleType, ArpPattern, MIDIOutput, MIDIInput, MIDIMessageEvent } from './types';
import { NUM_STEPS, NOTE_NAMES, SCALE_INTERVALS } from './constants';
import { generateArpeggio } from './services/musicTheory';
import { requestMidiAccess, sendNote } from './services/midiService';
import CircularSequencer from './components/CircularSequencer';
import MidiVisualizer from './components/MidiVisualizer';

// Helper component for styled select dropdowns
const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({ label, children, ...props }) => (
    <div className="flex flex-col">
        <label className="text-xs text-gray-400 mb-1">{label}</label>
        <select {...props} className="bg-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed">
            {children}
        </select>
    </div>
);

const App: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [bpm, setBpm] = useState<number>(120);
    const [steps, setSteps] = useState<boolean[]>(Array(NUM_STEPS).fill(false));
    const [accentSteps, setAccentSteps] = useState<boolean[]>(Array(NUM_STEPS).fill(false));
    const [currentStep, setCurrentStep] = useState<number>(0);
    
    const [midiOutputs, setMidiOutputs] = useState<MIDIOutput[]>([]);
    const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
    const [midiInputs, setMidiInputs] = useState<MIDIInput[]>([]);
    const [selectedInputId, setSelectedInputId] = useState<string | null>(null);
    const [syncSource, setSyncSource] = useState<'internal' | 'midi'>('internal');
    const [activeMidiNotes, setActiveMidiNotes] = useState<Set<number>>(new Set());

    const [rootNote, setRootNote] = useState<number>(60); // C4
    const [scaleType, setScaleType] = useState<ScaleType>('major');
    const [arpPattern, setArpPattern] = useState<ArpPattern>('up');
    const [octaves, setOctaves] = useState<number>(2);
    const [velocity, setVelocity] = useState<number>(100);

    const [arpNotes, setArpNotes] = useState<number[]>([]);

    const [geminiPrompt, setGeminiPrompt] = useState<string>('a basic four-on-the-floor kick pattern');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    
    const arpNoteIndexRef = useRef<number>(0);
    const timerIdRef = useRef<number | null>(null);
    const tickCounterRef = useRef<number>(0);

    useEffect(() => {
        const initMidi = async () => {
            const { inputs, outputs } = await requestMidiAccess();
            setMidiInputs(inputs);
            setMidiOutputs(outputs);
            if (inputs.length > 0) setSelectedInputId(inputs[0].id);
            if (outputs.length > 0) setSelectedOutputId(outputs[0].id);
        };
        initMidi();
    }, []);

    useEffect(() => {
        const notes = generateArpeggio(rootNote, scaleType, arpPattern, octaves);
        setArpNotes(notes);
        arpNoteIndexRef.current = 0;
    }, [rootNote, scaleType, arpPattern, octaves]);

    const advanceStep = useCallback(() => {
        setCurrentStep(prev => (prev + 1) % NUM_STEPS);
    }, []);

    // Effect for handling INTERNAL clock timing
    useEffect(() => {
        if (isPlaying && syncSource === 'internal') {
            const interval = 60000 / bpm / 4; // 16th notes
            timerIdRef.current = window.setInterval(advanceStep, interval);
            return () => {
                if (timerIdRef.current) clearInterval(timerIdRef.current);
            };
        } else {
            if (timerIdRef.current) clearInterval(timerIdRef.current);
        }
    }, [isPlaying, bpm, syncSource, advanceStep]);

    // Effect for playing a note whenever the current step changes while playing
    useEffect(() => {
        if (!isPlaying) return;

        const selectedOutput = midiOutputs.find(o => o.id === selectedOutputId);
        if (!selectedOutput || arpNotes.length === 0) return;

        if (steps[currentStep]) {
            const noteToPlay = arpNotes[arpNoteIndexRef.current % arpNotes.length];
            const duration = syncSource === 'internal' ? (60000 / bpm) / 2 : 100;
            const noteVelocity = accentSteps[currentStep] ? 127 : velocity;
            sendNote(selectedOutput, noteToPlay, noteVelocity, duration);
            arpNoteIndexRef.current++;
        }
    }, [currentStep, isPlaying, steps, accentSteps, selectedOutputId, midiOutputs, arpNotes, syncSource, bpm, velocity]);
    
    // Effect for handling MIDI CLOCK input
    useEffect(() => {
        const selectedInput = midiInputs.find(i => i.id === selectedInputId);

        const handleMidiMessage = (event: MIDIMessageEvent) => {
            const [command, note, velocity] = event.data;

            const cmd = command & 0xf0;

            if (cmd === 0x90) { // Note On
                if (velocity > 0) {
                    setActiveMidiNotes(prev => new Set(prev).add(note));
                } else { // Velocity 0 is Note Off
                    setActiveMidiNotes(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(note);
                        return newSet;
                    });
                }
            } else if (cmd === 0x80) { // Note Off
                setActiveMidiNotes(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(note);
                    return newSet;
                });
            }


            switch (command) {
                case 0xF8: // Clock tick
                    tickCounterRef.current++;
                    if (tickCounterRef.current >= 6) { // 24 PPQN / 4 = 6 ticks per 16th note
                        tickCounterRef.current = 0;
                        advanceStep();
                    }
                    break;
                case 0xFA: // Start
                    setCurrentStep(0);
                    arpNoteIndexRef.current = 0;
                    tickCounterRef.current = 0;
                    setIsPlaying(true);
                    break;
                case 0xFB: // Continue
                     setIsPlaying(true);
                    break;
                case 0xFC: // Stop
                    setIsPlaying(false);
                    tickCounterRef.current = 0;
                    break;
            }
        };

        if (syncSource === 'midi' && selectedInput) {
            selectedInput.addEventListener('midimessage', handleMidiMessage);
            return () => {
                selectedInput.removeEventListener('midimessage', handleMidiMessage);
                setActiveMidiNotes(new Set()); // Clear notes when input changes
            };
        }
    }, [syncSource, selectedInputId, midiInputs, advanceStep]);

    const handlePlayToggle = () => {
        if (syncSource === 'midi') return; // Do nothing if externally synced
        if (!isPlaying) {
            setCurrentStep(0);
            arpNoteIndexRef.current = 0;
        }
        setIsPlaying(prev => !prev);
    };

    const handleStepToggle = (index: number) => {
        const newSteps = [...steps];
        newSteps[index] = !newSteps[index];
        setSteps(newSteps);
    };

    const handleStepAccentToggle = (index: number) => {
        const newAccentSteps = [...accentSteps];
        newAccentSteps[index] = !newAccentSteps[index];
        setAccentSteps(newAccentSteps);
    };

    const handleClear = () => {
        setSteps(Array(NUM_STEPS).fill(false));
        setAccentSteps(Array(NUM_STEPS).fill(false));
    }
    
    const handleSyncSourceChange = (source: 'internal' | 'midi') => {
        setIsPlaying(false); // Stop playback when changing source
        setCurrentStep(0);
        setSyncSource(source);
    }

    const handleGeneratePattern = async () => {
        if (!geminiPrompt.trim()) return;
        setIsGenerating(true);
        setGenerationError(null);
    
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
        const schema = {
            type: Type.OBJECT,
            properties: {
                steps: {
                    type: Type.ARRAY,
                    description: 'A 16-element array of booleans representing the active steps.',
                    items: { type: Type.BOOLEAN }
                },
                accentSteps: {
                    type: Type.ARRAY,
                    description: 'A 16-element array of booleans representing the accented steps. Accents should mostly be on active steps.',
                     items: { type: Type.BOOLEAN }
                }
            },
            required: ['steps', 'accentSteps']
        };
    
        const prompt = `You are a creative rhythm assistant for a 16-step sequencer. Based on the user's request, generate a 16-step pattern and a corresponding accent pattern.
        - "steps" should be an array of 16 booleans, where true means the step is active.
        - "accentSteps" should also be an array of 16 booleans, where true means the step is accented.
        - Ensure both arrays have exactly 16 elements.
        - Return a valid JSON object matching the required schema.
    
        User request: "${geminiPrompt}"`;
    
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                },
            });
    
            const jsonString = response.text.trim();
            const result = JSON.parse(jsonString);
    
            if (result.steps && Array.isArray(result.steps) && result.steps.length === NUM_STEPS &&
                result.accentSteps && Array.isArray(result.accentSteps) && result.accentSteps.length === NUM_STEPS) {
                setSteps(result.steps);
                setAccentSteps(result.accentSteps);
            } else {
                throw new Error('Invalid pattern format received from AI.');
            }
    
        } catch (error) {
            console.error("Error generating pattern:", error);
            const errorMessage = 'Failed to generate pattern. Please try again.';
            setGenerationError(errorMessage);
            alert(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-5xl mx-auto bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8">
                <div className="flex-1 flex flex-col items-center justify-center">
                    <h1 className="text-3xl font-bold text-cyan-400 mb-4">MIDI Arpeggiator</h1>
                    <CircularSequencer
                        steps={steps}
                        accentSteps={accentSteps}
                        currentStep={currentStep}
                        onStepToggle={handleStepToggle}
                        onStepAccentToggle={handleStepAccentToggle}
                        isPlaying={isPlaying}
                    />
                </div>

                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-6">
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-3 text-cyan-300 border-b border-gray-700 pb-2">Master</h2>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handlePlayToggle}
                                disabled={syncSource === 'midi'}
                                className={`px-6 py-2 rounded-md font-bold text-lg transition-colors ${
                                    isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                                } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                            >
                                {isPlaying ? 'Stop' : 'Play'}
                            </button>
                            <div className="flex-1 flex flex-col">
                                <label htmlFor="bpm" className="text-xs text-gray-400">BPM</label>
                                <div className={`flex items-center gap-2 ${syncSource === 'midi' ? 'opacity-50' : ''}`}>
                                <input
                                    type="range"
                                    id="bpm"
                                    min="40"
                                    max="240"
                                    value={bpm}
                                    disabled={syncSource === 'midi'}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span className="text-lg font-mono w-12 text-center">{syncSource === 'midi' ? 'EXT' : bpm}</span>
                                </div>
                            </div>
                        </div>
                         <div className="mt-4">
                           <SelectInput label="MIDI Output" value={selectedOutputId || ''} onChange={e => setSelectedOutputId(e.target.value)} disabled={midiOutputs.length === 0}>
                                {midiOutputs.length > 0 ? (
                                    midiOutputs.map(output => <option key={output.id} value={output.id}>{output.name}</option>)
                                ) : (
                                    <option>No MIDI devices found</option>
                                )}
                            </SelectInput>
                        </div>
                    </div>

                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-3 text-cyan-300 border-b border-gray-700 pb-2">Sync</h2>
                         <div className="grid grid-cols-2 gap-4">
                              <SelectInput label="Source" value={syncSource} onChange={e => handleSyncSourceChange(e.target.value as 'internal' | 'midi')}>
                                <option value="internal">Internal</option>
                                <option value="midi">MIDI</option>
                              </SelectInput>
                               <SelectInput label="MIDI Clock Input" value={selectedInputId || ''} onChange={e => setSelectedInputId(e.target.value)} disabled={syncSource === 'internal' || midiInputs.length === 0}>
                                {midiInputs.length > 0 ? (
                                    midiInputs.map(input => <option key={input.id} value={input.id}>{input.name}</option>)
                                ) : (
                                    <option>No MIDI inputs</option>
                                )}
                            </SelectInput>
                        </div>
                    </div>
                    
                    {syncSource === 'midi' && (
                        <div className="bg-gray-900/50 p-4 rounded-lg">
                            <h2 className="text-lg font-semibold mb-3 text-cyan-300 border-b border-gray-700 pb-2">MIDI Input Monitor</h2>
                             <div className="flex justify-center items-center pt-2">
                                <MidiVisualizer activeNotes={activeMidiNotes} baseNote={48} numKeys={24} />
                             </div>
                        </div>
                    )}

                     <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-3 text-cyan-300 border-b border-gray-700 pb-2">Sequencer</h2>
                          <div className="flex flex-col gap-3">
                            <div>
                                <label htmlFor="gemini-prompt" className="text-xs text-gray-400 mb-1 block">Generate with AI</label>
                                <textarea
                                    id="gemini-prompt"
                                    rows={2}
                                    value={geminiPrompt}
                                    onChange={(e) => setGeminiPrompt(e.target.value)}
                                    placeholder="e.g., a syncopated hi-hat pattern"
                                    className="w-full bg-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                                    disabled={isGenerating}
                                />
                            </div>
                            <button
                                onClick={handleGeneratePattern}
                                disabled={isGenerating || !geminiPrompt.trim()}
                                className="w-full bg-cyan-600 hover:bg-cyan-700 text-sm py-2 rounded-md transition-colors font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating...
                                    </>
                                ) : (
                                    'Generate Pattern'
                                )}
                            </button>
                            <button onClick={handleClear} className="w-full bg-gray-600 hover:bg-gray-700 text-sm py-2 rounded-md transition-colors">Clear Pattern</button>
                            {generationError && <p className="text-xs text-red-400 mt-1 text-center">{generationError}</p>}
                        </div>
                    </div>

                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h2 className="text-lg font-semibold mb-3 text-cyan-300 border-b border-gray-700 pb-2">Arpeggiator</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <SelectInput label="Root Note" value={rootNote} onChange={e => setRootNote(Number(e.target.value))}>
                                {NOTE_NAMES.map((name, i) => (
                                    <option key={i} value={60 + i}>{name}</option>
                                ))}
                            </SelectInput>
                            <SelectInput label="Scale" value={scaleType} onChange={e => setScaleType(e.target.value as ScaleType)}>
                                {Object.keys(SCALE_INTERVALS).map(key => (
                                    <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim()}</option>
                                ))}
                            </SelectInput>
                            <SelectInput label="Pattern" value={arpPattern} onChange={e => setArpPattern(e.target.value as ArpPattern)}>
                                <option value="up">Up</option>
                                <option value="down">Down</option>
                                <option value="upDown">Up/Down</option>
                                <option value="random">Random</option>
                            </SelectInput>
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-400 mb-1">Octaves</label>
                                <input type="number" min="1" max="4" value={octaves} onChange={e => setOctaves(Number(e.target.value))} className="bg-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full" />
                            </div>
                        </div>
                         <div className="mt-4">
                            <label className="text-xs text-gray-400 mb-1">Velocity</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="1"
                                    max="127"
                                    value={velocity}
                                    onChange={e => setVelocity(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-lg font-mono w-12 text-center">{velocity}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;