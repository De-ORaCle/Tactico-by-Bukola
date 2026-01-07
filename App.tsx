
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Tool, Team, Player, Drawing, Point, Ball
} from './types';
import {
  PITCH_COLORS, PITCH_DIMENSIONS, PLAYER_RADIUS, BALL_RADIUS, FORMATION_TEMPLATES, getInitialPlayers
} from './constants';
import PitchLayer from './components/PitchLayer';
import { analyzeTactic } from './ollamaService';

const App: React.FC = () => {
  // State
  const [activeTool, setActiveTool] = useState<Tool>(Tool.SELECT);
  const [players, setPlayers] = useState<Player[]>(getInitialPlayers());
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subCandidateId, setSubCandidateId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [settingsTeam, setSettingsTeam] = useState<Team>(Team.HOME);
  const [showNames, setShowNames] = useState(true);
  const [arrowColor, setArrowColor] = useState<string>('white'); // Default color
  const [currentLinkedPlayerIds, setCurrentLinkedPlayerIds] = useState<string[]>([]); // Selection for linking
  const [ball, setBall] = useState<Ball>({
    position: { x: PITCH_DIMENSIONS.width / 2, y: PITCH_DIMENSIONS.height / 2 },
    isVisible: true
  });

  // Formation tracking state for UI
  const [homeFormation, setHomeFormation] = useState('4-3-3');
  const [awayFormation, setAwayFormation] = useState('4-3-3');

  // Refs for dragging
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Utility to get coordinates relative to SVG
  const getCoords = (e: React.PointerEvent | PointerEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  // Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const coords = getCoords(e);

    if (activeTool === Tool.SELECT) {
      const target = e.target as SVGElement;
      const playerId = target.closest('[data-player-id]')?.getAttribute('data-player-id');
      const isBall = target.closest('[data-ball]');

      if (isBall && ball.isVisible) {
        dragRef.current = {
          id: 'ball',
          offsetX: coords.x - ball.position.x,
          offsetY: coords.y - ball.position.y
        };
        setSelectedId(null);
      } else if (playerId) {
        const player = players.find(p => p.id === playerId);
        if (player) {
          dragRef.current = {
            id: playerId,
            offsetX: coords.x - player.position.x,
            offsetY: coords.y - player.position.y
          };
          setSelectedId(playerId);
        }
      } else {
        setSelectedId(null);
      }
    } else if (activeTool === Tool.LINK) {
      const target = e.target as SVGElement;
      const playerId = target.closest('[data-player-id]')?.getAttribute('data-player-id');

      if (playerId) {
        // Toggle player selection for linking
        setCurrentLinkedPlayerIds(prev =>
          prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
        );
      } else {
        // Clicked on empty space - commit link if valid, else clear
        if (currentLinkedPlayerIds.length >= 2) {
          const newDrawing: Drawing = {
            id: `draw-${Date.now()}`,
            type: 'link',
            points: [], // Not used for links, we use playerIds
            playerIds: currentLinkedPlayerIds,
            color: 'white',
            dashed: true
          };
          setDrawings(prev => [...prev, newDrawing]);
        }
        setCurrentLinkedPlayerIds([]);
      }
    } else if ([Tool.PEN, Tool.ARROW, Tool.TRIANGLE].includes(activeTool)) {
      setIsDrawing(true);
      setCurrentPoints([coords]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const coords = getCoords(e);

    if (dragRef.current) {
      let newX = coords.x - dragRef.current.offsetX;
      let newY = coords.y - dragRef.current.offsetY;

      if (dragRef.current.id === 'ball') {
        newX = Math.max(BALL_RADIUS, Math.min(PITCH_DIMENSIONS.width - BALL_RADIUS, newX));
        newY = Math.max(BALL_RADIUS, Math.min(PITCH_DIMENSIONS.height - BALL_RADIUS, newY));
        setBall(prev => ({ ...prev, position: { x: newX, y: newY } }));
      } else {
        newX = Math.max(PLAYER_RADIUS, Math.min(PITCH_DIMENSIONS.width - PLAYER_RADIUS, newX));
        newY = Math.max(PLAYER_RADIUS, Math.min(PITCH_DIMENSIONS.height - PLAYER_RADIUS, newY));

        setPlayers(prev => prev.map(p =>
          p.id === dragRef.current?.id ? { ...p, position: { x: newX, y: newY } } : p
        ));
      }
    } else if (isDrawing) {
      if (activeTool === Tool.ARROW) {
        setCurrentPoints(prev => [prev[0], coords]);
      } else {
        setCurrentPoints(prev => [...prev, coords]);
      }
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && currentPoints.length > 1) {
      const newDrawing: Drawing = {
        id: `draw-${Date.now()}`,
        type: activeTool === Tool.ARROW ? 'arrow' : activeTool === Tool.TRIANGLE ? 'polygon' : 'line',
        points: currentPoints,
        color: activeTool === Tool.ARROW ? arrowColor : 'white',
        dashed: activeTool === Tool.ARROW
      };
      setDrawings(prev => [...prev, newDrawing]);
    }

    dragRef.current = null;
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handleDelete = useCallback(() => {
    if (selectedId) {
      setPlayers(prev => prev.filter(p => p.id !== selectedId));
      setSelectedId(null);
    }
  }, [selectedId]);

  const handleUndo = useCallback(() => {
    setDrawings(prev => prev.slice(0, -1));
  }, []);

  const handleClear = () => {
    if (window.confirm("Clear all drawings?")) {
      setDrawings([]);
      setCurrentLinkedPlayerIds([]);
      setAiAnalysis(null);
    }
  };

  const handleReset = () => {
    if (window.confirm("Reset board to default state? This will clear everything.")) {
      setPlayers(getInitialPlayers());
      setDrawings([]);
      setAiAnalysis(null);
      setSelectedId(null);
      setSubCandidateId(null);
      setHomeFormation('4-3-3');
      setAwayFormation('4-3-3');
      setBall({
        position: { x: PITCH_DIMENSIONS.width / 2, y: PITCH_DIMENSIONS.height / 2 },
        isVisible: true
      });
      setBall({
        position: { x: PITCH_DIMENSIONS.width / 2, y: PITCH_DIMENSIONS.height / 2 },
        isVisible: true
      });
    }
  };

  const applyFormation = (team: Team, formationKey: string) => {
    const template = FORMATION_TEMPLATES[formationKey];
    if (!template) return;

    if (team === Team.HOME) setHomeFormation(formationKey);
    else setAwayFormation(formationKey);

    setPlayers(prev => {
      const teamPlayers = prev.filter(p => p.team === team && p.status === 'on-field');
      const otherPlayers = prev.filter(p => p.team !== team || p.status !== 'on-field');

      const updatedTeamPlayers = teamPlayers.map((player, index) => {
        if (index < template.length) {
          const pos = template[index];
          return {
            ...player,
            position: team === Team.HOME ? { ...pos } : { x: PITCH_DIMENSIONS.width - pos.x, y: pos.y }
          };
        }
        return player;
      });

      return [...otherPlayers, ...updatedTeamPlayers];
    });
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeTactic(players, drawings);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const addPlayer = () => {
    const onFieldCount = players.filter(p => p.team === settingsTeam && p.status === 'on-field').length;
    const newStatus = onFieldCount < 11 ? 'on-field' : 'bench';

    const newPlayer: Player = {
      id: `custom-${Date.now()}`,
      team: settingsTeam,
      number: players.filter(p => p.team === settingsTeam).length + 1,
      name: `New Player`,
      role: 'SUB',
      status: newStatus,
      position: { x: PITCH_DIMENSIONS.width / 2, y: PITCH_DIMENSIONS.height / 2 }
    };
    setPlayers(prev => [...prev, newPlayer]);
  };

  const handleSubstitution = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    if (!subCandidateId) {
      setSubCandidateId(playerId);
    } else {
      if (subCandidateId === playerId) {
        setSubCandidateId(null);
      } else {
        const candidate = players.find(p => p.id === subCandidateId);
        if (candidate && candidate.team === player.team) {
          setPlayers(prev => prev.map(p => {
            if (p.id === playerId) {
              return { ...p, position: { ...candidate.position }, status: candidate.status };
            }
            if (p.id === subCandidateId) {
              return { ...p, position: { ...player.position }, status: player.status };
            }
            return p;
          }));
          setSubCandidateId(null);
        } else {
          setSubCandidateId(playerId);
        }
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
      if (e.key === 'v') setActiveTool(Tool.SELECT);
      if (e.key === 'p') setActiveTool(Tool.PEN);
      if (e.key === 'a') setActiveTool(Tool.ARROW);
      if (e.key === 't') setActiveTool(Tool.TRIANGLE);
      if (e.key === 'l') setActiveTool(Tool.LINK);
      if (e.metaKey && e.key === 'z') handleUndo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, handleUndo]);

  const onFieldPlayers = players.filter(p => p.team === settingsTeam && p.status === 'on-field');
  const benchPlayers = players.filter(p => p.team === settingsTeam && p.status === 'bench');

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white select-none overflow-hidden font-sans">
      {/* Header / Nav */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg transition-all ${isSettingsOpen ? 'bg-gray-700 text-white shadow-inner' : 'hover:bg-gray-800 text-gray-400'}`}
            title="Tactical Settings"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Help & Instructions"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>

          <div className="flex flex-col hidden sm:flex">
            <h1 className="text-xl font-extrabold tracking-tighter text-white">
              Tactico <span className="text-green-500 text-xs stylized-by opacity-80 ml-1">by Bukola</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          <div className="flex items-center gap-2 bg-gray-800/50 p-1.5 rounded-xl border border-gray-700/50 min-w-max">
            <button
              onClick={() => setActiveTool(Tool.SELECT)}
              className={`p-2 rounded-lg transition-all ${activeTool === Tool.SELECT ? 'bg-green-600 text-white shadow-lg scale-105' : 'hover:bg-gray-700 text-gray-400'}`}
              title="Select (V)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
            </button>
            <button
              onClick={() => setActiveTool(Tool.PEN)}
              className={`p-2 rounded-lg transition-all ${activeTool === Tool.PEN ? 'bg-green-600 text-white shadow-lg scale-105' : 'hover:bg-gray-700 text-gray-400'}`}
              title="Line (P)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button
              onClick={() => setActiveTool(Tool.ARROW)}
              className={`p-2 rounded-lg transition-all ${activeTool === Tool.ARROW ? 'bg-green-600 text-white shadow-lg scale-105' : 'hover:bg-gray-700 text-gray-400'}`}
              title="Arrow (A)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </button>
            {activeTool === Tool.ARROW && (
              <div className="flex gap-1 ml-2 bg-gray-800/80 p-1 rounded-lg">
                {[
                  { name: 'White', value: 'white' },
                  { name: 'Yellow', value: '#fbbf24' },
                  { name: 'Red', value: '#ef4444' },
                  { name: 'Blue', value: '#3b82f6' }
                ].map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setArrowColor(color.value)}
                    className={`w-4 h-4 rounded-full border border-gray-600 ${arrowColor === color.value ? 'ring-2 ring-white scale-110' : 'hover:scale-105 transition-transform'}`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => setActiveTool(Tool.TRIANGLE)}
              className={`p-2 rounded-lg transition-all ${activeTool === Tool.TRIANGLE ? 'bg-green-600 text-white shadow-lg scale-105' : 'hover:bg-gray-700 text-gray-400'}`}
              title="Tactical Area (T)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
            <button
              onClick={() => setActiveTool(Tool.LINK)}
              className={`p-2 rounded-lg transition-all ${activeTool === Tool.LINK ? 'bg-green-600 text-white shadow-lg scale-105' : 'hover:bg-gray-700 text-gray-400'}`}
              title="Link Players (L)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </button>
            <div className="w-px h-5 bg-gray-700 mx-1" />
            <button
              onClick={handleUndo}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-lg hover:bg-red-900/40 text-gray-400 hover:text-red-500 transition-colors"
              title="Clear All Drawings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg hover:bg-red-600 text-gray-400 hover:text-white transition-all"
              title="Full Board Reset"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <div className="w-px h-5 bg-gray-700 mx-1" />
            <button
              onClick={() => setBall(prev => ({ ...prev, isVisible: !prev.isVisible }))}
              className={`p-2 rounded-lg transition-all ${ball.isVisible ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
              title="Toggle Ball"
            >
              <span className="text-lg leading-none">⚽</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] uppercase font-bold text-red-500 tracking-widest pl-1">Home</span>
              <select
                value={homeFormation}
                onChange={(e) => applyFormation(Team.HOME, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer hover:bg-gray-700 transition-colors"
              >
                {Object.keys(FORMATION_TEMPLATES).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] uppercase font-bold text-blue-500 tracking-widest pl-1">Away</span>
              <select
                value={awayFormation}
                onChange={(e) => applyFormation(Team.AWAY, e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer hover:bg-gray-700 transition-colors"
              >
                {Object.keys(FORMATION_TEMPLATES).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="bg-white text-black px-5 py-2.5 rounded-full font-bold text-xs hover:bg-green-400 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg active:scale-95"
          >
            {isAnalyzing ? (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 13a1 1 0 112 0 1 1 0 01-2 0zm1-8a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" /></svg>
            )}
            ANALYZE
          </button>
        </div>
      </header >

      {/* Main Container */}
      < div className="flex-1 flex overflow-hidden relative" >
        {/* Settings Panel */}
        < div className={`absolute left-0 top-0 bottom-0 w-full sm:w-96 bg-gray-900 border-r border-gray-800 z-50 shadow-2xl transition-transform duration-300 transform ${isSettingsOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold uppercase tracking-tight">Squad Management</h2>
            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-4 border-b border-gray-800 space-y-4 bg-gray-900/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Player Labels</span>
              <button
                onClick={() => setShowNames(!showNames)}
                className={`w-10 h-5 rounded-full transition-all relative ${showNames ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showNames ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <button
              onClick={addPlayer}
              className="w-full py-2.5 bg-green-700 hover:bg-green-600 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Add New Player
            </button>
          </div>

          <div className="flex p-4 gap-2 bg-gray-800/10">
            <button
              onClick={() => { setSettingsTeam(Team.HOME); setSubCandidateId(null); }}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${settingsTeam === Team.HOME ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
            >
              Home Team
            </button>
            <button
              onClick={() => { setSettingsTeam(Team.AWAY); setSubCandidateId(null); }}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${settingsTeam === Team.AWAY ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
            >
              Away Team
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            <div className="space-y-3">
              <h3 className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">On Field</h3>
              {onFieldPlayers.map(player => (
                <PlayerSettingsCard
                  key={player.id}
                  player={player}
                  isSelected={selectedId === player.id}
                  isSubCandidate={subCandidateId === player.id}
                  onUpdate={updatePlayer}
                  onFocus={() => setSelectedId(player.id)}
                  onSub={() => handleSubstitution(player.id)}
                  onDelete={() => { setSelectedId(player.id); handleDelete(); }}
                />
              ))}
              {onFieldPlayers.length === 0 && <p className="text-[10px] text-gray-700 text-center py-4">No players on the pitch</p>}
            </div>

            <div className="space-y-3">
              <h3 className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Bench</h3>
              {benchPlayers.map(player => (
                <PlayerSettingsCard
                  key={player.id}
                  player={player}
                  isSelected={selectedId === player.id}
                  isSubCandidate={subCandidateId === player.id}
                  onUpdate={updatePlayer}
                  onFocus={() => setSelectedId(player.id)}
                  onSub={() => handleSubstitution(player.id)}
                  onDelete={() => { setSelectedId(player.id); handleDelete(); }}
                />
              ))}
            </div>
          </div>
        </div >

        {/* Board Area */}
        <main className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4 md:p-8 bg-[#020202]">
          <div
            className="relative bg-[#1a4d2e] rounded-xl shadow-[0_30px_80px_rgba(0,0,0,0.7)] border-4 border-gray-800/60 aspect-[3/2] mx-auto"
            style={{ width: 'min(100%, calc((100vh - 9rem) * 1.5))' }}
          >
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={`0 0 ${PITCH_DIMENSIONS.width} ${PITCH_DIMENSIONS.height}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="cursor-crosshair overflow-visible touch-none"
            >
              <PitchLayer />



              {/* Ball - Improved Design & Interaction */}
              {ball.isVisible && (
                <g
                  data-ball
                  transform={`translate(${ball.position.x}, ${ball.position.y})`}
                  className="cursor-move"
                >
                  {/* Invisible Hit Area for easier grabbing */}
                  <circle r={BALL_RADIUS * 2} fill="transparent" />

                  {/* Visual Ball */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={BALL_RADIUS * 2.8}
                    className="pointer-events-none select-none filter drop-shadow-xl"
                    style={{ transform: 'translateY(1px)' }}
                  >
                    ⚽
                  </text>
                </g>
              )}

              {/* On-Field Players with Groups for Coordination */}
              {players.filter(p => p.status === 'on-field').map((player) => (
                <g
                  key={player.id}
                  data-player-id={player.id}
                  transform={`translate(${player.position.x}, ${player.position.y})`}
                  className={`cursor-grab active:cursor-grabbing transition-shadow ${selectedId === player.id ? 'filter drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : ''}`}
                >
                  <circle
                    r={PLAYER_RADIUS}
                    fill={player.team === Team.HOME ? PITCH_COLORS.home : PITCH_COLORS.away}
                    stroke="white"
                    strokeWidth="2.5"
                  />
                  <text
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="13"
                    fontWeight="800"
                    className="pointer-events-none"
                  >
                    {player.number}
                  </text>

                  {showNames && (
                    <g className="pointer-events-none">
                      <rect
                        x="-40"
                        y="22"
                        width="80"
                        height="16"
                        fill="rgba(0,0,0,0.5)"
                        rx="4"
                        className="backdrop-blur-sm"
                      />
                      <text
                        y="33"
                        textAnchor="middle"
                        fill="white"
                        fontSize="9"
                        fontWeight="700"
                        className="uppercase tracking-tighter"
                      >
                        {player.name} ({player.role})
                      </text>
                    </g>
                  )}
                </g>
              ))}

              {/* Static Drawings */}
              {drawings.map((draw) => (
                <g key={draw.id} className="pointer-events-none">
                  {draw.type === 'polygon' ? (
                    <polygon
                      points={draw.points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="rgba(255,255,255,0.06)"
                      stroke="white"
                      strokeWidth="2"
                    />
                  ) : (
                    <path
                      d={`M ${draw.points.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                      stroke={draw.color}
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={draw.dashed ? "8,8" : "none"}
                      markerEnd={draw.type === 'arrow' ? `url(#arrowhead-${draw.color})` : "none"}
                    />
                  )}
                </g>
              ))}

              {/* Dynamic Links (Saved & Pending) */}
              {[
                ...drawings.filter(d => d.type === 'link'), // Saved links
                ...(currentLinkedPlayerIds.length > 0 ? [{
                  id: 'pending-link',
                  type: 'link' as const,
                  points: [],
                  playerIds: currentLinkedPlayerIds,
                  color: 'white',
                  dashed: true
                }] : []) // Pending link
              ].map((link, i) => {
                if (!link.playerIds || link.playerIds.length < 2) return null;

                // Get positions of linked players
                const linkedPlayers = link.playerIds
                  .map(id => players.find(p => p.id === id))
                  .filter((p): p is Player => !!p);

                if (linkedPlayers.length < 2) return null;

                const points = linkedPlayers.map(p => p.position);

                if (linkedPlayers.length === 2) {
                  // Two players: Animated Dotted Line
                  return (
                    <g key={link.id || i} className="pointer-events-none">
                      <path
                        d={`M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`}
                        stroke="rgba(255, 255, 255, 0.8)"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                        fill="none"
                      >
                        <animate attributeName="stroke-dashoffset" from="0" to="8" dur="1s" repeatCount="indefinite" />
                      </path>
                      {/* Connection circles */}
                      <circle cx={points[0].x} cy={points[0].y} r="4" fill="white" fillOpacity="0.5" />
                      <circle cx={points[1].x} cy={points[1].y} r="4" fill="white" fillOpacity="0.5" />
                    </g>
                  );
                } else {
                  // 3+ Players: Animated Polygon Difference Area
                  return (
                    <g key={link.id || i} className="pointer-events-none">
                      <polygon
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="rgba(59, 130, 246, 0.8)"
                        strokeWidth="2"
                        strokeDasharray="8,4"
                      >
                        <animate attributeName="stroke-dashoffset" from="0" to="24" dur="2s" repeatCount="indefinite" />
                      </polygon>
                    </g>
                  );
                }
              })}

              {/* Current Active Drawing */}
              {isDrawing && (
                <path
                  d={`M ${currentPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                  stroke={activeTool === Tool.ARROW ? arrowColor : 'white'}
                  strokeWidth="2"
                  fill="none"
                  opacity="0.3"
                  strokeDasharray={activeTool === Tool.ARROW ? "6,6" : "none"}
                  className="pointer-events-none"
                />
              )}

              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="white" />
                </marker>
                <marker id="arrowhead-white" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="white" />
                </marker>
                <marker id="arrowhead-#fbbf24" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#fbbf24" />
                </marker>
                <marker id="arrowhead-#ef4444" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
                <marker id="arrowhead-#3b82f6" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                </marker>
              </defs>
            </svg>
          </div>

          {/* AI Sidebar Overlay */}
          {
            aiAnalysis && (
              <div className="absolute top-8 right-8 w-80 max-h-[calc(100%-4rem)] bg-gray-900/95 border border-gray-700/40 rounded-3xl shadow-2xl overflow-y-auto p-6 z-40 backdrop-blur-xl animate-in slide-in-from-right duration-500">
                <div className="flex items-center justify-between mb-5 border-b border-gray-800 pb-3">
                  <h3 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest">
                    <span className="text-green-500">◆</span> AI Analysis
                  </h3>
                  <button onClick={() => setAiAnalysis(null)} className="text-gray-500 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="text-xs text-gray-300 space-y-4 leading-relaxed">
                  <AnalysisContent text={aiAnalysis} />
                </div>
              </div>
            )
          }
        </main >
      </div >

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Footer */}
      <footer className="px-4 py-2 sm:px-6 sm:py-1.5 bg-gray-900 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center text-[8px] sm:text-[9px] text-gray-600 font-bold tracking-widest uppercase gap-2">
        <div className="flex gap-3 sm:gap-5 flex-wrap justify-center">
          <span>[V] Select</span>
          <span>[P] Pen</span>
          <span>[A] Arrow</span>
          <span>[T] Area</span>
          <span className="text-red-900">[DEL] Delete</span>
        </div>
        <div className="opacity-50 tracking-[0.2em]">TACTICO BY BUKOLA v1.0</div>
      </footer>
    </div >
  );
};

const AnalysisContent = ({ text }: { text: string }) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');

  const parseBolding = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <div key={idx} className="mt-6 first:mt-0 text-white font-bold text-xs uppercase tracking-widest border-l-2 border-green-500 pl-2">
              {parseBolding(trimmed.slice(4))}
            </div>
          );
        }
        if (trimmed.startsWith('#### ')) {
          return (
            <div key={idx} className="mt-4 text-green-500 font-bold text-[10px] uppercase">
              {parseBolding(trimmed.slice(5))}
            </div>
          );
        }
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={idx} className="flex gap-2 pl-1 text-gray-400">
              <span className="text-green-500">•</span>
              <div>{parseBolding(trimmed.slice(2))}</div>
            </div>
          );
        }
        return (
          <div key={idx} className="text-gray-300">
            {parseBolding(trimmed)}
          </div>
        );
      })}
    </>
  );
};

const PlayerSettingsCard = ({ player, isSelected, isSubCandidate, onUpdate, onFocus, onSub, onDelete }: any) => {
  return (
    <div className={`p-3 bg-gray-800/20 rounded-xl border transition-all space-y-3 shadow-sm ${isSelected ? 'border-yellow-500 ring-1 ring-yellow-500/20 bg-yellow-950/5' : isSubCandidate ? 'border-green-500 ring-1 ring-green-500/20 bg-green-950/5' : 'border-gray-800 hover:border-gray-700'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center border text-xs font-bold transition-colors ${player.team === Team.HOME ? 'bg-red-950/20 border-red-600/30 text-red-500' : 'bg-blue-950/20 border-blue-600/30 text-blue-500'}`}>
          {player.number}
        </div>
        <div className="flex-1 space-y-2">
          <input
            className="w-full bg-gray-950/40 border border-gray-800 rounded px-2 py-1 text-xs font-bold focus:border-green-600 outline-none transition-all"
            value={player.name}
            onChange={(e) => onUpdate(player.id, { name: e.target.value })}
          />
          <input
            className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-gray-500 focus:text-green-500 outline-none uppercase"
            value={player.role}
            onChange={(e) => onUpdate(player.id, { role: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
        <input
          type="number"
          className="w-12 bg-gray-950/30 border border-gray-800 rounded px-1.5 py-0.5 text-[10px] font-bold focus:border-green-500 outline-none"
          value={player.number}
          onChange={(e) => onUpdate(player.id, { number: parseInt(e.target.value) || 0 })}
        />
        <div className="flex gap-1.5">
          <button
            onClick={onSub}
            title="Substitution"
            className={`p-1.5 rounded-lg border transition-all ${isSubCandidate ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:text-green-500'}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
          </button>
          <button onClick={onFocus} className="px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-[9px] text-yellow-500 font-bold uppercase hover:bg-yellow-500/10 transition-colors">FOCUS</button>
          <button onClick={onDelete} className="px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-[9px] text-red-500 font-bold uppercase hover:bg-red-500/10 transition-colors">DEL</button>
        </div>
      </div>
    </div>
  );
};

const HelpModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl p-8 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
          Using Tactico
        </h2>

        <div className="space-y-8 text-gray-300">
          <section>
            <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
              Drawing Tools
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2 mb-1 text-white font-bold text-sm"><span className="text-green-500">V</span> Select / Move</div>
                <p className="text-xs text-gray-400">Move players and the ball. Click a player to see details.</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2 mb-1 text-white font-bold text-sm"><span className="text-green-500">P</span> Pen</div>
                <p className="text-xs text-gray-400">Freehand drawing on the board.</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2 mb-1 text-white font-bold text-sm"><span className="text-green-500">A</span> Arrow</div>
                <p className="text-xs text-gray-400">Draw arrows. Change colors (White, Yellow, Red, Blue).</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2 mb-1 text-white font-bold text-sm"><span className="text-green-500">T</span> Tactical Area</div>
                <p className="text-xs text-gray-400">Highlight a zone with a polygon.</p>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 sm:col-span-2">
                <div className="flex items-center gap-2 mb-1 text-white font-bold text-sm"><span className="text-green-500">L</span> Link Players</div>
                <p className="text-xs text-gray-400">Connect players dynamically. Click 2 players for a line, 3+ for an area. Click empty space to save.</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-white font-bold text-lg mb-3">Squad & Management</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-400 marker:text-green-500">
              <li><strong>Click & Drag:</strong> Move players and the ball freely.</li>
              <li><strong>Settings Panel (Top Left):</strong> Manage rosters, substitutions, and toggle player names.</li>
              <li><strong>Formations (Top Right):</strong> Quickly apply preset formations (e.g., 4-3-3, 4-4-2) for Home and Away teams.</li>
              <li><strong>Substitutions:</strong> In settings, click the "Arrows" icon on a bench player, then select a player on the field to swap.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-white font-bold text-lg mb-3">AI Analysis</h3>
            <p className="text-sm text-gray-400 mb-2">
              Click the <span className="text-white font-bold bg-green-600/20 px-1.5 py-0.5 rounded text-xs">ANALYZE</span> button to get instant tactical feedback powered by AI.
            </p>
            <p className="text-xs text-gray-500 italic">
              Note: The AI analyzes player positions and drawings to infer tactical intent.
            </p>
          </section>

          <section className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-widest">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-2 gap-y-2 gap-x-8 text-xs font-mono text-gray-400">
              <div className="flex justify-between"><span>Select Tool</span> <span className="text-white">V</span></div>
              <div className="flex justify-between"><span>Pen Tool</span> <span className="text-white">P</span></div>
              <div className="flex justify-between"><span>Arrow Tool</span> <span className="text-white">A</span></div>
              <div className="flex justify-between"><span>Area Tool</span> <span className="text-white">T</span></div>
              <div className="flex justify-between"><span>Link Tool</span> <span className="text-white">L</span></div>
              <div className="flex justify-between"><span>Undo</span> <span className="text-white">Ctrl + Z</span></div>
              <div className="flex justify-between"><span>Delete Item</span> <span className="text-white">Del / Backspace</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;

