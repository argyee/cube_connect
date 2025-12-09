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
    // - Otherwise, default to same-origin (so nginx can proxy /socket.io/ to the backend).
    const getSocketURL = () => {
      if (import.meta.env.VITE_SOCKET_URL) {
        return import.meta.env.VITE_SOCKET_URL;
      }

      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';

      // Use same-origin (no hard-coded backend port). When serving via nginx,
      // nginx should proxy `/socket.io/` to the backend (3001).
      return `${protocol}//${hostname}${port}`;
    };

    const SOCKET_URL = getSocketURL();
    logger.info(`Connecting to socket server: ${SOCKET_URL}`);

    const newSocket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3, // Reduced from 5 to 3
      timeout: 5000 // Add connection timeout
    });

    // Connection events
    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError('');
      logger.info('Socket connected');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      logger.info('Socket disconnected:', reason);

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
          logger.info('💾 Room session saved on disconnect', { roomCode: rc, playerSlot: slotToSave });
        }
      } catch (e) {
        logger.warn('Failed to save session on disconnect', e);
      }

      // If disconnected due to server namespace disconnect, don't reconnect
      if (reason === 'io server disconnect') {
        newSocket.disconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      logger.warn('Socket connection error:', error.message);
      setConnectionError('Failed to connect to server');
      setIsConnected(false);
    });
    
    newSocket.on('reconnect_failed', () => {
      logger.error('Socket reconnection failed after all attempts');
      setConnectionError('Could not connect to server');
    });

    // Room events
    newSocket.on('roomCreated', ({ roomCode: code, maxPlayers, cubesPerPlayer }) => {
      setRoomCode(code);
      setIsInRoom(true);
      setPlayerReadyStatus({}); // Reset ready status
      if (maxPlayers) setRoomMaxPlayers(maxPlayers);
      if (cubesPerPlayer) setRoomCubesPerPlayer(cubesPerPlayer);
      
      // Room session persistence happens in the roomJoined handler once server assigns slots
    });

    newSocket.on('roomJoined', ({ roomCode: code, playerSlot: slot, players: roomPlayersList, maxPlayers, cubesPerPlayer, winCondition: winCond }) => {
      setRoomCode(code);
      setPlayerSlot(slot);
      setIsInRoom(true);
      setRoomPlayers(roomPlayersList);
      // Build playerReadyStatus from the players array
      const readyStatus = {};
      roomPlayersList.forEach((player, index) => {
        readyStatus[index] = player.ready || false;
      });
      setPlayerReadyStatus(readyStatus);
      if (maxPlayers) setRoomMaxPlayers(maxPlayers);
      if (cubesPerPlayer) setRoomCubesPerPlayer(cubesPerPlayer);
      if (winCond) setWinCondition(winCond);

      // Persist session details immediately so the player can rejoin lobbies pre-game.
      // NOTE: we intentionally do NOT persist `playerSlot` here for pre-game lobbies.
      // `playerSlot` is only saved when the game actually starts (see gameStarted handler).
      if (code) {
        const resolvedMaxPlayers = maxPlayers || roomMaxPlayers;
        const resolvedCubesPerPlayer = cubesPerPlayer || roomCubesPerPlayer;
        const resolvedWinCondition = winCond || winCondition;
        const currentPlayer = roomPlayersList?.[slot] || null;

        saveRoomSession({
          roomCode: code,
          playerSlot: null,
          playerName: currentPlayer?.name || null,
          maxPlayers: resolvedMaxPlayers,
          cubesPerPlayer: resolvedCubesPerPlayer,
          winCondition: resolvedWinCondition
        });

        logger.info('💾 Room session saved on join (pre-game)', {
          roomCode: code,
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
      logger.info(`Player at slot ${playerSlot} has reconnected`);
    });

    newSocket.on('playerReady', ({ playerSlot }) => {
      setPlayerReadyStatus(prev => ({ ...prev, [playerSlot]: true }));
    });

    newSocket.on('playerNotReady', ({ playerSlot }) => {
      setPlayerReadyStatus(prev => ({ ...prev, [playerSlot]: false }));
    });

    newSocket.on('gameStarted', ({ gameState, roomCode: eventRoomCode, playerSlot: eventPlayerSlot, maxPlayers: eventMaxPlayers, cubesPerPlayer: eventCubesPerPlayer }) => {
      logger.info('📡 gameStarted event received:', {
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
      
      // Save room session now that game has started (for rejoin capability)
      // Use values from the event to ensure we have the correct data
      const roomCodeToSave = eventRoomCode || roomCode;
      const playerSlotToSave = eventPlayerSlot !== undefined ? eventPlayerSlot : playerSlot;
      const maxPlayersToSave = eventMaxPlayers || roomMaxPlayers;
      const cubesPerPlayerToSave = eventCubesPerPlayer || roomCubesPerPlayer;
      
      logger.info('💾 Game started - Saving room session:', {
        roomCode: roomCodeToSave,
        playerSlot: playerSlotToSave,
        maxPlayers: maxPlayersToSave,
        cubesPerPlayer: cubesPerPlayerToSave,
        winCondition: gameState.winCondition
      });
      
      // Only save if we have a valid room code and player slot
      if (roomCodeToSave && playerSlotToSave !== null && playerSlotToSave !== undefined) {
        saveRoomSession({
          roomCode: roomCodeToSave,
          playerSlot: playerSlotToSave,
          playerName: null,
          maxPlayers: maxPlayersToSave,
          cubesPerPlayer: cubesPerPlayerToSave,
          winCondition: gameState.winCondition
        });
        logger.info('✅ Room session saved successfully');
      } else {
        logger.warn('❌ Could not save room session - missing roomCode or playerSlot', { roomCodeToSave, playerSlotToSave });
      }
      
      // Save game state for recovery after refresh
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
      setBoard(gameState.board);
      setCurrentPlayer(gameState.currentPlayer);
      setPlayers(gameState.players);
      setSelectedCube(null);
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
    newSocket.on('playerEmote', ({ playerId, emote, timestamp }) => {
      setPlayerEmotes(prev => [...prev, { playerId, emote, timestamp }]);
    });

    // Timer state change from host
    newSocket.on('timerStateChanged', ({ enabled }) => {
      logger.info(`Timer state changed to ${enabled}`);
      setTurnTimerEnabled(enabled);
    });

    setSocket(newSocket);

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

  useEffect(() => {
    if (socket) {
      socket.on('disconnect', () => {
        // Redirect to home page on disconnect
        navigate('/');
      });
    }
  }, [socket, navigate]);

  // Socket actions
  const connectSocket = () => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      if (socket.connected) {
        resolve();
        return;
      }

      // Set up one-time listeners for this connection attempt
      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };

      // Add listeners
      socket.once('connect', onConnect);
      socket.once('connect_error', onError);

      // Attempt connection
      socket.connect();

      // Timeout after 10 seconds
      setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  };

  const createRoom = async (winCond, playerCount = 3, cubesPerPlayer = INITIAL_CUBES, playerName = null) => {
    if (!socket) return;

    try {
      // Wait for connection before emitting
      await connectSocket();
      
      // Create a promise that resolves when roomCreated is received or rejects on error
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
          socket.off('roomCreated', handleRoomCreated);
          socket.off('error', handleError);
        };

        socket.on('roomCreated', handleRoomCreated);
        socket.on('error', handleError);
        
        socket.emit('createRoom', {
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
    if (!socket) return;

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
          socket.emit('joinRoom', { roomCode: code, playerName }, (err) => {
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
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        // Room doesn't exist (normal if all players left) - suppress timeout error
        clearTimeout(timeoutId);
        reject(new Error('Room no longer exists'));
      }, 10000);

      // Emit reconnect event
      socket.emit('reconnect', { roomCode, playerSlot }, (error) => {
        clearTimeout(timeoutId);
        if (error) {
          // Room not found is expected if all players have left - don't log as error
          logger.debug(`Reconnect failed for room ${roomCode}: ${error}`);
          reject(new Error(error));
        } else {
          logger.info('Reconnect successful');
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
        logger.info('💾 Room session refreshed on leave', {
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
      logger.debug(`Emitting ${eventName} for playerSlot ${playerSlot} in room ${roomCode}`);
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

  const setTimerEnabledOnline = (enabled) => {
    // Emit timer state change to all other players in the room
    if (socket && isOnlineMode && playerSlot === 0) {
      logger.info(`Host changed timer state to ${enabled}`);
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
