import React from 'react';
import { AlertCircle } from 'lucide-react';

const GameMessages = ({
  invalidMoveMessage,
  isMovementPhase,
  selectedCube,
  winner,
  isOnlineMode,
  isYourTurn
}) => {
  if (winner) {
    return (
      <div className="mt-3 text-center">
        <div className="text-xl sm:text-2xl font-bold" style={{ color: winner.color }}>
          {winner.name} Wins! 🎉
        </div>
      </div>
    );
  }

  if (invalidMoveMessage) {
    return (
      <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded text-sm">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span>{invalidMoveMessage}</span>
      </div>
    );
  }

  if (isOnlineMode && !isYourTurn) {
    return (
      <div className="mt-3 flex items-center gap-2 text-slate-600 bg-slate-100 px-3 py-2 rounded text-sm">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span>Waiting for other player...</span>
      </div>
    );
  }

  if (isMovementPhase && !selectedCube) {
    return (
      <div className="mt-3 flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded text-sm">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span>Select one of your cubes to move</span>
      </div>
    );
  }

  if (selectedCube) {
    return (
      <div className="mt-3 flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded text-sm">
        <AlertCircle size={16} className="flex-shrink-0" />
        <span>Click an empty square to move your cube</span>
      </div>
    );
  }

  return null;
};

export default GameMessages;
