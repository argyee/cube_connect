import React, { useContext, useState, useEffect, useRef } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { PLAYERS_CONFIG, INITIAL_CUBES, WIN_CONDITIONS } from '../utils/constants.js';
import { 
  saveRoomSession, 
  loadRoomSession, 
  clearRoomSession,
  saveGameState,
  loadGameState,
  clearGameState 
} from '../utils/sessionStorage.js';
import logger from '../utils/logger.js';
import App from "../App";
import { GameContext } from './useGame.js';

export const GameProvider = ({ children }) => {
  const navigate = useNavigate();

  // Game state
  const [board, setBoard] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [players, setPlayers] = useState(
    PLAYERS_CONFIG.map(p => ({ ...p, cubesLeft: INITIAL_CUBES }))
  );
  const [selectedCube, setSelectedCube] = useState(null);
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);
  const [winCondition, setWinCondition] = useState(WIN_CONDITIONS.DEFAULT);
  const [invalidMoveMessage, setInvalidMoveMessage] = useState('');

  // Multiplayer state
  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [playerSlot, setPlayerSlot] = useState(null); // Player slot number (0-5)
  const [roomPlayers, setRoomPlayers] = useState([]); // List of connected players
  const [playerReadyStatus, setPlayerReadyStatus] = useState({}); // { slot: true/false } - track which players are ready
  const [roomMaxPlayers, setRoomMaxPlayers] = useState(3); // Max players for this room (2-6)
  const [roomCubesPerPlayer, setRoomCubesPerPlayer] = useState(INITIAL_CUBES); // Cubes per player for this room
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  // UI state
  const [gameStarted, setGameStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  // Socket lifecycle helpers
  const socketRef = useRef(null);
  const socketReadyResolveRef = useRef(null);
  const socketReadyPromiseRef = useRef(null);
  if (!socketReadyPromiseRef.current) {
    socketReadyPromiseRef.current = new Promise((resolve) => {
      socketReadyResolveRef.current = resolve;
    });
  }

  // Refs to hold latest values for use in socket event handlers (avoid stale closures)
  const roomCodeRef = useRef(roomCode);
  const playerSlotRef = useRef(playerSlot);
  const roomPlayersRef = useRef(roomPlayers);
  const roomMaxPlayersRef = useRef(roomMaxPlayers);
  const roomCubesPerPlayerRef = useRef(roomCubesPerPlayer);
  const winConditionRef = useRef(winCondition);
  const isInRoomRef = useRef(isInRoom);
  const gameStartedRef = useRef(gameStarted);

  // Game options/settings
  const [showConnectivityHints, setShowConnectivityHints] = useState(true);
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(false);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(60);
  const [showPlayerCursors, setShowPlayerCursors] = useState(true);

  // Multiplayer features
  const [playerCursors, setPlayerCursors] = useState({}); // { playerId: { row, col, timestamp } }
  const [playerActivity, setPlayerActivity] = useState({}); // { playerId: lastActiveTimestamp }
  const [playerEmotes, setPlayerEmotes] = useState([]); // Array of { playerId, emote, timestamp }

  // Initialize socket connection
  useEffect(() => {
    // Keep refs updated with latest state so socket handlers can access them
    roomCodeRef.current = roomCode;
    playerSlotRef.current = playerSlot;
    roomPlayersRef.current = roomPlayers;
    roomMaxPlayersRef.current = roomMaxPlayers;
    roomCubesPerPlayerRef.current = roomCubesPerPlayer;
    winConditionRef.current = winCondition;
    gameStartedRef.current = gameStarted;
    isInRoomRef.current = isInRoom;

    // Auto-detect socket URL based on current host (works for localhost, network IP, and production)
    // Behavior:
    // - If `VITE_SOCKET_URL` is provided at build time, use it.
    // - Otherwise, default to same-origin (Express serves both static files and Socket.IO).
    const getSocketURL = () => {
      if (import.meta.env.VITE_SOCKET_URL) {
        return import.meta.env.VITE_SOCKET_URL;
      }

      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';

      // Use same-origin (no hard-coded backend port). Express serves everything on the same port.
      return `${protocol}//${hostname}${port}`;
    };

    const SOCKET_URL = getSocketURL();
    logger.info('GameContext', `Connecting to socket server: ${SOCKET_URL}`);

    const newSocket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3,
      timeout: 5000
    });

    // Connection events
    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError('');
      logger.info('GameContext', 'Socket connected');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      logger.info('GameContext', 'Socket disconnected', { reason });

      // Persist session on unexpected disconnect so user can rejoin from Home
      try {
        const rc = roomCodeRef.current;
        if (rc) {
          const slotToSave = gameStartedRef.current ? playerSlotRef.current : null;
          const currentPlayer = roomPlayersRef.current?.[playerSlotRef.current] || null;
          saveRoomSession({
            roomCode: rc,
            playerSlot: slotToSave,
            playerName: currentPlayer?.name || null,
            maxPlayers: roomMaxPlayersRef.current,
            cubesPerPlayer: roomCubesPerPlayerRef.current,
            winCondition: winConditionRef.current
          });
          logger.info('GameContext', 'Room session saved on disconnect', { roomCode: rc, playerSlot: slotToSave });
        }
      } catch (e) {
        logger.warn('GameContext', 'Failed to save session on disconnect', e);
      }

      // If disconnected due to server namespace disconnect, don't reconnect
      if (reason === 'io server disconnect') {
        newSocket.disconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      logger.warn('GameContext', 'Socket connection error', { message: error.message });
      setConnectionError('Failed to connect to server');
      setIsConnected(false);
    });
    
    newSocket.on('reconnect_failed', () => {
      logger.error('GameContext', 'Socket reconnection failed after all attempts');
      setConnectionError('Could not connect to server');
    });

    // Room events
    newSocket.on('roomCreated', ({ roomCode: code, maxPlayers, cubesPerPlayer }) => {
      logger.info('GameContext', 'Room created event received', { code, maxPlayers, cubesPerPlayer });
      setRoomCode(code);
      setIsInRoom(true);
      setPlayerReadyStatus({});
      if (maxPlayers) setRoomMaxPlayers(maxPlayers);
      if (cubesPerPlayer) setRoomCubesPerPlayer(cubesPerPlayer);
      
      // Clear any stale session with intentionalLeave flag before navigating to new lobby
      clearRoomSession();
      
      // Room session persistence happens in the roomJoined handler once server assigns slots
    });

    newSocket.on('roomJoined', ({ roomCode: code, playerSlot: slot, players: roomPlayersList, maxPlayers, cubesPerPlayer, winCondition: winCond }) => {
      logger.info('GameContext', 'Room joined event received', { code, slot, playerCount: roomPlayersList.length, maxPlayers, cubesPerPlayer, winCond });
      setRoomCode(code);
      setPlayerSlot(slot);
      setIsInRoom(true);
      setRoomPlayers(roomPlayersList);
      const readyStatus = {};
      roomPlayersList.forEach((player, index) => {
        readyStatus[index] = player.ready || false;
      });
      setPlayerReadyStatus(readyStatus);
      if (maxPlayers) setRoomMaxPlayers(maxPlayers);
      if (cubesPerPlayer) setRoomCubesPerPlayer(cubesPerPlayer);
      if (winCond) setWinCondition(winCond);

      if (code) {
        const resolvedMaxPlayers = maxPlayers || roomMaxPlayers;
        const resolvedCubesPerPlayer = cubesPerPlayer || roomCubesPerPlayer;
        const resolvedWinCondition = winCond || winCondition;
        const currentPlayer = roomPlayersList?.[slot] || null;

        saveRoomSession({
          roomCode: code,
          playerSlot: slot ?? null,
          playerName: currentPlayer?.name || null,
          maxPlayers: resolvedMaxPlayers,
          cubesPerPlayer: resolvedCubesPerPlayer,
          winCondition: resolvedWinCondition
        });

        logger.info('GameContext', 'Room session saved on roomJoined', {
          roomCode: code,
          playerSlot: slot,
          maxPlayers: resolvedMaxPlayers,
          cubesPerPlayer: resolvedCubesPerPlayer,
          winCondition: resolvedWinCondition,
          playerName: currentPlayer?.name || 'unknown'
        });
      }
    });

    newSocket.on('playerJoined', ({ players: roomPlayersList }) => {
      setRoomPlayers(roomPlayersList);
    });

    newSocket.on('playerLeft', ({ players: roomPlayersList }) => {
      setRoomPlayers(roomPlayersList);
    });

    newSocket.on('playerReconnected', ({ playerSlot, players: roomPlayersList }) => {
      setRoomPlayers(roomPlayersList);
      logger.info('GameContext', 'Player reconnected', { playerSlot });
    });

    newSocket.on('playerReady', ({ playerSlot }) => {
      setPlayerReadyStatus(prev => ({ ...prev, [playerSlot]: true }));
    });

    newSocket.on('playerNotReady', ({ playerSlot }) => {
      setPlayerReadyStatus(prev => ({ ...prev, [playerSlot]: false }));
    });

    newSocket.on('gameStarted', ({ gameState, roomCode: eventRoomCode, playerSlot: eventPlayerSlot, maxPlayers: eventMaxPlayers, cubesPerPlayer: eventCubesPerPlayer }) => {
      logger.info('GameContext', 'Game started event received', {
        eventRoomCode,
        eventPlayerSlot,
        eventMaxPlayers,
        eventCubesPerPlayer,
        hasGameState: !!gameState
      });
      
      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      setPlayers(gameState.players);
      setWinCondition(gameState.winCondition);
      setGameStarted(true);
      setWinner(null);
      setWinningLine([]);
      setSelectedCube(null);
      
      const roomCodeToSave = eventRoomCode || roomCode;
      const playerSlotToSave = eventPlayerSlot !== undefined ? eventPlayerSlot : playerSlot;
      const maxPlayersToSave = eventMaxPlayers || roomMaxPlayers;
      const cubesPerPlayerToSave = eventCubesPerPlayer || roomCubesPerPlayer;
      
      logger.info('GameContext', 'Saving room session after game start', {
        roomCode: roomCodeToSave,
        playerSlot: playerSlotToSave,
        maxPlayers: maxPlayersToSave,
        cubesPerPlayer: cubesPerPlayerToSave,
        winCondition: gameState.winCondition
      });
      
      if (roomCodeToSave && playerSlotToSave !== null && playerSlotToSave !== undefined) {
        saveRoomSession({
          roomCode: roomCodeToSave,
          playerSlot: playerSlotToSave,
          playerName: null,
          maxPlayers: maxPlayersToSave,
          cubesPerPlayer: cubesPerPlayerToSave,
          winCondition: gameState.winCondition
        });
        logger.info('GameContext', 'Room session saved successfully after game start');
      } else {
        logger.warn('GameContext', 'Could not save room session - missing roomCode or playerSlot', { roomCodeToSave, playerSlotToSave });
      }
      
      saveGameState({
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        players: gameState.players,
        winner: null,
        winningLine: [],
        selectedCube: null,
        roomCode
      });
    });

    newSocket.on('gameStateUpdate', ({ gameState }) => {
      // Check if turn is changing by comparing board state - if it's different, a move was made
      const boardChanged = JSON.stringify(gameState.board) !== JSON.stringify(board);
      
      logger.debug('GameContext', 'Received gameStateUpdate', {
        currentPlayer: gameState.currentPlayer,
        playersLength: gameState.players?.length,
        selectedCube: gameState.selectedCube,
        boardSize: Object.keys(gameState.board).length
      });
      
      setBoard(gameState.board);
      // Defensive: if server currentPlayer is out of range, fallback to 0
      const safeCurrent =
        typeof gameState.currentPlayer === 'number' &&
        gameState.players &&
        gameState.currentPlayer >= 0 &&
        gameState.currentPlayer < gameState.players.length
          ? gameState.currentPlayer
          : 0;
      if (safeCurrent !== gameState.currentPlayer) {
        logger.warn('GameContext', 'Adjusting invalid currentPlayer from server', {
          serverCurrentPlayer: gameState.currentPlayer,
          playersLength: gameState.players?.length
        });
      }
      setCurrentPlayer(safeCurrent);
      setPlayers(gameState.players);
      
      // Update selectedCube from server (either set during selection or cleared after move)
      setSelectedCube(gameState.selectedCube || null);
      
      if (gameState.winner) {
        setWinner(gameState.winner);
      }
      setWinningLine(gameState.winningLine || []);
      
      // Update saved game state for recovery after refresh
      saveGameState({
        board: gameState.board,
        currentPlayer: gameState.currentPlayer,
        players: gameState.players,
        winner: gameState.winner || null,
        winningLine: gameState.winningLine || [],
        selectedCube: null,
        roomCode
      });
    });

    newSocket.on('invalidMove', ({ message }) => {
      setInvalidMoveMessage(message);
      setTimeout(() => setInvalidMoveMessage(''), 2000);
    });

    newSocket.on('error', ({ message }) => {
      setConnectionError(message);
      setTimeout(() => setConnectionError(''), 3000);
    });

    // Cursor tracking events
    newSocket.on('playerCursorMove', ({ playerId, row, col }) => {
      setPlayerCursors(prev => ({
        ...prev,
        [playerId]: { row, col, timestamp: Date.now() }
      }));
      setPlayerActivity(prev => ({
        ...prev,
        [playerId]: Date.now()
      }));
    });

    // Player activity events
    newSocket.on('playerActivity', ({ playerId }) => {
      setPlayerActivity(prev => ({
        ...prev,
        [playerId]: Date.now()
      }));
    });

    // Emote events
    newSocket.on('playerEmote', ({ playerId, emote, timestamp, playerName }) => {
      setPlayerEmotes(prev => [...prev, { playerId, emote, timestamp, playerName }]);
    });

    // Timer state change from host
    newSocket.on('timerStateChanged', ({ enabled }) => {
      logger.info('GameContext', 'Timer state changed', { enabled });
      setTurnTimerEnabled(enabled);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;
    socketReadyResolveRef.current?.(newSocket);

    // Try to reconnect to saved session on mount
    const attemptAutoReconnect = async () => {
      // Treat saved sessions older than 10 minutes as expired
      const savedRoomSession = loadRoomSession(10 * 60 * 1000);
      const savedGameState = loadGameState(10 * 60 * 1000);

      // If there's a saved room session and game was in progress, try to reconnect
      if (savedRoomSession && savedRoomSession.roomCode && savedGameState) {
        try {
          await new Promise((resolve, reject) => {
            const onConnect = () => {
              cleanup();
              resolve();
            };
            const onError = (error) => {
              cleanup();
              reject(error);
            };
            const cleanup = () => {
              newSocket.off('connect', onConnect);
              newSocket.off('connect_error', onError);
            };

            newSocket.once('connect', onConnect);
            newSocket.once('connect_error', onError);
            newSocket.connect();

            // Timeout after 5 seconds
            setTimeout(() => {
              cleanup();
              reject(new Error('Auto-reconnect timeout'));
            }, 5000);
          });

          // Emit reconnect with saved session data
          newSocket.emit('reconnect', {
            roomCode: savedRoomSession.roomCode,
            playerSlot: savedRoomSession.playerSlot
          });
        } catch (error) {
          logger.warn('Auto-reconnect failed, user will need to rejoin manually', error);
          // Clear saved sessions on auto-reconnect failure
          clearRoomSession();
          clearGameState();
        }
      }
    };

    attemptAutoReconnect();

    return () => {
      newSocket.close();
    };
  }, []);

  // NOTE: Duplicate disconnect handler removed - socket disconnect is already handled in initialization useEffect above

  // Socket actions
  const connectSocket = () => {
    const waitForSocket = async () => {
      if (socketRef.current) return socketRef.current;
      if (socketReadyPromiseRef.current) {
        await socketReadyPromiseRef.current;
        return socketRef.current;
      }
      throw new Error('Socket not initialized');
    };

    return new Promise(async (resolve, reject) => {
      let activeSocket;
      try {
        activeSocket = await waitForSocket();
      } catch (err) {
        reject(err);
        return;
      }

      if (!activeSocket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      if (activeSocket.connected) {
        resolve();
        return;
      }

      const cleanup = () => {
        activeSocket.off('connect', onConnect);
        activeSocket.off('connect_error', onError);
      };

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      activeSocket.once('connect', onConnect);
      activeSocket.once('connect_error', onError);
      activeSocket.connect();

      setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  };

  const createRoom = async (winCond, playerCount = 3, cubesPerPlayer = INITIAL_CUBES, playerName = null) => {
    const activeSocket = socketRef.current || socket;
    if (!activeSocket) return;

    try {
      await connectSocket();
      
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          removeListeners();
          reject(new Error('Room creation timeout'));
        }, 5000);

        const handleRoomCreated = () => {
          clearTimeout(timeoutId);
          removeListeners();
          setIsOnlineMode(true);
          resolve();
        };

        const handleError = ({ message }) => {
          clearTimeout(timeoutId);
          removeListeners();
          reject(new Error(message || 'Failed to create room'));
        };

        const removeListeners = () => {
          activeSocket.off('roomCreated', handleRoomCreated);
          activeSocket.off('error', handleError);
        };

        // Attach listeners BEFORE emitting to avoid race condition
        activeSocket.once('roomCreated', handleRoomCreated);
        activeSocket.once('error', handleError);
        
        activeSocket.emit('createRoom', {
          winCondition: winCond,
          playerCount,
          cubesPerPlayer,
          playerName
        });
      });
    } catch (error) {
      logger.error('Failed to create room:', error);
      throw error;
    }
  };

  const joinRoom = async (code, playerName = null) => {
    const activeSocket = socketRef.current || socket;
    if (!activeSocket) return;

    try {
      // Wait for connection before emitting
      await connectSocket();
      
      // Use Socket.IO acknowledgement callback to avoid race with global error handlers
      return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('Room join timeout'));
        }, 5000);

        try {
          activeSocket.emit('joinRoom', { roomCode: code, playerName }, (err) => {
            if (settled) return;
            clearTimeout(timeoutId);
            settled = true;
            if (err) {
              reject(new Error(err));
            } else {
              setIsOnlineMode(true);
              resolve();
            }
          });
        } catch (e) {
          clearTimeout(timeoutId);
          if (!settled) {
            settled = true;
            reject(e);
          }
        }
      });
    } catch (error) {
      logger.error('Failed to join room:', error);
      throw error;
    }
  };

  const reconnectToGame = async (roomCode, playerSlot) => {
    return new Promise((resolve, reject) => {
      const activeSocket = socketRef.current || socket;
      if (!activeSocket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        // Room doesn't exist (normal if all players left) - suppress timeout error
        clearTimeout(timeoutId);
        reject(new Error('Room no longer exists'));
      }, 10000);

      activeSocket.emit('reconnect', { roomCode, playerSlot }, (error) => {
        clearTimeout(timeoutId);
        if (error) {
          logger.debug('GameContext', 'Reconnect failed (room may not exist)', { roomCode, error });
          reject(new Error(error));
        } else {
          logger.info('GameContext', 'Reconnect successful', { roomCode, playerSlot });
          setIsOnlineMode(true);
          resolve(true);
        }
      });
    });
  };

  const leaveRoom = () => {
    if (socket) {
      // Re-save the session before leaving to ensure rejoin data remains available
      if (roomCode) {
        const currentPlayer = roomPlayers?.[playerSlot] || null;
        // Only persist playerSlot if a game is in progress; otherwise leave it null
        const slotToSave = gameStarted ? playerSlot : null;
        const sessionToSave = {
          roomCode,
          playerSlot: slotToSave,
          playerName: currentPlayer?.name || null,
          maxPlayers: roomMaxPlayers,
          cubesPerPlayer: roomCubesPerPlayer,
          winCondition,
          intentionalLeave: true  // Mark as intentional leave so auto-reconnect doesn't trigger
        };
        saveRoomSession(sessionToSave);
        logger.info('Room session refreshed on leave', {
          roomCode,
          playerSlot: slotToSave,
          maxPlayers: roomMaxPlayers,
          cubesPerPlayer: roomCubesPerPlayer,
          winCondition,
          playerName: currentPlayer?.name || 'unknown'
        });
      }

      socket.emit('leaveRoom');
      setIsInRoom(false);
      setRoomCode('');
      setPlayerSlot(null);
      setRoomPlayers([]);
      setGameStarted(false);
      setIsOnlineMode(false);
      
      // Note: We preserve roomSession for rejoin capability, but clear the detailed game state
      // The roomSession was saved when the game started, so it's still valid for rejoining
      clearGameState();
    }
  };

  const startOnlineGame = () => {
    if (socket && roomCode) {
      socket.emit('startGame', { roomCode });
    }
  };

  const toggleReady = () => {
    if (socket && roomCode && playerSlot !== null) {
      const isCurrentlyReady = playerReadyStatus[playerSlot] || false;
      const eventName = isCurrentlyReady ? 'setNotReady' : 'setReady';
      logger.debug('GameContext', 'Emitting ready state change', { eventName, playerSlot, roomCode });
      socket.emit(eventName, {
        roomCode,
        playerSlot
      });
    } else {
      logger.warn('toggleReady: Missing socket, roomCode, or playerSlot', { socket: !!socket, roomCode, playerSlot });
    }
  };

  const makeMove = (row, col, selectedCubeKey = null) => {
    if (isOnlineMode && socket) {
      socket.emit('makeMove', {
        roomCode,
        row,
        col,
        selectedCube: selectedCubeKey
      });
    }
  };

  const sendCursorPosition = (row, col) => {
    if (isOnlineMode && socket && roomCode) {
      socket.emit('cursorMove', { roomCode, row, col });
    }
  };

  const sendEmote = (emote) => {
    if (isOnlineMode && socket && roomCode) {
      socket.emit('sendEmote', { roomCode, emote });
    }
  };

  const resetGameOnline = () => {
    if (isOnlineMode && socket && roomCode) {
      logger.info('GameContext', 'Requesting game reset');
      socket.emit('resetGame', { roomCode });
    }
  };

  const setTimerEnabledOnline = (enabled) => {
    // Emit timer state change to all other players in the room
    if (socket && isOnlineMode && playerSlot === 0) {
      logger.info('GameContext', 'Host changed timer state', { enabled });
      socket.emit('setTimerEnabled', { roomCode, enabled });
    }
  };

  // Local game actions
  const resetGame = () => {
    setBoard({});
    setCurrentPlayer(0);
    setPlayers(PLAYERS_CONFIG.map(p => ({ ...p, cubesLeft: INITIAL_CUBES })));
    setSelectedCube(null);
    setWinner(null);
    setWinningLine([]);
    setInvalidMoveMessage('');
    setGameStarted(false);
    
    // Clear saved game state
    clearGameState();
  };

  const startLocalGame = (config = null) => {
    if (config) {
      // Custom game configuration from PlayerSetup
      setPlayers(config.players);
      setWinCondition(config.winCondition);
      if (config.debugMode !== undefined) {
        setDebugMode(config.debugMode);
      }
    } else {
      // Default configuration
      setPlayers(PLAYERS_CONFIG.map(p => ({ ...p, cubesLeft: INITIAL_CUBES })));
    }
    
    // Initialize empty board - will be populated by Game component
    setBoard({});
    setCurrentPlayer(0);
    setSelectedCube(null);
    setWinner(null);
    setWinningLine([]);
    setIsOnlineMode(false);
    setGameStarted(true);
  };

  const value = {
    // Game state
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
    setWinCondition,
    invalidMoveMessage,
    setInvalidMoveMessage,

    // Multiplayer state
    socket,
    roomCode,
    isInRoom,
    playerSlot,
    roomPlayers,
    playerReadyStatus,
    roomMaxPlayers,
    roomCubesPerPlayer,
    isConnected,
    connectionError,
    setConnectionError,

    // UI state
    gameStarted,
    setGameStarted,
    debugMode,
    setDebugMode,
    isOnlineMode,

    // Game options/settings
    showConnectivityHints,
    setShowConnectivityHints,
    turnTimerEnabled,
    setTurnTimerEnabled,
    turnTimerSeconds,
    setTurnTimerSeconds,
    showPlayerCursors,
    setShowPlayerCursors,

    // Multiplayer features
    playerCursors,
    playerActivity,
    playerEmotes,

    // Actions
    connectSocket,
    createRoom,
    joinRoom,
    reconnectToGame,
    leaveRoom,
    toggleReady,
    startOnlineGame,
    makeMove,
    sendCursorPosition,
    sendEmote,
    setTimerEnabledOnline,
    resetGame,
    startLocalGame
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

const AppWrapper = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <GameProvider>
      <App />
    </GameProvider>
  </BrowserRouter>
);

export default AppWrapper;
