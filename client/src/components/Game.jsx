import React, { useState, useEffect } from 'react';
import { useGame } from '../context/useGame';
import GameBoard from './GameBoard';
import PlayerStatus from './PlayerStatus';
import GameControls from './GameControls';
import GameMessages from './GameMessages';
import MoveHistory from './MoveHistory';
import TurnTimer from './TurnTimer';
import EmotePanel from './EmotePanel';
import { getCubeKey, parseCubeKey, touchesAnyCube } from '../utils/boardUtils';
import { checkWin } from '../utils/winDetection';
import { canMoveCube, getDisconnectedCubes } from '../utils/connectivity';
import { generateRandomBoard } from '../utils/boardGeneration';
import { toast } from 'react-toastify';
import { AlertCircle } from 'lucide-react';

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

    // In online mode, send move to server
    if (isOnlineMode) {
      makeMove(row, col, selectedCube);
      return;
    }

    // Local game logic
    if (isMovementPhase()) {
      handleMovementPhase(row, col, key, playerId);
    } else {
      handlePlacementPhase(row, col, key, playerId);
    }
  };

  const handlePlacementPhase = (row, col, key, playerId) => {
    if (board[key]) {
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

    if (checkWin(row, col, playerId, newBoard, winCondition)) {
      setWinner(players[currentPlayer]);
      return;
    }

    setCurrentPlayer((currentPlayer + 1) % players.length);
  };

  const handleMovementPhase = (row, col, key, playerId) => {
    if (selectedCube) {
      if (board[key]) {
        showToast('Cannot move to occupied square', 'error');
        setSelectedCube(null);
        setDisconnectedCubes([]);
        return;
      }

      // Check if the destination is adjacent to at least one cube (after removing the selected cube)
      const tempBoard = { ...board };
      delete tempBoard[selectedCube];

      if (!touchesAnyCube(row, col, tempBoard)) {
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

      if (checkWin(row, col, playerId, newBoard, winCondition)) {
        setWinner(players[currentPlayer]);
        return;
      }

      setCurrentPlayer((currentPlayer + 1) % players.length);
    } else {
      if (board[key] === playerId) {
        if (!canMoveCube(key, playerId, board)) {
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
      } else if (board[key]) {
        showToast("That's not your cube!", 'warning');
      } else {
        showToast('Select one of your cubes to move first', 'info');
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

    const playerId = players[currentPlayer].id;
    if (board[key] === playerId && !canMoveCube(key, playerId, board)) {
      // Show disconnected cubes on hover
      const disconnected = getDisconnectedCubes(key, playerId, board);
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
    const { board: newBoard, players: newPlayers } = generateRandomBoard(winCondition);
    setBoard(newBoard);
    setPlayers(newPlayers);
    setCurrentPlayer(0);
    setSelectedCube(null);
    setWinner(null);
    setInvalidMoveMessage('');
    setMoveHistory([]);
  };

  const handleReset = () => {
    if (!confirm('Reset the board? This will start a new game with the same players.')) {
      return;
    }

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
      setInvalidMoveMessage('');
      setDisconnectedCubes([]);
      // Note: We don't call resetGame() because that sets gameStarted=false
    }
  };

  const handleReturnHome = () => {
    if (confirm('Return to menu? This will end the current game.')) {
      if (isOnlineMode) {
        leaveRoom();
      }
      resetGame(); // This goes back to start screen
    }
  };

  const handleLeaveGame = () => {
    // In online mode, confirm before leaving an active game
    if (isOnlineMode) {
      if (confirm('Leave the game? Other players will see you as disconnected.')) {
        leaveRoom();
      }
    }
  };

  const handleTurnTimeout = () => {
    // Skip turn when timer runs out
    showToast(`${players[currentPlayer].name}'s turn timed out!`, 'warning');
    setSelectedCube(null);
    setDisconnectedCubes([]);
    setCurrentPlayer((currentPlayer + 1) % players.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-2 sm:p-4">
      <div className="max-w-[1800px] mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <h1
              className="text-xl sm:text-2xl font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
              onClick={handleReturnHome}
              title="Return to menu"
            >
              Cube Connect
              {isOnlineMode && (
                <span className="ml-2 text-sm sm:text-base font-normal text-slate-600">
                  (Online)
                </span>
              )}
            </h1>

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
                  isActive={!isOnlineMode || isYourTurn}
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-3 sm:gap-4">
          <GameBoard
            board={board}
            selectedCube={selectedCube}
            disconnectedCubes={disconnectedCubes}
            onCellClick={handleCellClick}
            onCubeHover={handleCubeHover}
            onCubeLeave={handleCubeLeave}
            players={players}
            playerCursors={showPlayerCursors ? playerCursors : {}}
            currentPlayerSlot={playerSlot}
          />

          <div className="lg:h-[600px] h-[300px]">
            <MoveHistory moves={moveHistory} players={players} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
