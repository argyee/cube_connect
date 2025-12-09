// Session persistence utilities
const SESSION_KEY = 'cubeConnectSession';
import logger from './logger.js';

export const saveSession = (data) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    logger.error('Failed to save session:', e);
  }
};

export const loadSession = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    logger.error('Failed to load session:', e);
    return null;
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    logger.error('Failed to clear session:', e);
  }
};

// Save room session (for rejoining)
export const saveRoomSession = ({ roomCode, playerSlot, playerName, maxPlayers, cubesPerPlayer, winCondition, intentionalLeave = false }) => {
  try {
    const roomSession = {
      roomCode,
      playerSlot,
      playerName,
      maxPlayers,
      cubesPerPlayer,
      winCondition,
      intentionalLeave,
      timestamp: Date.now() // Track when session was saved
    };
    localStorage.setItem('cubeConnectRoomSession', JSON.stringify(roomSession));
  } catch (e) {
    logger.error('Failed to save room session:', e);
  }
};

export const loadRoomSession = (maxAgeMs = 10 * 60 * 1000) => {
  try {
    const data = localStorage.getItem('cubeConnectRoomSession');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.timestamp && (Date.now() - parsed.timestamp) > maxAgeMs) {
      clearRoomSession();
      return null;
    }
    return parsed;
  } catch (e) {
    logger.error('Failed to load room session:', e);
    return null;
  }
};

export const clearRoomSession = () => {
  try {
    localStorage.removeItem('cubeConnectRoomSession');
  } catch (e) {
    logger.error('Failed to clear room session:', e);
  }
};

// Save game state (for recovery after refresh during game)
export const saveGameState = ({ board, currentPlayer, players, winner, winningLine, selectedCube, roomCode }) => {
  try {
    const gameState = {
      board,
      currentPlayer,
      players,
      winner,
      winningLine,
      selectedCube,
      roomCode,
      timestamp: Date.now()
    };
    localStorage.setItem('cubeConnectGameState', JSON.stringify(gameState));
  } catch (e) {
    logger.error('Failed to save game state:', e);
  }
};

export const loadGameState = (maxAgeMs = 10 * 60 * 1000) => {
  try {
    const data = localStorage.getItem('cubeConnectGameState');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.timestamp && (Date.now() - parsed.timestamp) > maxAgeMs) {
      clearGameState();
      return null;
    }
    return parsed;
  } catch (e) {
    logger.error('Failed to load game state:', e);
    return null;
  }
};

export const clearGameState = () => {
  try {
    localStorage.removeItem('cubeConnectGameState');
  } catch (e) {
    logger.error('Failed to clear game state:', e);
  }
};
