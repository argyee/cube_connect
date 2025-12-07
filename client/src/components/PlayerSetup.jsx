import React, { useState } from 'react';
import { ArrowLeft, Users, Box } from 'lucide-react';
import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_CUBES_PER_PLAYER,
  MAX_CUBES_PER_PLAYER,
  RECOMMENDED_CUBES,
  WIN_CONDITIONS,
  PLAYER_COLORS,
  generatePlayers
} from '../utils/constants';

const PlayerSetup = ({ onBack, onStart }) => {
  const [playerCount, setPlayerCount] = useState(3);
  const [cubesPerPlayer, setCubesPerPlayer] = useState(RECOMMENDED_CUBES[3]);
  const [winCondition, setWinCondition] = useState(WIN_CONDITIONS.DEFAULT);
  const [playerNames, setPlayerNames] = useState(
    Array.from({ length: MAX_PLAYERS }, (_, i) => `Player ${i + 1}`)
  );
  const [debugMode, setDebugMode] = useState(false);

  const handlePlayerCountChange = (count) => {
    setPlayerCount(count);
    // Auto-adjust cubes to recommended amount
    setCubesPerPlayer(RECOMMENDED_CUBES[count]);
  };

  const handlePlayerNameChange = (index, name) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const handleStart = () => {
    const names = playerNames.slice(0, playerCount);
    const players = generatePlayers(playerCount, names, cubesPerPlayer);
    onStart({
      players,
      winCondition,
      cubesPerPlayer,
      debugMode
    });
  };

  const totalCubes = playerCount * cubesPerPlayer;
  const boardCapacity = 400; // 20x20 grid
  const boardUsage = ((totalCubes / boardCapacity) * 100).toFixed(1);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-2xl w-full">
        <button
          onClick={onBack}
          className="text-slate-600 hover:text-slate-800 mb-4 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-slate-800">
          Setup Local Game
        </h1>

        {/* Player Count Selector */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users size={20} className="text-slate-600" />
            <label className="block text-sm font-medium text-slate-700">
              Number of Players
            </label>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((count) => (
              <button
                key={count}
                onClick={() => handlePlayerCountChange(count)}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  playerCount === count
                    ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* Player Names */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Player Names
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: playerCount }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: PLAYER_COLORS[i] }}
                />
                <input
                  type="text"
                  value={playerNames[i]}
                  onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Player ${i + 1}`}
                  maxLength={20}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Cubes Per Player */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Box size={20} className="text-slate-600" />
            <label className="block text-sm font-medium text-slate-700">
              Cubes Per Player: {cubesPerPlayer}
            </label>
            <span className="text-xs text-slate-500 ml-auto">
              (Recommended: {RECOMMENDED_CUBES[playerCount]})
            </span>
          </div>
          <input
            type="range"
            min={MIN_CUBES_PER_PLAYER}
            max={MAX_CUBES_PER_PLAYER}
            value={cubesPerPlayer}
            onChange={(e) => setCubesPerPlayer(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>{MIN_CUBES_PER_PLAYER}</span>
            <span>{MAX_CUBES_PER_PLAYER}</span>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Total cubes: {totalCubes} ({boardUsage}% of board)
            {parseFloat(boardUsage) > 30 && (
              <span className="text-amber-600 ml-2">⚠️ Might get crowded!</span>
            )}
          </div>
        </div>

        {/* Win Condition */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Win Condition (in a row)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[WIN_CONDITIONS.MIN, 5, WIN_CONDITIONS.MAX].map((condition) => (
              <button
                key={condition}
                onClick={() => setWinCondition(condition)}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  winCondition === condition
                    ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {condition} in a row
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors shadow-lg"
        >
          Start Game
        </button>

        {/* Debug Mode Toggle */}
        <div className="mt-4 flex items-center justify-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="debug-mode"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="debug-mode" className="text-sm font-medium text-amber-900 cursor-pointer">
              Debug Mode
            </label>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-4 bg-slate-50 rounded-lg text-xs text-slate-600">
          <p className="font-semibold mb-2">Game Rules:</p>
          <ul className="list-disc list-inside space-y-1">
              <li>2-6 players. Get {winCondition} in a row in any direction to win.</li>
              <li>Place cubes adjacent to existing ones.</li>
              <li>When out of cubes, you move an existing one.</li>
              <li>You can only move a cube if all remaining cubes stay connected (vertical/horizontal links only)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PlayerSetup;
