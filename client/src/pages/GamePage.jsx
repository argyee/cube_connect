import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../context/useGame';
import Game from '../components/Game';
import { loadGameState, loadRoomSession } from '../utils/sessionStorage';

const GamePage = () => {
  const navigate = useNavigate();
  const { code } = useParams();
  const { gameStarted, isOnlineMode, roomCode, socket } = useGame();

  useEffect(() => {
    // If game is not started and user accessed this page directly,
    // try to restore from saved session
    if (!gameStarted && !isOnlineMode) {
      const savedGameState = loadGameState();
      const savedRoomSession = loadRoomSession();

      // If there's a saved room session, they might be rejoining
      if (savedRoomSession && savedRoomSession.roomCode) {
        // Navigate to lobby to rejoin
        navigate(`/lobby/${savedRoomSession.roomCode}`);
        return;
      }

      // If no saved game state and not in a room, redirect to home
      if (!savedGameState) {
        navigate('/');
      }
    }
  }, [gameStarted, isOnlineMode, navigate]);

  // If user hasn't started a game, redirect to home
  if (!gameStarted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <p className="text-white text-xl">Redirecting...</p>
      </div>
    );
  }

  return <Game />;
};

export default GamePage;
