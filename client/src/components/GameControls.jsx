import React, { useState } from 'react';
import { RotateCw, Eye, EyeOff, Timer, MousePointer, Settings } from 'lucide-react';
import { useGame } from '../context/useGame';

const GameControls = ({ onReset, onRandomBoard, onLeaveGame, debugMode, isOnlineMode }) => {
  const {
    showConnectivityHints,
    setShowConnectivityHints,
    turnTimerEnabled,
    setTurnTimerEnabled,
    showPlayerCursors,
    setShowPlayerCursors,
  } = useGame();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!isOnlineMode && (
        <button
          onClick={onReset}
          className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
        >
          <RotateCw size={16} />
          <span className="hidden sm:inline">Reset</span>
        </button>
      )}

      {debugMode && !isOnlineMode && (
        <button
          onClick={onRandomBoard}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
        >
          🎲 <span className="hidden sm:inline">Random</span>
        </button>
      )}

      {isOnlineMode && (
        <button
          onClick={onLeaveGame}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm"
        >
          Leave Game
        </button>
      )}

      {/* Settings Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-2 ${showSettings ? 'bg-blue-600' : 'bg-slate-600'} hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm`}
          title="Game Options"
        >
          <Settings size={16} />
          <span className="hidden sm:inline">Options</span>
        </button>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-4">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Game Options</h3>

            {/* Connectivity Hints Toggle */}
            <label className="flex items-center justify-between mb-3 cursor-pointer">
              <div className="flex items-center gap-2">
                {showConnectivityHints ? <Eye size={16} className="text-blue-600" /> : <EyeOff size={16} className="text-slate-400" />}
                <span className="text-sm text-slate-700">Connectivity Hints</span>
              </div>
              <button
                onClick={() => setShowConnectivityHints(!showConnectivityHints)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showConnectivityHints ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showConnectivityHints ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Turn Timer Toggle */}
            <label className="flex items-center justify-between mb-3 cursor-pointer">
              <div className="flex items-center gap-2">
                <Timer size={16} className={turnTimerEnabled ? 'text-blue-600' : 'text-slate-400'} />
                <span className="text-sm text-slate-700">Turn Timer (60s)</span>
              </div>
              <button
                onClick={() => setTurnTimerEnabled(!turnTimerEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  turnTimerEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    turnTimerEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {/* Player Cursors Toggle (Online only) */}
            {isOnlineMode && (
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <MousePointer size={16} className={showPlayerCursors ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-sm text-slate-700">Show Cursors</span>
                </div>
                <button
                  onClick={() => setShowPlayerCursors(!showPlayerCursors)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showPlayerCursors ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showPlayerCursors ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close settings */}
      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default GameControls;
