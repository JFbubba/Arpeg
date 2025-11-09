import React from 'react';
import { NUM_STEPS } from '../constants';

interface CircularSequencerProps {
  steps: boolean[];
  accentSteps: boolean[];
  currentStep: number;
  onStepToggle: (index: number) => void;
  onStepAccentToggle: (index: number) => void;
  isPlaying: boolean;
}

const CircularSequencer: React.FC<CircularSequencerProps> = ({ steps, accentSteps, currentStep, onStepToggle, onStepAccentToggle, isPlaying }) => {
  const svgSize = 400;
  const center = svgSize / 2;
  const radius = svgSize / 2 - 30;

  const getStepPosition = (index: number) => {
    const angle = (index / NUM_STEPS) * 2 * Math.PI - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return { x, y };
  };

  const handleAccentToggle = (e: React.MouseEvent, index: number) => {
    e.preventDefault(); // Prevent browser context menu
    onStepAccentToggle(index);
  }

  return (
    <div className="relative flex items-center justify-center">
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#374151" strokeWidth="2" />
        {steps.map((isActive, index) => {
          const { x, y } = getStepPosition(index);
          const isCurrent = index === currentStep && isPlaying;
          const isAccented = accentSteps[index];
          const stepRadius = isCurrent ? 18 : 12;

          // Determine fill color based on state
          let fillColor = 'fill-gray-700'; // Inactive
          if (isActive) {
            if (isAccented) {
              fillColor = isCurrent ? 'fill-orange-400' : 'fill-orange-600'; // Accented
            } else {
              fillColor = isCurrent ? 'fill-yellow-400' : 'fill-cyan-400'; // Active
            }
          } else if (isCurrent) {
            fillColor = 'fill-yellow-600'; // Current but inactive
          }

          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={stepRadius}
              className={`cursor-pointer transition-all duration-150 ${fillColor} hover:opacity-80`}
              onClick={() => onStepToggle(index)}
              onContextMenu={(e) => handleAccentToggle(e, index)}
            />
          );
        })}
      </svg>
       <div className="absolute text-center text-gray-500 text-xs">
          <p>Click to toggle step</p>
          <p>Right-click for accent</p>
        </div>
    </div>
  );
};

export default CircularSequencer;