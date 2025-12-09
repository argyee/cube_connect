import roomManager from '../services/roomManager.js';
import logger from '../utils/logger.js';
import {
  getCubeKey,
  parseCubeKey,
  touchesAnyCube,
  canMoveCube,
  checkWin
} from '../utils/gameLogic.js';

export const handleResetGame = (socket, io, { roomCode }) => {
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    socket.emit('error', { message: 'Room not found' });
    return;
  }

  // Only allow host (player slot 0) to reset
  const playerSlot = room.players.findIndex(p => p?.socketId === socket.id);
  if (playerSlot !== 0) {
    socket.emit('error', { message: 'Only the host can reset the game' });
    return;
  }

  // Reset game state but preserve room and players
  // Keep gameStarted = true to avoid going back to lobby
  const freshPlayers = room.players.map(p => ({
    ...p,
    cubesLeft: room.cubesPerPlayer
  }));

  room.gameState = {
    board: {},
    currentPlayer: 0,
    players: freshPlayers,
    moveCount: 0,
    winCondition: room.winCondition
  };

  logger.info(`Game reset in room ${roomCode} by host`);

  // Broadcast fresh game state to all players
  io.to(roomCode).emit('gameReset', {
    gameState: room.gameState
  });
};

export const handleCreateRoom = (socket, { winCondition, playerCount, cubesPerPlayer, playerName }) => {
  logger.info(`Create room request: win=${winCondition}, players=${playerCount}, cubes=${cubesPerPlayer}`);
  const room = roomManager.createRoom(winCondition, playerCount, cubesPerPlayer);
  const result = roomManager.joinRoom(room.code, socket.id, playerName);

  if (result.success) {
    logger.info(`Room created: ${room.code} (player slot ${result.playerSlot})`);
    socket.join(room.code);
    socket.emit('roomCreated', {
      roomCode: room.code,
      maxPlayers: room.maxPlayers,
      cubesPerPlayer: room.cubesPerPlayer
    });
    socket.emit('roomJoined', {
      roomCode: room.code,
      playerSlot: result.playerSlot,
      players: room.players,
      maxPlayers: room.maxPlayers,
      cubesPerPlayer: room.cubesPerPlayer,
      winCondition: room.winCondition
    });
  }
};

export const handleJoinRoom = (socket, io, { roomCode, playerName }, callback) => {
  logger.info(`Join room request: ${roomCode}`);
  const result = roomManager.joinRoom(roomCode, socket.id, playerName);

  if (!result.success) {
    logger.warn(`Failed to join room ${roomCode}: ${result.error}`);
    // Acknowledge failure if callback provided
    if (callback) callback(result.error);
    socket.emit('error', { message: result.error });
    return;
  }

  logger.info(`Player joined room ${roomCode} (slot ${result.playerSlot})`);
  socket.join(roomCode);
  socket.emit('roomJoined', {
    roomCode,
    playerSlot: result.playerSlot,
    players: result.room.players,
    maxPlayers: result.room.maxPlayers,
    cubesPerPlayer: result.room.cubesPerPlayer,
    winCondition: result.room.winCondition
  });

  // Notify other players
  socket.to(roomCode).emit('playerJoined', {
    players: result.room.players
  });

  // Acknowledge success
  if (callback) callback(null, { playerSlot: result.playerSlot });
};

export const handleLeaveRoom = (socket, io) => {
  logger.info(`Leave room request`);
  const result = roomManager.leaveRoom(socket.id);

  if (result && !result.roomDeleted) {
    logger.info(`Player left room ${result.room.code}`);
    socket.to(result.room.code).emit('playerLeft', {
      players: result.room.players
    });
  } else if (result && result.roomDeleted) {
    logger.info(`Room deleted (was empty): ${result.room?.code}`);
  }

  // Only call socket.leave when we have a valid room code
  if (result && result.room && result.room.code) {
    socket.leave(result.room.code);
  }
};

export const handleStartGame = (socket, io, { roomCode }) => {
  logger.info(`Start game request in room ${roomCode}`);
  const result = roomManager.startGame(roomCode);

  if (!result.success) {
    logger.warn(`Failed to start game in ${roomCode}: ${result.error}`);
    socket.emit('error', { message: result.error });
    return;
  }

  logger.info(`Game started in room ${roomCode}`);
  // Get room to access maxPlayers, cubesPerPlayer, and players
  const room = roomManager.getRoom(roomCode);
  
  // Send individual gameStarted event to each player with their playerSlot
  // This ensures each client knows its own slot for session persistence
  room.players.forEach((player) => {
    logger.info(`Sending gameStarted to player slot ${player.slot} (${player.socketId}) in room ${roomCode}`);
    io.to(player.socketId).emit('gameStarted', {
      gameState: result.gameState,
      roomCode: roomCode,
      playerSlot: player.slot,
      maxPlayers: room.maxPlayers,
      cubesPerPlayer: room.cubesPerPlayer
    });
  });
};

