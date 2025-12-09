// Session persistence utilities
const SESSION_KEY = 'cubeConnectSession';
import logger from './logger.js';

export const saveSession = (data) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    logger.error('SessionStorage', 'Failed to save session', e);
  }
};

export const loadSession = () => {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    logger.error('SessionStorage', 'Failed to load session', e);
    return null;
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    logger.error('SessionStorage', 'Failed to clear session', e);
  }
};

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
      timestamp: Date.now()
    };
    localStorage.setItem('cubeConnectRoomSession', JSON.stringify(roomSession));
    logger.debug('SessionStorage', 'Saved room session', { roomCode, playerSlot, intentionalLeave });
  } catch (e) {
    logger.error('SessionStorage', 'Failed to save room session', e);
  }
};

export const loadRoomSession = (maxAgeMs = 10 * 60 * 1000) => {
  try {
    const data = localStorage.getItem('cubeConnectRoomSession');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.timestamp && (Date.now() - parsed.timestamp) > maxAgeMs) {
      logger.debug('SessionStorage', 'Room session expired, clearing', { roomCode: parsed.roomCode, age: Date.now() - parsed.timestamp });
      clearRoomSession();
      return null;
    }
    logger.debug('SessionStorage', 'Loaded room session', { roomCode: parsed.roomCode, playerSlot: parsed.playerSlot });
    return parsed;
  } catch (e) {
    logger.error('SessionStorage', 'Failed to load room session', e);
    return null;
  }
};

export const clearRoomSession = () => {
  try {
    localStorage.removeItem('cubeConnectRoomSession');
    logger.debug('SessionStorage', 'Cleared room session');
  } catch (e) {
    logger.error('SessionStorage', 'Failed to clear room session', e);
  }
};

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
    logger.debug('SessionStorage', 'Saved game state', { roomCode, currentPlayer, winner });
  } catch (e) {
    logger.error('SessionStorage', 'Failed to save game state', e);
  }
};

export const loadGameState = (maxAgeMs = 10 * 60 * 1000) => {
  try {
    const data = localStorage.getItem('cubeConnectGameState');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed.timestamp && (Date.now() - parsed.timestamp) > maxAgeMs) {
      logger.debug('SessionStorage', 'Game state expired, clearing', { roomCode: parsed.roomCode, age: Date.now() - parsed.timestamp });
      clearGameState();
      return null;
    }
    logger.debug('SessionStorage', 'Loaded game state', { roomCode: parsed.roomCode, currentPlayer: parsed.currentPlayer });
    return parsed;
  } catch (e) {
    logger.error('SessionStorage', 'Failed to load game state', e);
    return null;
  }
};

export const clearGameState = () => {
  try {
    localStorage.removeItem('cubeConnectGameState');
    logger.debug('SessionStorage', 'Cleared game state');
  } catch (e) {
    logger.error('SessionStorage', 'Failed to clear game state', e);
  }
};
