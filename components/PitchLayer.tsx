
import React from 'react';
import { PITCH_DIMENSIONS, PITCH_COLORS } from '../constants';

const PitchLayer: React.FC = () => {
  const { width, height } = PITCH_DIMENSIONS;
  const lineStyle = { stroke: PITCH_COLORS.lines, strokeWidth: 2, fill: 'none' };

  return (
    <g id="pitch-markings">
      {/* Outer Boundary */}
      <rect x="0" y="0" width={width} height={height} style={lineStyle} />
      
      {/* Center Line */}
      <line x1={width/2} y1="0" x2={width/2} y2={height} style={lineStyle} />
      
      {/* Center Circle */}
      <circle cx={width/2} cy={height/2} r="70" style={lineStyle} />
      <circle cx={width/2} cy={height/2} r="2" fill={PITCH_COLORS.lines} />

      {/* Penalty Areas */}
      {/* Left */}
      <rect x="0" y={height/2 - 150} width="130" height="300" style={lineStyle} />
      <rect x="0" y={height/2 - 70} width="50" height="140" style={lineStyle} />
      <path d={`M 130 ${height/2 - 40} Q 170 ${height/2} 130 ${height/2 + 40}`} style={lineStyle} />
      
      {/* Right */}
      <rect x={width - 130} y={height/2 - 150} width="130" height="300" style={lineStyle} />
      <rect x={width - 50} y={height/2 - 70} width="50" height="140" style={lineStyle} />
      <path d={`M ${width - 130} ${height/2 - 40} Q ${width - 170} ${height/2} ${width - 130} ${height/2 + 40}`} style={lineStyle} />

      {/* Corners */}
      <path d="M 0 15 A 15 15 0 0 0 15 0" style={lineStyle} />
      <path d={`M ${width - 15} 0 A 15 15 0 0 0 ${width} 15`} style={lineStyle} />
      <path d={`M 0 ${height - 15} A 15 15 0 0 1 15 ${height}`} style={lineStyle} />
      <path d={`M ${width - 15} ${height} A 15 15 0 0 1 ${width} ${height - 15}`} style={lineStyle} />
    </g>
  );
};

export default PitchLayer;
