import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/useGame';
import Lobby from '../components/Lobby';
import { loadRoomSession, saveRoomSession, clearRoomSession } from '../utils/sessionStorage';
import logger from '../utils/logger';

const LobbyPage = () => {
  const navigate = useNavigate();
  const { code } = useParams();
  const { 
    isInRoom, 
    roomCode, 
    gameStarted, 
    isOnlineMode, 
    joinRoom,
    connectSocket,
    connectionError,
    leaveRoom,
    socket
  } = useGame();
  const [isRejoining, setIsRejoining] = useState(false);
  const [hasAttemptedRejoin, setHasAttemptedRejoin] = useState(false);
  const [rejoinError, setRejoinError] = useState(null);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    logger.debug('LobbyPage', 'Component mounted');
    
    return () => {
      setIsMounted(false);
      logger.debug('LobbyPage', 'Component unmounted');
    };
  }, []);

  useEffect(() => {
    if (isInRoom && roomCode === code) {
      logger.debug('LobbyPage', 'Already in matching room', { roomCode, code });
      setRejoinError(null);
      return;
    }

    if (hasAttemptedRejoin && roomCode !== code) {
      logger.debug('LobbyPage', 'Room code changed, resetting rejoin flag', { oldCode: roomCode, newCode: code });
      setHasAttemptedRejoin(false);
      return;
    }

    if (hasAttemptedRejoin) {
      return;
    }

    const savedRoomSession = loadRoomSession();
    
    if (code && !savedRoomSession?.roomCode) {
      logger.info('LobbyPage', 'Room code in URL but no saved session, redirecting to home', { code });
      navigate('/');
      return;
    }
    
    const codeFromParams = savedRoomSession?.roomCode;

    if (!codeFromParams) {
      logger.info('LobbyPage', 'No room code available, redirecting to home');
      navigate('/');
      return;
    }

    const attemptRejoin = async () => {
      logger.info('LobbyPage', 'Attempting to rejoin room', { roomCode: codeFromParams });
      setIsRejoining(true);
      setRejoinError(null);
      setHasAttemptedRejoin(true);
      try {
        await connectSocket();
        const playerName = savedRoomSession?.playerName || null;
        await joinRoom(codeFromParams, playerName);
        logger.info('LobbyPage', 'Successfully rejoined room', { roomCode: codeFromParams });
      } catch (error) {
        logger.warn('LobbyPage', 'Failed to rejoin room', { roomCode: codeFromParams, error: error.message });
        if (!isMounted) return;
        
        // Determine error message based on error type
        const errorMsg = error.message || 'Unknown error';
        let displayMessage = 'Failed to rejoin room. ';
        
        if (errorMsg.includes('Room not found') || errorMsg.includes('not found')) {
          displayMessage = 'This room has expired or does not exist. ';
        } else if (errorMsg.includes('timeout')) {
          displayMessage = 'Could not connect to room. ';
        }
        
        displayMessage += 'Redirecting to home...';
        setRejoinError(displayMessage);
        
        logger.info('LobbyPage', 'Clearing session and redirecting after rejoin failure', { error: errorMsg });
        clearRoomSession();
        
        if (socket) {
          socket.disconnect();
        }
        
        setTimeout(() => {
          if (isMounted) navigate('/');
        }, 2500);
      } finally {
        if (isMounted) {
          setIsRejoining(false);
        }
      }
    };

    attemptRejoin();
  }, [code, isInRoom, roomCode, joinRoom, connectSocket, navigate, hasAttemptedRejoin, isMounted]);

  useEffect(() => {
    if (gameStarted && isOnlineMode) {
      logger.info('LobbyPage', 'Game started, navigating to game page', { roomCode });
      navigate(`/game/${roomCode}`);
    }
  }, [gameStarted, isOnlineMode, roomCode, navigate]);

  // Loading state while rejoining
  if (isRejoining) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center max-w-md px-6">
          <div className="mb-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          </div>
          <p className="text-white text-xl mb-2">Rejoining room...</p>
          {rejoinError && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{rejoinError}</p>
            </div>
          )}
          {connectionError && !rejoinError && (
            <p className="text-yellow-500 text-sm mt-2">{connectionError}</p>
          )}
        </div>
      </div>
    );
  }

  // If not in room yet, show loading (this happens when rejoin completes but state hasn't updated yet)
  if (!isInRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center max-w-md px-6">
          {rejoinError ? (
            <div className="space-y-4">
              <div className="p-6 bg-red-500/20 border border-red-500 rounded-lg">
                <p className="text-red-400 text-lg font-semibold mb-2">Room Not Found</p>
                <p className="text-red-300 text-sm">{rejoinError}</p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Home
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
              </div>
              <p className="text-white text-xl">Loading lobby...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <Lobby />;
};

export default LobbyPage;
