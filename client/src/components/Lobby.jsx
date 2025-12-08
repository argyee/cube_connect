import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/useGame';
import { Users, Copy, CheckCircle, Settings } from 'lucide-react';
import { PLAYER_COLORS, MIN_PLAYERS } from '../utils/constants';
import { clearRoomSession } from '../utils/sessionStorage';

const Lobby = () => {
  const navigate = useNavigate();
  const {
    roomCode,
    roomPlayers,
    playerSlot,
    leaveRoom,
    toggleReady,
    startOnlineGame,
    winCondition,
    roomMaxPlayers,
    roomCubesPerPlayer,
    playerReadyStatus
  } = useGame();

  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear session when leaving lobby
  const handleLeaveRoom = () => {
    // Preserve the saved room session so the player can rejoin from the Home menu.
    // Previously this cleared the session which prevented the "Rejoin Last Room" button
    // from appearing. We now simply leave the room and keep the saved session intact.
    leaveRoom();
    navigate('/');
  };

  // Room can have 2-6 players, get max from room data or default to length of joined players
  const maxPlayers = roomMaxPlayers || Math.max(roomPlayers.length, 3);
  const hasEnoughPlayers = roomPlayers.length >= MIN_PLAYERS;
  const allPlayersReady = roomPlayers.length > 0 && roomPlayers.every(p => playerReadyStatus[p.slot]);
  const canStart = hasEnoughPlayers && allPlayersReady;
  const isHost = playerSlot === 0;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-3 sm:p-4" role="main">
      <div className="bg-white rounded-lg shadow-2xl p-4 sm:p-8 max-w-md w-full">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
            Waiting for Players
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm">
            Win Condition: {winCondition} in a row
          </p>
        </div>

        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2 text-center">
            Room Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-lg p-2 sm:p-4 text-center">
              <div className="text-2xl sm:text-3xl font-bold font-mono tracking-widest text-slate-800">
                {roomCode}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="p-2 sm:p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
              title="Copy room code"
              aria-label="Copy room code to clipboard"
            >
              {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
            </button>
          </div>
          {copied && (
            <p className="text-center text-xs sm:text-sm text-green-600 mt-2">
              Code copied to clipboard!
            </p>
          )}
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Settings size={16} className="text-slate-600" />
            <span className="font-medium text-sm sm:text-base text-slate-700">Game Settings</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-xs text-slate-600 font-medium mb-1">Max Players</div>
              <div className="text-lg font-bold text-slate-800">{maxPlayers}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-xs text-slate-600 font-medium mb-1">Cubes Per Player</div>
              <div className="text-lg font-bold text-slate-800">{roomCubesPerPlayer}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-xs text-slate-600 font-medium mb-1">Win Condition</div>
              <div className="text-lg font-bold text-slate-800">{winCondition}</div>
            </div>
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <Users size={18} className="text-slate-600" />
            <span className="font-medium text-sm sm:text-base text-slate-700">
              Players ({roomPlayers.length}/{maxPlayers})
            </span>

          </div>
          <div className="space-y-1 sm:space-y-2">
            {Array.from({ length: maxPlayers }).map((_, slot) => {
              const player = roomPlayers.find(p => p.slot === slot);
              const isYou = slot === playerSlot;

              return (
                <div
                  key={slot}
                  className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-2 ${
                    player
                      ? isYou
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 bg-white'
                      : 'border-dashed border-slate-300 bg-slate-50'
                  }`}
                >
                  <div
                    className="w-4 h-4 sm:w-6 sm:h-6 rounded flex-shrink-0"
                    style={{
                      backgroundColor: player
                        ? PLAYER_COLORS[slot]
                        : '#e2e8f0'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs sm:text-sm text-slate-700 truncate">
                      {player ? (
                        <>
                          {player.name || `Player ${slot + 1}`}
                          {isYou && <span className="text-blue-600 ml-1">(You)</span>}
                          {slot === 0 && <span className="text-amber-600 ml-1">(Host)</span>}
                        </>
                      ) : (
                        <span className="text-slate-400">Waiting...</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {isYou && player && (
                      <button
                        onClick={toggleReady}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleReady();
                          }
                        }}
                        className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          playerReadyStatus[slot]
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-400'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300 focus:ring-slate-400'
                        }`}
                        aria-label={`Mark yourself as ${playerReadyStatus[slot] ? 'not ready' : 'ready'}`}
                        aria-pressed={playerReadyStatus[slot] || false}
                      >
                        {playerReadyStatus[slot] && <CheckCircle size={16} className="text-green-600 flex-shrink-0" aria-hidden="true" />}
                        <span>{playerReadyStatus[slot] ? 'Ready' : 'Not Ready'}</span>
                      </button>
                    )}
                    {player && !isYou && (
                      <div className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm font-medium whitespace-nowrap ${
                        playerReadyStatus[slot]
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {playerReadyStatus[slot] && <CheckCircle size={16} className="text-green-600 flex-shrink-0" aria-hidden="true" />}
                        <span>{playerReadyStatus[slot] ? 'Ready' : 'Not Ready'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1 sm:space-y-2">
          {isHost && canStart && (
            <button
              onClick={startOnlineGame}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
              aria-label={`Start game with ${roomPlayers.length} player${roomPlayers.length !== 1 ? 's' : ''}`}
            >
              Start Game ({roomPlayers.length} player{roomPlayers.length !== 1 ? 's' : ''})
            </button>
          )}
          {isHost && !hasEnoughPlayers && (
            <div className="w-full bg-slate-200 text-slate-500 font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-center text-xs sm:text-sm" role="status" aria-live="polite">
              Waiting for at least {MIN_PLAYERS} players...
            </div>
          )}
          {isHost && hasEnoughPlayers && !allPlayersReady && (
            <div className="w-full bg-slate-200 text-slate-500 font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-center text-xs sm:text-sm" role="status" aria-live="polite">
              Waiting for all players to mark ready...
            </div>
          )}
          {!isHost && (
            <div className="w-full bg-blue-100 text-blue-700 font-medium py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-center text-xs sm:text-sm" role="status" aria-live="polite">
              {!hasEnoughPlayers ? `Waiting for ${MIN_PLAYERS - roomPlayers.length} more player(s)...` : allPlayersReady ? 'Waiting for host to start...' : 'Waiting for all players to be ready...'}
            </div>
          )}

          <button
            onClick={handleLeaveRoom}
            className="w-full bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            aria-label="Leave the room"
          >
            Leave Room
          </button>
        </div>

        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-slate-50 rounded-lg text-xs text-slate-600">
          <p className="font-semibold mb-1">Tip:</p>
          <p>Share the room code with your friends to invite them to play!</p>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
