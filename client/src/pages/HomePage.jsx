import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/useGame';
import { PLAYERS_CONFIG, WIN_CONDITIONS, MIN_PLAYERS, MAX_PLAYERS, RECOMMENDED_CUBES } from '../utils/constants';
import PlayerSetup from '../components/PlayerSetup';
import { Users, Box } from 'lucide-react';
import { loadRoomSession, clearRoomSession } from '../utils/sessionStorage';
import logger from '../utils/logger';
import { toast } from 'react-toastify';

const HomePage = () => {
  const navigate = useNavigate();
  const {
    winCondition,
    setWinCondition,
    debugMode,
    setDebugMode,
    startLocalGame,
    createRoom,
    joinRoom,
    reconnectToGame,
    connectSocket,
    connectionError,
    setConnectionError,
    gameStarted,
    roomCode,
    playerSlot,
    isInRoom,
    isConnected,
    leaveRoom
  } = useGame();
  const location = useLocation();

  const [mode, setMode] = useState('menu'); // 'menu', 'local-setup', 'online-setup', 'join-setup'
  const [joinCode, setJoinCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const [savedRoomSession, setSavedRoomSession] = useState(null);

  // Multiplayer configuration
  const [playerName, setPlayerName] = useState(() => {
    // Load saved player name from localStorage
    return localStorage.getItem('cubeConnectPlayerName') || '';
  });
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [cubesPerPlayer, setCubesPerPlayer] = useState(RECOMMENDED_CUBES[3]);

  // Save player name whenever it changes
  useEffect(() => {
    localStorage.setItem('cubeConnectPlayerName', playerName);
  }, [playerName]);

  // Show error toast when connectionError changes
  useEffect(() => {
    if (connectionError) {
      toast.error(connectionError);
      setConnectionError('');
    }
  }, [connectionError, setConnectionError]);

  // Check if user can rejoin a room - refresh when returning to menu
  useEffect(() => {
    if (mode === 'menu') {
      const session = loadRoomSession();
      if (session && session.roomCode) {
        setSavedRoomSession(session);
        logger.info('HomePage', 'Saved room session found on menu load', session);
        
        if (!session.intentionalLeave && session.playerSlot !== null && session.playerSlot !== undefined) {
          logger.info('HomePage', 'Auto-reconnecting to active game', {
            roomCode: session.roomCode,
            playerSlot: session.playerSlot
          });
          handleAutoReconnect(session);
        }
      } else {
        logger.debug('HomePage', 'No saved room session found (or expired)');
        setSavedRoomSession(null);
      }
    }
  }, [mode]);

  // When hitting home while still in a room, leave and clear pending auto-navigation
  // Track if we were in a room on the previous render to detect intentional navigation back
  const wasInRoomRef = useRef(false);
  const isCreatingRoomRef = useRef(false);
  
  useEffect(() => {
    // Only leave room if:
    // 1. User is on homepage
    // 2. User is in a room
    // 3. User was in a room on previous render (not just joining)
    // 4. User is not currently in the process of creating a room
    if (location.pathname === '/' && isInRoom && wasInRoomRef.current && !isCreatingRoomRef.current) {
      logger.warn('HomePage', 'User navigated back to home while in room. Leaving room', { roomCode });
      leaveRoom();
    }
    wasInRoomRef.current = isInRoom;
  }, [location.pathname, isInRoom, leaveRoom, roomCode]);

  useEffect(() => {
    if (mode === 'online-setup' && isInRoom && roomCode && savedRoomSession?.roomCode !== roomCode) {
      logger.info('HomePage', 'New room created, clearing stale saved session', { oldRoom: savedRoomSession?.roomCode, newRoom: roomCode });
      setSavedRoomSession(null);
    }
  }, [isInRoom, roomCode, mode, savedRoomSession]);

  const handleAutoReconnect = async (session) => {
    setIsConnecting(true);
    const timeoutId = setTimeout(() => {
      setConnectionTimeout(true);
      toast.info('Taking longer than expected to connect...');
    }, 5000);

    try {
      await connectSocket();
      await reconnectToGame(session.roomCode, session.playerSlot);
      toast.success(`Reconnecting to game in room ${session.roomCode}...`);
    } catch (error) {
      logger.error('HomePage', 'Auto-reconnect failed', error);
      toast.error('Could not reconnect to game. Please rejoin manually.');
    } finally {
      clearTimeout(timeoutId);
      setIsConnecting(false);
      setConnectionTimeout(false);
    }
  };

  useEffect(() => {
    if (!isInRoom) {
      logger.debug('HomePage', 'isInRoom=false, reloading saved session');
      const session = loadRoomSession();
      
      if (session && session.roomCode) {
        setSavedRoomSession(session);
        logger.info('HomePage', 'Loaded saved session', { room: session.roomCode, slot: session.playerSlot, intentionalLeave: session.intentionalLeave });
        
        if (!session.intentionalLeave && session.playerSlot !== null && session.playerSlot !== undefined) {
          logger.info('HomePage', 'Auto-reconnecting to active game after accidental disconnect', {
            roomCode: session.roomCode,
            playerSlot: session.playerSlot
          });
          handleAutoReconnect(session);
        } else if (session.intentionalLeave) {
          logger.info('HomePage', 'Intentional leave detected. Keeping session for manual rejoin');
          const sessionForRejoin = { ...session, intentionalLeave: false };
          setSavedRoomSession(sessionForRejoin);
        }
      } else {
        logger.warn('HomePage', 'No saved session found after leaving room');
        setSavedRoomSession(null);
      }
    }
  }, [isInRoom]);

  useEffect(() => {
    logger.debug('HomePage', 'Navigation effect triggered', {
      isInRoom,
      roomCode,
      savedCode: savedRoomSession?.roomCode,
      savedSlot: savedRoomSession?.playerSlot,
      gameStarted,
      pathname: location.pathname,
      isCreatingRoom: isCreatingRoomRef.current
    });

    // Don't auto-navigate if user is already on home page UNLESS they're creating/joining a room
    if (location.pathname === '/' && !isCreatingRoomRef.current) {
      logger.debug('HomePage', 'User is on homepage and not creating room, skipping auto-navigation');
      return;
    }

    if (isInRoom && roomCode) {
      // Reset the creating room flag once navigation is triggered
      if (isCreatingRoomRef.current) {
        logger.info('HomePage', 'Navigating away from homepage after room creation');
        isCreatingRoomRef.current = false;
      }

      if (savedRoomSession && savedRoomSession.roomCode !== roomCode) {
        logger.warn('HomePage', 'Stale session mismatch. Skipping redirect', { savedRoom: savedRoomSession.roomCode, currentRoom: roomCode });
        return;
      }

      const sessionMatchesRoom = savedRoomSession && savedRoomSession.roomCode === roomCode;
      const hasActiveGame = gameStarted || (sessionMatchesRoom && savedRoomSession.playerSlot !== null && savedRoomSession.playerSlot !== undefined);
      logger.debug('HomePage', 'Route decision', {
        sessionMatchesRoom,
        hasActiveGame,
        gameStarted,
        target: hasActiveGame ? '/game' : `/lobby/${roomCode}`
      });
      if (hasActiveGame) {
        logger.info('HomePage', 'Navigating to game (active game)', { roomCode, gameStarted });
        navigate('/game');
      } else {
        logger.info('HomePage', 'Navigating to lobby (new/rejoin lobby)', { roomCode, sessionMatchesRoom });
        navigate(`/lobby/${roomCode}`);
      }
    } else {
      logger.debug('HomePage', 'Navigation conditions unmet', { isInRoom, roomCode });
    }
  }, [isInRoom, roomCode, savedRoomSession, gameStarted, navigate, location.pathname]);

  const handleStartLocal = (config) => {
    startLocalGame(config);
    navigate('/game');
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      toast.warning('Please enter a nickname');
      return;
    }
    
    // Clear any existing room session before creating new room
    clearRoomSession();
    setSavedRoomSession(null);
    
    logger.info('HomePage', 'Creating room', { maxPlayers, cubesPerPlayer, winCondition, playerName });
    setIsConnecting(true);
    setConnectionTimeout(false);
    isCreatingRoomRef.current = true; // Mark that we're creating a room
    
    const timeoutId = setTimeout(() => {
      setConnectionTimeout(true);
      toast.info('Taking longer than expected to connect...');
    }, 5000);

    try {
      await createRoom(winCondition, maxPlayers, cubesPerPlayer, playerName || null);
      logger.info('HomePage', 'Room creation completed. Waiting for navigation effect', { isInRoom, roomCode });
      // Navigation will happen via the navigation effect
    } catch (error) {
      logger.error('HomePage', 'Failed to create room', error);
      toast.error('Failed to create room. Please try again.');
      isCreatingRoomRef.current = false; // Reset on error
    } finally {
      clearTimeout(timeoutId);
      setIsConnecting(false);
      setConnectionTimeout(false);
      // Keep isCreatingRoomRef true until after navigation completes
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      toast.warning('Please enter a nickname');
      return;
    }
    
    if (joinCode.trim().length !== 6) {
      toast.error('Room code must be 6 characters');
      return;
    }
    
    // Clear any existing room session before joining new room
    clearRoomSession();
    setSavedRoomSession(null);
    
    setIsConnecting(true);
    setConnectionTimeout(false);
    isCreatingRoomRef.current = true; // Mark that we're joining a room (same as creating)
    
    const timeoutId = setTimeout(() => {
      setConnectionTimeout(true);
      toast.info('Taking longer than expected to connect...');
    }, 5000);

    try {
      await joinRoom(joinCode.toUpperCase(), playerName || null);
    } catch (error) {
      logger.error('HomePage', 'Failed to join room', error);
      toast.error('Failed to join room. Please check the code and try again.');
      isCreatingRoomRef.current = false; // Reset on error
    } finally {
      clearTimeout(timeoutId);
      setIsConnecting(false);
      setConnectionTimeout(false);
      // Keep isCreatingRoomRef true until after navigation completes
    }
  };

  const handleRejoinRoom = async () => {
    if (!savedRoomSession) {
      toast.error('No saved room session found');
      return;
    }

    setIsConnecting(true);
    setConnectionTimeout(false);

    const timeoutId = setTimeout(() => {
      setConnectionTimeout(true);
      toast.info('Taking longer than expected to connect...');
    }, 5000);

    try {
      if (savedRoomSession.playerSlot !== null && savedRoomSession.playerSlot !== undefined) {
        logger.info('HomePage', 'Attempting to reconnect to active game', {
          roomCode: savedRoomSession.roomCode,
          playerSlot: savedRoomSession.playerSlot
        });
        await connectSocket();
        await reconnectToGame(savedRoomSession.roomCode, savedRoomSession.playerSlot);
        toast.success(`Reconnecting to game in room ${savedRoomSession.roomCode}...`);
      } else {
        logger.info('HomePage', 'Attempting to rejoin lobby', {
          roomCode: savedRoomSession.roomCode
        });
        const nameToUse = savedRoomSession.playerName || playerName || `Player ${Math.floor(Math.random() * 1000)}`;
        await joinRoom(savedRoomSession.roomCode, nameToUse);
        toast.success(`Rejoining room ${savedRoomSession.roomCode}...`);
      }
    } catch (error) {
      if (error.message.includes('no longer exists') || error.message.includes('not found')) {
        logger.info('HomePage', 'Room expired (all players left). Clearing saved session');
        setSavedRoomSession(null);
        toast.info('That game has ended. Start a new game or join another room.');
      } else {
        logger.error('HomePage', 'Failed to rejoin room', error);
        toast.error('Could not rejoin. Please create or join a different room.');
      }
    } finally {
      clearTimeout(timeoutId);
      setIsConnecting(false);
      setConnectionTimeout(false);
    }
  };

  const handleMaxPlayersChange = (count) => {
    setMaxPlayers(count);
    setCubesPerPlayer(RECOMMENDED_CUBES[count]);
  };

  // Player setup screen for local games
  if (mode === 'local-setup') {
    return (
      <PlayerSetup
        onBack={() => setMode('menu')}
        onStart={handleStartLocal}
      />
    );
  }

  if (mode === 'menu') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4" role="main">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
          <div className="flex justify-center -mb-4">
            <img src="/favicon.png" alt="Cube Connect" className="w-40 h-40" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-slate-800">
            Cube Connect
          </h1>
          <p className="text-slate-600 mb-6 text-center text-sm">
            A strategic game for 2-6 players.
          </p>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => setMode('local-setup')}
              className="w-full font-bold text-lg py-4 px-7 rounded-xl bg-blue-500 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-300 focus:ring-offset-2 transition-all"
              aria-label="Play a game locally on this device"
            >
              Play Locally
            </button>
            <button
              onClick={() => setMode('online-setup')}
              className="w-full font-bold text-lg py-4 px-7 rounded-xl bg-green-500 hover:bg-green-700 text-white border-2 border-green-700 shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-300 focus:ring-offset-2 transition-all"
              aria-label="Create a multiplayer online room"
            >
              Create Online Room
            </button>
            <button
              onClick={() => setMode('join-setup')}
              className="w-full font-bold text-lg py-4 px-7 rounded-xl bg-purple-500 hover:bg-purple-700 text-white border-2 border-purple-700 shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-300 focus:ring-offset-2 transition-all"
              aria-label="Join an existing multiplayer online room"
            >
              Join Room
            </button>
            {savedRoomSession && (
              <button
                onClick={handleRejoinRoom}
                disabled={isConnecting}
                className="w-full font-bold text-lg py-4 px-7 rounded-xl bg-amber-400 hover:bg-amber-500 text-white border-2 border-amber-500 shadow-lg focus:outline-none focus:ring-4 focus:ring-yellow-300 focus:ring-offset-2 transition-all"
                aria-label={`Rejoin previously played room ${savedRoomSession.roomCode}`}
              >
                {isConnecting ? 'Rejoining...' : `Rejoin Last Room (${savedRoomSession.roomCode})`}
              </button>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
            <p className="font-semibold mb-2">Game Rules:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Get 4/5/6 cubes in a row in any direction to win.</li>
              <li>Place cubes adjacent to existing ones.</li>
              <li>When out of cubes, you move an existing one.</li>
              <li>You can only move a cube if all remaining cubes stay connected (vertical/horizontal links only)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'online-setup') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4" role="main">
        <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-md w-full">
          <button
            onClick={() => setMode('menu')}
            className="text-slate-600 hover:text-slate-800 mb-4 flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 rounded"
            aria-label="Go back to menu"
          >
            ← Back
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-slate-800">
            Create Online Room
          </h1>

          {connectionError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {connectionError}
            </div>
          )}

          {/* Player Nickname */}
          <div className="mb-6">
            <label htmlFor="nickname-input" className="block text-sm font-medium text-slate-700 mb-2">
              Your Nickname (Optional)
            </label>
            <input
              id="nickname-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter your nickname"
              maxLength={20}
              aria-label="Your nickname"
            />
          </div>

          {/* Max Players Selector */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={20} className="text-slate-600" />
              <label className="block text-sm font-medium text-slate-700">
                Maximum Players
              </label>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map((count) => (
                <button
                  key={count}
                  onClick={() => handleMaxPlayersChange(count)}
                  className={`py-2 px-3 rounded-lg font-semibold transition-all text-sm ${
                    maxPlayers === count
                      ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Cubes Per Player */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Box size={20} className="text-slate-600" />
              <label className="block text-sm font-medium text-slate-700">
                Cubes Per Player: {cubesPerPlayer}
              </label>
              <span className="text-xs text-slate-500 ml-auto">
                (Recommended: {RECOMMENDED_CUBES[maxPlayers]})
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={20}
              value={cubesPerPlayer}
              onChange={(e) => setCubesPerPlayer(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>8</span>
              <span>20</span>
            </div>
          </div>

          {/* Win Condition */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Win Condition (in a row)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[WIN_CONDITIONS.MIN, 5, WIN_CONDITIONS.MAX].map((condition) => (
                <button
                  key={condition}
                  onClick={() => setWinCondition(condition)}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                    winCondition === condition
                      ? 'bg-green-600 text-white ring-2 ring-green-600 ring-offset-2'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {condition} in a row
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={isConnecting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-lg"
          >
            {isConnecting ? 'Connecting...' : 'Create Room'}
          </button>

          <div className="mt-4 p-4 bg-slate-50 rounded-lg text-xs text-slate-600">
            <p className="font-semibold mb-2">How it works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Configure room settings and create room</li>
              <li>Share the 6-character code with friends</li>
              <li>Wait for players to join (min {MIN_PLAYERS})</li>
              <li>Start the game when ready!</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join-setup') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4" role="main">
        <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-md w-full">
          <button
            onClick={() => setMode('menu')}
            className="text-slate-600 hover:text-slate-800 mb-4 flex items-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 rounded"
            aria-label="Go back to menu"
          >
            ← Back
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-slate-800">
            Join Room
          </h1>

          {connectionError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {connectionError}
            </div>
          )}

          {/* Player Nickname */}
          <div className="mb-6">
            <label htmlFor="join-nickname-input" className="block text-sm font-medium text-slate-700 mb-2">
              Your Nickname (Optional)
            </label>
            <input
              id="join-nickname-input"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter your nickname"
              maxLength={20}
              aria-label="Your nickname for joining the room"
            />
          </div>

          {/* Room Code */}
          <div className="mb-6">
            <label htmlFor="room-code-input" className="block text-sm font-medium text-slate-700 mb-2">
              Room Code
            </label>
            <input
              id="room-code-input"
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase text-center text-2xl font-mono tracking-widest"
              aria-label="Room code to join"
            />
          </div>

          <button
            onClick={handleJoinRoom}
            disabled={joinCode.length !== 6 || isConnecting}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2"
            aria-label={joinCode.length !== 6 ? "Enter a 6-character room code to join" : "Join the room"}
          >
            {isConnecting ? 'Connecting...' : 'Join Room'}
          </button>

          <div className="mt-4 p-4 bg-slate-50 rounded-lg text-xs text-slate-600">
            <p className="font-semibold mb-2">Tip:</p>
            <p>Enter the 6-character code shared by the host to join their game room!</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default HomePage;
