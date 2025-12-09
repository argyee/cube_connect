import React, { useState } from 'react';
import { ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';
import { getCubeKey } from '../utils/boardUtils';
import { GRID_SIZE } from '../utils/constants';
import { findPlayerById } from '../utils/playerUtils';

const GameBoard = ({
  board,
  selectedCube,
  disconnectedCubes = [],
  winningLine = [],
  onCellClick,
  onCubeHover,
  onCubeLeave,
  players,
  playerCursors = {},
  currentPlayerSlot
}) => {
  const [zoom, setZoom] = useState(1); // Zoom level: 0.5, 0.75, 1, 1.25, 1.5, 2

  const winningSet = new Set(winningLine);

  const columnLabels = Array.from({ length: GRID_SIZE }, (_, i) =>
    String.fromCharCode(65 + i) // A, B, C, ... T
  );

  const rowLabels = Array.from({ length: GRID_SIZE }, (_, i) => i + 1);

  // Base cell size - scales with zoom (2rem = 32px base)
  const baseCellSize = 2;
  const cellSize = `${baseCellSize * zoom}rem`;
  const labelWidth = `${1.75 * zoom}rem`;
  const gap = `${0.125 * zoom}rem`;

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-2 sm:p-4 overflow-x-auto relative">
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white rounded-lg shadow-md border border-slate-200 p-1">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.5}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={18} className="text-slate-700" />
        </button>
        <div className="flex items-center px-2 text-xs font-medium text-slate-600 min-w-[3rem] justify-center">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 2}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={18} className="text-slate-700" />
        </button>
      </div>

      <div className="inline-block">
        {/* Column labels (top) */}
        <div className="flex" style={{ marginBottom: gap }}>
          {/* Spacer matching row label width */}
          <div className="flex-shrink-0" style={{ width: labelWidth, marginRight: gap }} />

          {/* Column labels */}
          <div className="flex" style={{ gap }}>
            {columnLabels.map((label, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 flex items-center justify-center text-xs font-semibold text-slate-600"
                style={{ width: cellSize, height: cellSize }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Board with row labels */}
        <div className="flex">
          {/* Row labels (left) */}
          <div className="flex flex-col flex-shrink-0" style={{ width: labelWidth, marginRight: gap, gap }}>
            {rowLabels.map((label) => (
              <div
                key={label}
                className="flex-shrink-0 flex items-center justify-center text-xs font-semibold text-slate-600"
                style={{ width: labelWidth, height: cellSize }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Game grid */}
          <div
            className="grid bg-slate-300 p-0.5 rounded flex-shrink-0"
            style={{
              gap,
              gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize})`,
              gridTemplateRows: `repeat(${GRID_SIZE}, ${cellSize})`
            }}
          >
            {Array.from({ length: GRID_SIZE }).map((_, row) =>
              Array.from({ length: GRID_SIZE }).map((_, col) => {
              const key = getCubeKey(row, col);
              const playerId = board[key];
              const isSelected = selectedCube === key;
              const isDisconnected = disconnectedCubes.includes(key);
              const player = playerId !== undefined ? findPlayerById(playerId, players) : null;
              const isWinningCube = winningSet.has(key);

              // Check if any player's cursor is on this cell
              const cursorData = Object.entries(playerCursors).find(
                ([playerId, cursor]) => cursor.row === row && cursor.col === col && playerId !== currentPlayerSlot
              );
              const hasCursor = cursorData && (Date.now() - cursorData[1].timestamp < 3000); // Fade after 3s
              const cursorPlayer = hasCursor ? findPlayerById(parseInt(cursorData[0]), players) : null;

              return (
                <div
                  key={key}
                  onClick={() => onCellClick(row, col)}
                  onMouseEnter={() => onCubeHover && onCubeHover(key)}
                  onMouseLeave={() => onCubeLeave && onCubeLeave()}
                  className={`
                    cursor-pointer transition-all relative
                    ${isSelected ? 'ring-2 ring-yellow-400 scale-110 z-10 shadow-lg' : ''}
                    ${isWinningCube ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-white shadow-xl scale-110 z-20' : ''}
                    ${playerId ? 'shadow-sm hover:brightness-110' : 'bg-white hover:bg-slate-100'}
                  `}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: player ? player.color : undefined,
                    opacity: isDisconnected ? 0.85 : 1
                  }}
                >
                  {isWinningCube && (
                    <>
                      {/* Outer glow ring */}
                      <div
                        className="absolute inset-0 rounded animate-pulse"
                        style={{
                          border: '3px solid rgb(34, 197, 94)',
                          boxShadow: '0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.5), inset 0 0 10px rgba(34, 197, 94, 0.4)'
                        }}
                      />
                      {/* Inner highlight */}
                      <div
                        className="absolute inset-1 rounded pointer-events-none"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent)',
                          border: '1px solid rgba(34, 197, 94, 0.5)'
                        }}
                      />
                    </>
                  )}
                  {/* Disconnected cube warning overlay */}
                  {isDisconnected && (
                    <>
                      {/* Animated border glow */}
                      <div className="absolute inset-0 rounded animate-pulse" style={{
                        boxShadow: '0 0 0 3px rgba(250, 204, 21, 0.4), 0 0 12px rgba(250, 204, 21, 0.6), inset 0 0 8px rgba(250, 204, 21, 0.3)',
                        border: '2px solid rgb(250, 204, 21)',
                        pointerEvents: 'none'
                      }} />
                      {/* Warning icon */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 drop-shadow-lg animate-pulse" strokeWidth={3} />
                      </div>
                    </>
                  )}

                  {/* Player cursor indicator */}
                  {hasCursor && cursorPlayer && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
                      <div className="flex flex-col items-center">
                        {/* Cursor arrow */}
                        <div
                          className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent"
                          style={{ borderTopColor: cursorPlayer.color }}
                        />
                        {/* Player name label */}
                        <div
                          className="text-[8px] sm:text-[10px] font-semibold whitespace-nowrap px-1 rounded shadow-md"
                          style={{
                            backgroundColor: cursorPlayer.color,
                            color: '#fff'
                          }}
                        >
                          {cursorPlayer.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
