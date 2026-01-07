
export type Point = { x: number; y: number };

export enum Tool {
    SELECT = 'select',
    PEN = 'pen',
    ARROW = 'arrow',
    TRIANGLE = 'triangle',
    ERASER = 'eraser',
    LINK = 'link'
}

export enum Team {
    HOME = 'home',
    AWAY = 'away'
}

export type PlayerStatus = 'on-field' | 'bench';

export interface Player {
    id: string;
    team: Team;
    number: number;
    name: string;
    role: string;
    position: Point;
    status: PlayerStatus;
    isGoalie?: boolean;
}

export interface Drawing {
    id: string;
    type: 'line' | 'arrow' | 'polygon' | 'link';
    points: Point[];
    playerIds?: string[]; // For dynamic linking
    color: string;
    dashed: boolean;
}

export interface Ball {
    position: Point;
    isVisible: boolean;
}

export interface BoardState {
    players: Player[];
    drawings: Drawing[];
    ball: Ball;
}