export const handleMakeMove = (socket, io, { roomCode, row, col, selectedCube }) => {
  const room = roomManager.getRoom(roomCode);

  if (!room || !room.started) {
    logger.warn(`Move attempt in non-started game: ${roomCode}`);
    socket.emit('error', { message: 'Game not started' });
    return;
  }

  const gameState = room.gameState;
  const player = room.players.find(p => p.socketId === socket.id);

  if (!player) {
    logger.warn(`Move from unregistered player in room ${roomCode}`);
    socket.emit('error', { message: 'You are not in this game' });
    return;
  }

  // Validate it's the player's turn
  if (player.slot !== gameState.currentPlayer) {
    logger.debug(`Invalid move: wrong turn in ${roomCode}`);
    socket.emit('invalidMove', { message: "Not your turn" });
    return;
  }

  // Handle turn timeout skip (row=-1, col=-1 is a special signal from client)
  if (row === -1 && col === -1) {
    logger.info(`Turn timeout skip in ${roomCode}: Player ${player.slot} (${player.name})`);
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
    roomManager.updateGameState(roomCode, gameState);
    io.to(roomCode).emit('gameStateUpdate', { gameState });
    return;
  }

  const key = getCubeKey(row, col);
  const playerId = gameState.players[gameState.currentPlayer].id;
  const isMovementPhase = gameState.players[gameState.currentPlayer].cubesLeft === 0;

  // Validate and execute move
  if (isMovementPhase) {
    const moveResult = handleMovementMove(gameState, key, playerId, selectedCube, socket);
    if (!moveResult.valid) return;

    if (moveResult.gameState) {
      gameState.board = moveResult.gameState.board;
      gameState.currentPlayer = moveResult.gameState.currentPlayer;
      gameState.winner = moveResult.gameState.winner;
      gameState.winningLine = moveResult.gameState.winningLine || [];
      gameState.selectedCube = moveResult.gameState.selectedCube || null;
      if (moveResult.gameState.players) {
        gameState.players = moveResult.gameState.players;
      }
    }
  } else {
    const moveResult = handlePlacementMove(gameState, row, col, key, playerId, socket);
    if (!moveResult.valid) return;

    if (moveResult.gameState) {
      gameState.board = moveResult.gameState.board;
      gameState.currentPlayer = moveResult.gameState.currentPlayer;
      gameState.winner = moveResult.gameState.winner;
      gameState.winningLine = moveResult.gameState.winningLine || [];
      if (moveResult.gameState.players) {
        gameState.players = moveResult.gameState.players;
      }
    }
  }

  logger.debug(`Move in ${roomCode}: [${row}, ${col}] by player ${player.slot}`);

  // Update room state
  roomManager.updateGameState(roomCode, gameState);

  // Log current game state for debugging
  logger.debug(`After move - roomCode=${roomCode}, currentPlayer=${gameState.currentPlayer}, players.length=${gameState.players.length}, board keys=${Object.keys(gameState.board).length}`);

  // Broadcast updated game state to all players
  io.to(roomCode).emit('gameStateUpdate', { gameState });

  if (gameState.winner) {
    logger.info(`Game won in ${roomCode}: ${gameState.winner.name}`);
  }
};

const handlePlacementMove = (gameState, row, col, key, playerId, socket) => {
  if (gameState.board[key]) {
    socket.emit('invalidMove', { message: 'Square already occupied' });
    return { valid: false };
  }

  const isFirstCubeOfGame = Object.keys(gameState.board).length === 0;
  
  // Debug log to check board state
  logger.debug(`Placement check: row=${row}, col=${col}, key=${key}, boardKeys=${JSON.stringify(Object.keys(gameState.board))}`);
  
  if (!isFirstCubeOfGame && !touchesAnyCube(row, col, gameState.board)) {
    socket.emit('invalidMove', {
      message: 'Must touch an existing cube (horizontally or vertically)'
    });
    return { valid: false };
  }

  const newBoard = { ...gameState.board, [key]: playerId };
  const newPlayers = [...gameState.players];
  newPlayers[gameState.currentPlayer].cubesLeft--;

  const { isWin, winningLine } = checkWin(row, col, playerId, newBoard, gameState.winCondition);
  const winner = isWin ? gameState.players[gameState.currentPlayer] : null;

  return {
    valid: true,
    gameState: {
      board: newBoard,
      players: newPlayers,
      currentPlayer: isWin ? gameState.currentPlayer : (gameState.currentPlayer + 1) % gameState.players.length,
      winner,
      winningLine: isWin ? winningLine : []
    }
  };
};

