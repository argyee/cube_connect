import React, { useState, useEffect } from 'react';
import { useGame } from '../context/useGame';
import GameBoard from './GameBoard';
import PlayerStatus from './PlayerStatus';
import GameControls from './GameControls';
import GameMessages from './GameMessages';
import GameInfo from './GameInfo';
import MoveHistory from './MoveHistory';
import TurnTimer from './TurnTimer';
import EmotePanel from './EmotePanel';
import { getCubeKey, parseCubeKey, touchesAnyCube } from '../utils/boardUtils';
import { checkWin } from '../utils/winDetection';
import { canMoveCube, getDisconnectedCubes } from '../utils/connectivity';
import { generateRandomBoard } from '../utils/boardGeneration';
import logger from '../utils/logger';
import { toast } from 'react-toastify';

const Game = () => {
  const {
    board,
    setBoard,
    currentPlayer,
    setCurrentPlayer,
    players,
    setPlayers,
    selectedCube,
    setSelectedCube,
    winner,
    setWinner,
    winningLine,
    setWinningLine,
    winCondition,
    invalidMoveMessage,
    setInvalidMoveMessage,
    debugMode,
    resetGame,
    isOnlineMode,
    makeMove,
    playerSlot,
    leaveRoom,
    showConnectivityHints,
    sendCursorPosition,
    playerCursors,
    showPlayerCursors,
    turnTimerEnabled,
    turnTimerSeconds,
    sendEmote,
    playerEmotes,
    playerActivity,
    isConnected
  } = useGame();

  const [disconnectedCubes, setDisconnectedCubes] = useState([]);
  const [hoveredCube, setHoveredCube] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const [wasConnected, setWasConnected] = useState(isConnected);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showReturnHomeDialog, setShowReturnHomeDialog] = useState(false);
  const [showLeaveGameDialog, setShowLeaveGameDialog] = useState(false);

  // Warn about unsaved progress if user tries to refresh/close while game is active
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!winner && Object.keys(board).length > 0) {
        // Only warn if there's an active game (not finished)
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [winner, board]);

  // Initialize game start time when game begins
  useEffect(() => {
    if (gameStartTime === null && Object.keys(board).length === 0) {
      setGameStartTime(Date.now());
    }
  }, []);

  // Detect disconnections and show banner
  useEffect(() => {
    if (isOnlineMode) {
      if (!isConnected && wasConnected) {
        // Just disconnected
        toast.warning('⚠️ Connection lost. Attempting to reconnect...');
        setWasConnected(false);
      } else if (isConnected && !wasConnected) {
        // Just reconnected
        toast.success('✓ Reconnected!');
        setWasConnected(true);
      }
    }
  }, [isConnected, isOnlineMode, wasConnected]);

  const isMovementPhase = () => players[currentPlayer].cubesLeft === 0;
  const isYourTurn = !isOnlineMode || currentPlayer === playerSlot;

  const handleCellClick = (row, col) => {
    if (winner) return;
    if (isOnlineMode && !isYourTurn) return;

    const key = getCubeKey(row, col);
    const playerId = players[currentPlayer].id;

    logger.debug('Game', 'Cell clicked in ' + (isOnlineMode ? 'online' : 'local') + ' mode', { row, col, key, selectedCube, isMovementPhase: isMovementPhase() });

    // Use local game logic for both online and offline (then send move to server in online mode)
    if (isMovementPhase()) {
      handleMovementPhase(row, col, key, playerId);
    } else {
      handlePlacementPhase(row, col, key, playerId);
    }
  };

  const handlePlacementPhase = (row, col, key, playerId) => {
    if (board[key] !== undefined) {
      showToast('Square already occupied', 'error');
      return;
    }

    const isFirstCubeOfGame = Object.keys(board).length === 0;
    if (!isFirstCubeOfGame && !touchesAnyCube(row, col, board)) {
      showToast('Must touch an existing cube horizontally or vertically', 'warning');
      return;
    }

    const newBoard = { ...board, [key]: playerId };
    setBoard(newBoard);

    const newPlayers = [...players];
    newPlayers[currentPlayer].cubesLeft--;
    setPlayers(newPlayers);

    // Add to move history
    setMoveHistory(prev => [...prev, {
      playerId,
      row,
      col,
      type: 'place'
    }]);

    // In online mode, also send to server (server will validate and broadcast)
    if (isOnlineMode) {
      makeMove(row, col);
    }

    const { isWin, winningLine: line } = checkWin(row, col, playerId, newBoard, winCondition);
    if (isWin) {
      setWinner(players[currentPlayer]);
      setWinningLine(line);
      return;
    }

    setWinningLine([]);

    setCurrentPlayer((currentPlayer + 1) % players.length);
  };

  const handleMovementPhase = (row, col, key, playerId) => {
    logger.debug('Game', 'handleMovementPhase called', { row, col, key, playerId, selectedCube, isOnlineMode });
    
    if (selectedCube) {
      logger.debug('Game', 'Moving cube', { from: selectedCube, to: key });
      if (board[key] !== undefined) {
        logger.debug('Game', 'Destination occupied', { key, value: board[key] });
        showToast('Cannot move to occupied square', 'error');
        setSelectedCube(null);
        setDisconnectedCubes([]);
        return;
      }

      // Check if the destination is adjacent to at least one cube (after removing the selected cube)
      const tempBoard = { ...board };
      delete tempBoard[selectedCube];

      logger.debug('Game', 'Checking adjacency', { destKey: key, tempBoardSize: Object.keys(tempBoard).length });
      const touches = touchesAnyCube(row, col, tempBoard);
      logger.debug('Game', 'Adjacency check result', { touches });
      
      if (!touches) {
        logger.debug('Game', 'Move destination not adjacent');
        showToast('Must move adjacent to an existing cube', 'warning');
        setSelectedCube(null);
        setDisconnectedCubes([]);
        return;
      }

      const { row: fromRow, col: fromCol } = parseCubeKey(selectedCube);

      const newBoard = { ...board };
      delete newBoard[selectedCube];
      newBoard[key] = playerId;
      setBoard(newBoard);
      setSelectedCube(null);
      setDisconnectedCubes([]);

      // Add move to history
      setMoveHistory(prev => [...prev, {
        playerId,
        row,
        col,
        fromRow,
        fromCol,
        type: 'move'
      }]);

      // In online mode, also send to server (server will validate and broadcast)
      if (isOnlineMode) {
        makeMove(row, col, selectedCube);
      }

      const { isWin, winningLine: line } = checkWin(row, col, playerId, newBoard, winCondition);
      if (isWin) {
        setWinner(players[currentPlayer]);
        setWinningLine(line);
        return;
      }

      setWinningLine([]);

      setCurrentPlayer((currentPlayer + 1) % players.length);
    } else {
      if (board[key] === playerId) {
        // In online mode, skip client-side connectivity check - server will validate
        if (!isOnlineMode && !canMoveCube(key, playerId, board)) {
          // Show disconnected cubes if hints are enabled
          if (showConnectivityHints) {
            const disconnected = getDisconnectedCubes(key, playerId, board);
            setDisconnectedCubes(disconnected);
          }
          showToast('Cannot move - would break connectivity!', 'error');
          return;
        }
        setSelectedCube(key);
        setDisconnectedCubes([]);
      } else if (board[key] !== undefined) {
        showToast("That's not your cube!", 'warning');
      } else {
        showToast('Select one of your cubes to move first', 'info');
      }
      
      // In online mode, send cube selection to server
      if (isOnlineMode && board[key] === playerId) {
        makeMove(row, col);
      }
    }
  };

  const showToast = (message, type = 'error') => {
    switch (type) {
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      case 'success':
        toast.success(message);
        break;
      case 'info':
        toast.info(message);
        break;
      default:
        toast(message);
    }
  };

  const handleCubeHover = (key) => {
    // Send cursor position in online mode
    if (isOnlineMode && key) {
      const { row, col } = parseCubeKey(key);
      sendCursorPosition(row, col);
    }

    // Only show connectivity hints if enabled
    if (!showConnectivityHints) return;
    if (!isMovementPhase() || !isYourTurn || selectedCube || winner) return;

    // Only show disconnected cubes for current player's own cubes
    const currentPlayerId = players[currentPlayer].id;
    if (board[key] === currentPlayerId) {
      // Show which cubes would disconnect if this one is moved
      logger.debug('Game', 'Checking hover connectivity', { key, currentPlayerId, isMovementPhase: isMovementPhase(), isYourTurn, selectedCube });
      const disconnected = getDisconnectedCubes(key, currentPlayerId, board);
      logger.debug('Game', 'Disconnected cubes on hover', { key, disconnected });
      setHoveredCube(key);
      setDisconnectedCubes(disconnected);
    }
  };

  const handleCubeLeave = () => {
    if (!selectedCube) {
      setHoveredCube(null);
      setDisconnectedCubes([]);
    }
  };

  const handleRandomBoard = () => {
    // Reconstruct original cubes-per-player from current state (remaining + already placed)
    const anyPlayer = players[0];
    const cubesOnBoardPerPlayer = anyPlayer
      ? Object.values(board).filter(pid => pid === anyPlayer.id).length
      : 0;
    const cubesPerPlayerTotal = anyPlayer
      ? anyPlayer.cubesLeft + cubesOnBoardPerPlayer
      : undefined;

    const { board: newBoard, players: newPlayers } = generateRandomBoard(
      winCondition,
      players,
      cubesPerPlayerTotal
    );
    setBoard(newBoard);
    setPlayers(newPlayers);
    setCurrentPlayer(0);
    setSelectedCube(null);
    setWinner(null);
    setWinningLine([]);
    setInvalidMoveMessage('');
    setMoveHistory([]);
    setGameStartTime(Date.now());
  };

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const handleResetConfirm = () => {
    setMoveHistory([]);

    if (isOnlineMode) {
      leaveRoom(); // In online mode, leaving returns to lobby
    } else {
      // Local game: Reset board but stay in game (don't go to start screen)
      setBoard({});
      setCurrentPlayer(0);
      setPlayers(players.map(p => ({ ...p, cubesLeft: p.cubesLeft || 14 }))); // Reset cubes but keep player config
      setSelectedCube(null);
      setWinner(null);
      setWinningLine([]);
      setInvalidMoveMessage('');
      setDisconnectedCubes([]);
      setGameStartTime(Date.now());
      // Note: We don't call resetGame() because that sets gameStarted=false
    }
    setShowResetDialog(false);
  };

  const handleResetCancel = () => {
    setShowResetDialog(false);
  };

  const handleReturnHome = () => {
    setShowReturnHomeDialog(true);
  };

  const handleReturnHomeConfirm = () => {
    if (isOnlineMode) {
      leaveRoom();
    }
    resetGame(); // This goes back to start screen
    setShowReturnHomeDialog(false);
  };

  const handleReturnHomeCancel = () => {
    setShowReturnHomeDialog(false);
  };

  const handleLeaveGame = () => {
    // In online mode, show custom dialog before leaving
    if (isOnlineMode) {
      setShowLeaveGameDialog(true);
    }
  };

  const handleLeaveGameConfirm = () => {
    leaveRoom();
    setShowLeaveGameDialog(false);
  };

  const handleLeaveGameCancel = () => {
    setShowLeaveGameDialog(false);
  };

  const handleTurnTimeout = () => {
    // Only apply timeout if it's your turn (in online mode, only the active player's timeout counts)
    if (isOnlineMode && !isYourTurn) return;

    // Skip turn when timer runs out
    showToast(`${players[currentPlayer].name}'s turn timed out!`, 'warning');
    setSelectedCube(null);
    setDisconnectedCubes([]);
    
    // In online mode, send a skip turn action to the server
    if (isOnlineMode) {
      // Emit a special move that the server interprets as a turn skip
      makeMove(-1, -1);
    } else {
      // In local mode, just advance the turn
      setCurrentPlayer((currentPlayer + 1) % players.length);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-2 sm:p-4">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleReturnHome} title="Return to menu">
              <img src="/favicon.png" alt="Cube Connect" className="w-16 h-16 sm:w-16 sm:h-16 -mr-2 sm:-mr-3" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                Cube Connect
                {isOnlineMode && (
                  <span className="ml-2 text-sm sm:text-base font-normal text-slate-600">
                    (Multiplayer)
                  </span>
                )}
              </h1>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center w-full sm:w-auto">
              <PlayerStatus
                players={players}
                currentPlayer={currentPlayer}
                isOnlineMode={isOnlineMode}
                playerSlot={playerSlot}
                playerActivity={playerActivity}
              />

              {turnTimerEnabled && !winner && (
                <TurnTimer
                  isActive={true}
                  timerSeconds={turnTimerSeconds}
                  onTimeout={handleTurnTimeout}
                  currentPlayer={currentPlayer}
                  players={players}
                />
              )}

              <GameControls
                onReset={handleReset}
                onRandomBoard={handleRandomBoard}
                onLeaveGame={handleLeaveGame}
                debugMode={debugMode}
                isOnlineMode={isOnlineMode}
              />

              {isOnlineMode && (
                <EmotePanel
                  onSendEmote={sendEmote}
                  playerEmotes={playerEmotes}
                  players={players}
                />
              )}
            </div>
          </div>

          <GameMessages
            invalidMoveMessage={invalidMoveMessage}
            isMovementPhase={isMovementPhase()}
            selectedCube={selectedCube}
            winner={winner}
            isOnlineMode={isOnlineMode}
            isYourTurn={isYourTurn}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-3 sm:gap-4">
          <GameBoard
            board={board}
            selectedCube={selectedCube}
            disconnectedCubes={disconnectedCubes}
            winningLine={winningLine}
            onCellClick={handleCellClick}
            onCubeHover={handleCubeHover}
            onCubeLeave={handleCubeLeave}
            players={players}
            playerCursors={showPlayerCursors ? playerCursors : {}}
            currentPlayerSlot={playerSlot}
          />

          <div className="space-y-3 sm:space-y-4 flex flex-col">
            <GameInfo
              winCondition={winCondition}
              gameStartTime={gameStartTime}
              players={players}
              currentPlayer={currentPlayer}
              debugMode={debugMode}
            />
            <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 flex-1 overflow-auto min-h-[300px]">
              <h3 className="font-bold text-slate-800 mb-3">Move History</h3>
              <MoveHistory moves={moveHistory} players={players} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Reset confirmation dialog overlay */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Reset the board?</h2>
            <p className="text-slate-600 mb-6">
              This will start a new game with the same players.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetCancel}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Return to menu confirmation dialog overlay */}
      {showReturnHomeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Return to menu?</h2>
            <p className="text-slate-600 mb-6">
              This will end the current game.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleReturnHomeCancel}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnHomeConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave game confirmation dialog overlay */}
      {showLeaveGameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Leave the game?</h2>
            <p className="text-slate-600 mb-6">
              Other players will see you as disconnected. You can rejoin within 2 minutes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLeaveGameCancel}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveGameConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
