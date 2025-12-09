import React, { useState, useEffect } from 'react';
import { Clock, Target, Zap } from 'lucide-react';

const GameInfo = ({ winCondition, gameStartTime, players, currentPlayer, debugMode }) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!gameStartTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - gameStartTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartTime]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const totalCubesOnBoard = players.reduce((sum, p) => sum + (p.cubesLeft ? 0 : 0), 0) + 
    players.reduce((sum, p) => sum + Math.max(0, p.cubesLeft - 14), 0);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
      <h3 className="font-bold text-slate-800 text-lg">Game Info</h3>

      {/* Win Condition */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
        <Target size={20} className="text-emerald-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-slate-600 font-medium">Win Condition</p>
          <p className="text-lg font-bold text-slate-800">{winCondition} in a row</p>
        </div>
      </div>

      {/* Elapsed Time */}
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
        <Clock size={20} className="text-blue-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-slate-600 font-medium">Time Elapsed</p>
          <p className="text-lg font-bold text-slate-800 font-mono">{formatTime(elapsedTime)}</p>
        </div>
      </div>

      {/* Current Player */}
      {currentPlayer !== undefined && players[currentPlayer] && (
        <div className="flex items-center gap-3 p-3 rounded-lg border-2" 
          style={{ 
            borderColor: players[currentPlayer].color,
            backgroundColor: players[currentPlayer].color + '15'
          }}>
          <div 
            className="w-4 h-4 rounded flex-shrink-0"
            style={{ backgroundColor: players[currentPlayer].color }}
          />
          <div className="flex-1">
            <p className="text-xs text-slate-600 font-medium">Current Player</p>
            <p className="text-lg font-bold text-slate-800">{players[currentPlayer].name}</p>
          </div>
        </div>
      )}

      {/* Debug Mode Badge */}
      {debugMode && (
        <div className="flex items-center justify-center p-2 bg-amber-100 border border-amber-400 rounded text-xs font-bold text-amber-800">
          🐛 Debug Mode Active
        </div>
      )}
    </div>
  );
};

export default GameInfo;
