import React from 'react';
import { Circle } from 'lucide-react';

const PlayerStatus = ({ players, currentPlayer, isOnlineMode, playerSlot, playerActivity = {} }) => {
  const isPlayerActive = (playerId) => {
    const lastActive = playerActivity[playerId];
    if (!lastActive) return false;
    // Consider active if activity within last 5 seconds
    return (Date.now() - lastActive) < 5000;
  };
  return (
    <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
      {players.map((player, idx) => {
        const isCurrentPlayer = idx === currentPlayer;
        const isYou = isOnlineMode && idx === playerSlot;
        const isActive = isOnlineMode && isPlayerActive(idx);

        return (
          <div
            key={player.id}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all relative
              ${isCurrentPlayer
                ? 'ring-2 ring-offset-2 scale-105 shadow-lg'
                : 'opacity-60'
              }
            `}
            style={{
              backgroundColor: isCurrentPlayer ? player.color : '#e2e8f0',
              ringColor: player.color
            }}
          >
            <div
              className="w-4 h-4 rounded flex-shrink-0"
              style={{ backgroundColor: player.color }}
            />
            <div className="text-sm">
              <div className={`flex items-center gap-1 ${isCurrentPlayer ? 'text-white font-semibold' : 'text-slate-700'}`}>
                {player.name}
                {isYou && <span className="ml-1">(You)</span>}
                {isOnlineMode && isActive && (
                  <Circle
                    size={8}
                    className="fill-green-500 text-green-500 animate-pulse"
                    title="Active"
                  />
                )}
              </div>
              <div className={isCurrentPlayer ? 'text-white text-xs' : 'text-slate-500 text-xs'}>
                {player.cubesLeft > 0 ? `${player.cubesLeft} cubes` : 'Moving'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlayerStatus;
