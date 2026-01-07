
import { Team, Player, Point } from './types';

export const PITCH_COLORS = {
  grass: '#1a4d2e',
  lines: 'rgba(255, 255, 255, 0.7)',
  home: '#ef4444', // red
  away: '#3b82f6', // blue
  highlight: '#fbbf24', // yellow
  ball: '#ffffff', // white
};

export const PITCH_DIMENSIONS = {
  width: 1000,
  height: 650,
  padding: 50,
};

export const PLAYER_RADIUS = 18;
export const BALL_RADIUS = 10;

const getAwayPos = (x: number, y: number): Point => ({ x: 1000 - x, y });

export const FORMATION_TEMPLATES: Record<string, Point[]> = {
  '4-3-3': [
    { x: 50, y: 325 }, // GK
    { x: 200, y: 100 }, { x: 180, y: 250 }, { x: 180, y: 400 }, { x: 200, y: 550 }, // DEF
    { x: 350, y: 325 }, { x: 450, y: 200 }, { x: 450, y: 450 }, // MID
    { x: 650, y: 120 }, { x: 650, y: 530 }, { x: 750, y: 325 }  // FWD
  ],
  '4-4-2': [
    { x: 50, y: 325 }, // GK
    { x: 200, y: 100 }, { x: 180, y: 250 }, { x: 180, y: 400 }, { x: 200, y: 550 }, // DEF
    { x: 400, y: 100 }, { x: 380, y: 250 }, { x: 380, y: 400 }, { x: 400, y: 550 }, // MID
    { x: 700, y: 250 }, { x: 700, y: 400 } // FWD
  ],
  '4-2-3-1': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 100 }, { x: 160, y: 250 }, { x: 160, y: 400 }, { x: 180, y: 550 }, // DEF
    { x: 320, y: 250 }, { x: 320, y: 400 }, // DM
    { x: 500, y: 325 }, { x: 500, y: 120 }, { x: 500, y: 530 }, // AM
    { x: 750, y: 325 } // ST
  ],
  '3-5-2': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 180 }, { x: 160, y: 325 }, { x: 180, y: 470 }, // DEF
    { x: 350, y: 325 }, { x: 420, y: 100 }, { x: 420, y: 550 }, { x: 450, y: 220 }, { x: 450, y: 430 }, // MID
    { x: 720, y: 250 }, { x: 720, y: 400 } // FWD
  ],
  '5-4-1': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 80 }, { x: 160, y: 200 }, { x: 150, y: 325 }, { x: 160, y: 450 }, { x: 180, y: 570 }, // DEF
    { x: 380, y: 150 }, { x: 350, y: 270 }, { x: 350, y: 380 }, { x: 380, y: 500 }, // MID
    { x: 750, y: 325 } // FWD
  ],
  '4-1-4-1': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 100 }, { x: 160, y: 250 }, { x: 160, y: 400 }, { x: 180, y: 550 }, // DEF
    { x: 300, y: 325 }, // DM
    { x: 480, y: 150 }, { x: 480, y: 270 }, { x: 480, y: 380 }, { x: 480, y: 500 }, // MID
    { x: 750, y: 325 } // ST
  ],
  '3-4-3': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 180 }, { x: 160, y: 325 }, { x: 180, y: 470 }, // DEF
    { x: 380, y: 100 }, { x: 360, y: 250 }, { x: 360, y: 400 }, { x: 380, y: 550 }, // MID
    { x: 650, y: 150 }, { x: 650, y: 500 }, { x: 750, y: 325 } // FWD
  ],
  '5-3-2': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 80 }, { x: 160, y: 200 }, { x: 150, y: 325 }, { x: 160, y: 450 }, { x: 180, y: 570 }, // DEF
    { x: 400, y: 200 }, { x: 380, y: 325 }, { x: 400, y: 450 }, // MID
    { x: 720, y: 250 }, { x: 720, y: 400 } // FWD
  ],
  '4-3-2-1': [
    { x: 50, y: 325 }, // GK
    { x: 180, y: 100 }, { x: 160, y: 250 }, { x: 160, y: 400 }, { x: 180, y: 550 }, // DEF
    { x: 380, y: 200 }, { x: 350, y: 325 }, { x: 380, y: 450 }, // MID
    { x: 550, y: 250 }, { x: 550, y: 400 }, // AM
    { x: 750, y: 325 } // ST
  ]
};

export const getInitialPlayers = (): Player[] => [
  ...FORMATION_TEMPLATES['4-3-3'].map((pos, i) => ({
    id: `h${i + 1}`,
    team: Team.HOME,
    number: [1, 2, 4, 5, 3, 6, 8, 10, 7, 11, 9][i],
    name: i === 0 ? 'Home GK' : `Player ${[1, 2, 4, 5, 3, 6, 8, 10, 7, 11, 9][i]}`,
    role: ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RW', 'LW', 'ST'][i],
    status: 'on-field' as const,
    position: { ...pos },
    isGoalie: i === 0
  })),
  ...FORMATION_TEMPLATES['4-3-3'].map((pos, i) => ({
    id: `a${i + 1}`,
    team: Team.AWAY,
    number: [1, 2, 4, 5, 3, 6, 8, 10, 7, 11, 9][i],
    name: i === 0 ? 'Away GK' : `Player ${[1, 2, 4, 5, 3, 6, 8, 10, 7, 11, 9][i]}`,
    role: ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RW', 'LW', 'ST'][i],
    status: 'on-field' as const,
    position: getAwayPos(pos.x, pos.y),
    isGoalie: i === 0
  }))
];

export const INITIAL_FORMATIONS = {
  HOME: getInitialPlayers().filter(p => p.team === Team.HOME),
  AWAY: getInitialPlayers().filter(p => p.team === Team.AWAY)
};