const handleMovementMove = (gameState, key, playerId, selectedCube, socket) => {
  if (selectedCube) {
    if (gameState.board[key]) {
      socket.emit('invalidMove', { message: 'Cannot move to occupied square' });
      return { valid: false };
    }

    const { row, col } = parseCubeKey(key);
    
    // Check if destination touches an existing cube (after removing the selected cube)
    const tempBoard = { ...gameState.board };
    delete tempBoard[selectedCube];
    
    // If there are other cubes on the board, the new position must touch one
    if (Object.keys(tempBoard).length > 0 && !touchesAnyCube(row, col, tempBoard)) {
      socket.emit('invalidMove', {
        message: 'Must touch an existing cube (horizontally or vertically)'
      });
      return { valid: false };
    }

    // Create the final board state with the moved cube
    const newBoard = { ...tempBoard, [key]: playerId };

    const { isWin, winningLine } = checkWin(row, col, playerId, newBoard, gameState.winCondition);
    const winner = isWin ? gameState.players[gameState.currentPlayer] : null;

    return {
      valid: true,
      gameState: {
        board: newBoard,
        players: gameState.players,
        currentPlayer: isWin ? gameState.currentPlayer : (gameState.currentPlayer + 1) % gameState.players.length,
        winner,
        winningLine: isWin ? winningLine : [],
        selectedCube: null
      }
    };
  } else {
    if (gameState.board[key] === playerId) {
      // Just selecting a cube - no need to validate connectivity yet
      // Connectivity is only checked when the move is actually executed (destination clicked)
      // Return with updated selectedCube in gameState
      return {
        valid: true,
        gameState: {
          board: gameState.board,
          players: gameState.players,
          currentPlayer: gameState.currentPlayer,
          winner: gameState.winner,
          winningLine: gameState.winningLine || [],
          selectedCube: key
        }
      };
    } else if (gameState.board[key]) {
      socket.emit('invalidMove', { message: "That's not your cube!" });
      return { valid: false };
    } else {
      socket.emit('invalidMove', { message: 'Select one of your cubes to move first' });
      return { valid: false };
    }
  }
};

export const handleDisconnect = (socket, io) => {
  logger.info(`Disconnect handler triggered`);
  const result = roomManager.leaveRoom(socket.id);

  if (result && !result.roomDeleted) {
    logger.info(`Player disconnected from room ${result.room.code}`);
    io.to(result.room.code).emit('playerLeft', {
      players: result.room.players
    });
  } else if (result && result.roomDeleted) {
    logger.info(`Room deleted after disconnect: ${result.room?.code}`);
  }
};

export const handleReconnect = (socket, io, { roomCode, playerSlot }, callback) => {
  logger.info(`Reconnect request: room ${roomCode}, slot ${playerSlot}`);
  const result = roomManager.reconnectPlayer(roomCode, socket.id, playerSlot);

  if (!result.success) {
    logger.warn(`Failed to reconnect to room ${roomCode}: ${result.error}`);
    // Acknowledge with error
    if (callback) callback(result.error);
    socket.emit('error', { message: result.error });
    return;
  }

  logger.info(`Player reconnected to room ${roomCode}`);
  socket.join(roomCode);
  
  // Acknowledge with success (no error)
  if (callback) callback(null);
  
  socket.emit('roomJoined', {
    roomCode,
    playerSlot: result.playerSlot,
    players: result.room.players,
    maxPlayers: result.room.maxPlayers,
    cubesPerPlayer: result.room.cubesPerPlayer,
    winCondition: result.room.winCondition
  });

  // Notify other players of reconnection
  io.to(roomCode).emit('playerReconnected', {
    playerSlot: result.playerSlot,
    players: result.room.players
  });

  // If game is in progress, send current game state
  if (result.room.gameState) {
    socket.emit('gameStarted', {
      gameState: result.room.gameState,
      roomCode: roomCode,
      playerSlot: result.playerSlot,
      maxPlayers: result.room.maxPlayers,
      cubesPerPlayer: result.room.cubesPerPlayer
    });
  }
};

export const handleSetReady = (socket, io, { roomCode, playerSlot }) => {
  logger.debug(`Set ready request: room ${roomCode}, slot ${playerSlot}`);
  const result = roomManager.setPlayerReady(roomCode, playerSlot);

  if (!result.success) {
    logger.warn(`Failed to set ready in ${roomCode}: ${result.error}`);
    socket.emit('error', { message: result.error });
    return;
  }

  logger.debug(`Player ${playerSlot} is ready in room ${roomCode}`);
  // Broadcast ready status to all players in room
  io.to(roomCode).emit('playerReady', { playerSlot });
};

export const handleSetNotReady = (socket, io, { roomCode, playerSlot }) => {
  logger.debug(`Set not ready request: room ${roomCode}, slot ${playerSlot}`);
  const result = roomManager.setPlayerNotReady(roomCode, playerSlot);

  if (!result.success) {
    logger.warn(`Failed to set not ready in ${roomCode}: ${result.error}`);
    socket.emit('error', { message: result.error });
    return;
  }

  logger.debug(`Player ${playerSlot} is not ready in room ${roomCode}`);
  // Broadcast not ready status to all players in room
  io.to(roomCode).emit('playerNotReady', { playerSlot });
};
