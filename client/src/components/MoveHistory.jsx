import React from 'react';
import { Clock } from 'lucide-react';
import { getPlayerName, getPlayerColor, formatPosition } from '../utils/playerUtils';

const MoveHistory = ({ moves, players }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
        <Clock size={18} className="text-slate-600" />
        <h3 className="font-semibold text-slate-800">Move History</h3>
        <span className="text-xs text-slate-500 ml-auto">
          {moves.length} {moves.length === 1 ? 'move' : 'moves'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {moves.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">
            No moves yet
          </div>
        ) : (
          moves.map((move, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition-colors"
            >
              <span className="text-xs text-slate-500 w-6 text-right">
                {index + 1}.
              </span>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: getPlayerColor(move.playerId, players) }}
              />
              <span className="text-sm text-slate-700 flex-shrink-0">
                {getPlayerName(move.playerId, players)}
              </span>
              <span className="text-xs font-mono text-slate-600 ml-auto font-semibold">
                {formatPosition(move.row, move.col)}
              </span>
              {move.type === 'move' && (
                <span className="text-xs text-slate-400">
                  ← {formatPosition(move.fromRow, move.fromCol)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MoveHistory;
