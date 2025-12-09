import logger from '../utils/logger.js';
import { customAlphabet } from 'nanoid';
import { hexadecimalUppercase } from 'nanoid-dictionary';

const PLAYER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899'  // Pink
];

const PLAYERS_CONFIG = [
  { id: 1, name: 'Player 1', color: '#3b82f6' },
  { id: 2, name: 'Player 2', color: '#ef4444' },
  { id: 3, name: 'Player 3', color: '#22c55e' }
];

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const INITIAL_CUBES = 14;

// Generate players dynamically
const generatePlayers = (count, names = [], cubesPerPlayer = INITIAL_CUBES) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: names[i] || `Player ${i + 1}`,
    color: PLAYER_COLORS[i],
    cubesLeft: cubesPerPlayer
  }));
};

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map(); // socketId -> roomCode
    this.disconnectedPlayers = new Map(); // { roomCode: { slot: { socketId, disconnectTime, timeout } } }
    this.roomDeletionTimers = new Map(); // roomCode -> timeout
  }

  generateRoomCode() {
    const customNanoid = customAlphabet(hexadecimalUppercase, 6); // 6-character code using 0-9, A-F
    let code;
    do {
      code = customNanoid();
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(winCondition = 4, playerCount = 3, cubesPerPlayer = INITIAL_CUBES) {
    const roomCode = this.generateRoomCode();
    const room = {
      code: roomCode,
      winCondition,
      maxPlayers: Math.min(Math.max(playerCount, MIN_PLAYERS), MAX_PLAYERS),
      cubesPerPlayer,
      players: [],
      gameState: null,
      started: false,
      createdAt: Date.now()
    };
    this.rooms.set(roomCode, room);
    logger.info(`Created room ${roomCode} (win=${winCondition}, maxPlayers=${room.maxPlayers})`);
    return room;
  }

  joinRoom(roomCode, socketId, playerName = null) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      logger.warn(`Attempt to join non-existent room: ${roomCode}`);
      return { success: false, error: 'Room not found' };
    }

    // If a deletion timer was scheduled for this pre-start room, cancel it because
    // a player is actively rejoining/joining the lobby.
    if (this.roomDeletionTimers.has(roomCode)) {
      clearTimeout(this.roomDeletionTimers.get(roomCode));
      this.roomDeletionTimers.delete(roomCode);
      logger.info(`Cancelled scheduled deletion for room ${roomCode} because a player joined`);
    }

    if (room.started) {
      logger.warn(`Attempt to join started game: ${roomCode}`);
      return { success: false, error: 'Game already started' };
    }

    if (room.players.length >= (room.maxPlayers || MAX_PLAYERS)) {
      logger.warn(`Attempt to join full room: ${roomCode}`);
      return { success: false, error: 'Room is full' };
    }

    // Check if player is already in the room
    const existingPlayer = room.players.find(p => p.socketId === socketId);
    if (existingPlayer) {
      return { success: true, playerSlot: existingPlayer.slot, room };
    }

    const playerSlot = room.players.length;
    const player = {
      socketId,
      slot: playerSlot,
      name: playerName || `Player ${playerSlot + 1}`,
      ready: false
    };

    room.players.push(player);
    this.playerRooms.set(socketId, roomCode);

    logger.info(`Player joined room ${roomCode} as slot ${playerSlot}`);

    return { success: true, playerSlot, room };
  }

  leaveRoom(socketId) {
    const roomCode = this.playerRooms.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // Find the player to get their slot
    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;

    const playerSlot = player.slot;

    // If game hasn't started, remove player immediately
    if (!room.started) {
      room.players = room.players.filter(p => p.socketId !== socketId);
      this.playerRooms.delete(socketId);

      // Reindex remaining players so slots are contiguous
      room.players.forEach((p, idx) => {
        p.slot = idx;
      });

      logger.info(`Player left room ${roomCode} (pre-start)`);

      // If room is now empty, schedule deletion after a grace period instead of
      // deleting immediately. This allows players who leave the lobby briefly
      // to rejoin without losing the room code.
      if (room.players.length === 0) {
        const GRACE_PERIOD = 10 * 60 * 1000; // 10 minutes
        if (this.roomDeletionTimers.has(roomCode)) {
          clearTimeout(this.roomDeletionTimers.get(roomCode));
        }
        const timeout = setTimeout(() => {
          // Double-check room still exists and is empty before deleting
          const current = this.rooms.get(roomCode);
          if (current && !current.started && current.players.length === 0) {
            this.rooms.delete(roomCode);
            if (this.disconnectedPlayers.has(roomCode)) this.disconnectedPlayers.delete(roomCode);
            logger.info(`Deleted empty room ${roomCode} after grace period`);
          }
          this.roomDeletionTimers.delete(roomCode);
        }, GRACE_PERIOD);

        this.roomDeletionTimers.set(roomCode, timeout);

        return { roomDeleted: false, room, deletionScheduled: true, deletionIn: GRACE_PERIOD };
      }

      return { roomDeleted: false, room };
    }

    // Game is in progress: start grace period (10 minutes)
    // Matches client-side session persistence timeout for consistent rejoin UX
    const GRACE_PERIOD = 10 * 60 * 1000; // 10 minutes in milliseconds

    if (!this.disconnectedPlayers.has(roomCode)) {
      this.disconnectedPlayers.set(roomCode, {});
    }

    // Mark player as disconnected
    const roomDisconnects = this.disconnectedPlayers.get(roomCode);
    const timeout = setTimeout(() => {
      // Grace period expired - remove player permanently
      this.removeDisconnectedPlayer(roomCode, playerSlot);
    }, GRACE_PERIOD);

    roomDisconnects[playerSlot] = {
      socketId,
      disconnectTime: Date.now(),
      timeout,
      name: player.name
    };

    this.playerRooms.delete(socketId);

    logger.info(`Player ${playerSlot} disconnected from ${roomCode}, grace period started`);
    return {
      roomDeleted: false,
      gracePeriod: true,
      gracePeriodDuration: GRACE_PERIOD,
      room
    };
  }

  // Remove a disconnected player after grace period expires
  removeDisconnectedPlayer(roomCode, playerSlot) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // Remove the player from the room
    room.players = room.players.filter(p => p.slot !== playerSlot);

    logger.info(`Removed disconnected player ${playerSlot} from room ${roomCode}`);
    // Clean up disconnect tracking
    const roomDisconnects = this.disconnectedPlayers.get(roomCode);
    if (roomDisconnects && roomDisconnects[playerSlot]) {
      delete roomDisconnects[playerSlot];
      
      // If no more disconnected players for this room, clean up the map entry
      if (Object.keys(roomDisconnects).length === 0) {
        this.disconnectedPlayers.delete(roomCode);
      }
    }

    // Delete room if all players have disconnected
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
      this.disconnectedPlayers.delete(roomCode);
      logger.info(`Deleted room ${roomCode} after removing last player`);
    }
  }

  // Allow a disconnected player to reconnect with same slot
  reconnectPlayer(roomCode, socketId, playerSlot) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      logger.warn(`Reconnect attempt to non-existent room: ${roomCode}`);
      return { success: false, error: 'Room not found' };
    }

    const roomDisconnects = this.disconnectedPlayers.get(roomCode);
    const disconnectedData = roomDisconnects?.[playerSlot];

    if (!disconnectedData) {
      logger.warn(`No disconnected data for slot ${playerSlot} in room ${roomCode}`);
      return { success: false, error: 'No disconnected player found for this slot' };
    }

    // Clear the timeout (player is reconnecting)
    if (disconnectedData.timeout) {
      clearTimeout(disconnectedData.timeout);
    }

    // Re-add player to room with same slot
    const player = room.players.find(p => p.slot === playerSlot);
    if (player) {
      player.socketId = socketId;
    } else {
      // Slot was removed, can't rejoin
      return { success: false, error: 'Player slot was removed due to timeout' };
    }

    // Clean up disconnect tracking
    delete roomDisconnects[playerSlot];
    
    // If no more disconnected players for this room, clean up the map entry
    if (Object.keys(roomDisconnects).length === 0) {
      this.disconnectedPlayers.delete(roomCode);
    }

    this.playerRooms.set(socketId, roomCode);

    logger.info(`Player reconnected to room ${roomCode} at slot ${playerSlot}`);
    return { success: true, room, playerSlot };
  }

  // Check if a player is in disconnected state
  getDisconnectedPlayerInfo(roomCode, playerSlot) {
    const roomDisconnects = this.disconnectedPlayers.get(roomCode);
    return roomDisconnects?.[playerSlot] || null;
  }

  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      logger.warn(`Attempt to start non-existent room: ${roomCode}`);
      return { success: false, error: 'Room not found' };
    }

    if (room.players.length < MIN_PLAYERS) {
      return { success: false, error: `Need at least ${MIN_PLAYERS} players to start` };
    }

    if (room.started) {
      return { success: false, error: 'Game already started' };
    }

    // Generate players dynamically based on joined players
    const playerNames = room.players.map(p => p.name);
    const playerCount = room.players.length;
    const cubesPerPlayer = room.cubesPerPlayer || INITIAL_CUBES;

    // Initialize game state
    room.gameState = {
      board: {},
      currentPlayer: 0,
      players: generatePlayers(playerCount, playerNames, cubesPerPlayer),
      winner: null,
      winningLine: [],
      selectedCube: null,
      winCondition: room.winCondition
    };

    room.started = true;

    logger.info(`Game started in room ${roomCode}`);
    return { success: true, gameState: room.gameState };
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getRoomBySocketId(socketId) {
    const roomCode = this.playerRooms.get(socketId);
    return roomCode ? this.rooms.get(roomCode) : null;
  }

  updateGameState(roomCode, gameState) {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.gameState = gameState;
      logger.debug(`Updated game state for room ${roomCode}`);
      return true;
    }
    return false;
  }

  // Set player ready status
  setPlayerReady(roomCode, playerSlot) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Room not found' };
    
    const player = room.players.find(p => p.slot === playerSlot);
    if (!player) return { success: false, error: 'Player not found' };
    
    player.ready = true;
    logger.debug(`Player ${playerSlot} set ready in room ${roomCode}`);
    return { success: true, player };
  }

  // Set player not ready status
  setPlayerNotReady(roomCode, playerSlot) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: 'Room not found' };
    
    const player = room.players.find(p => p.slot === playerSlot);
    if (!player) return { success: false, error: 'Player not found' };
    
    player.ready = false;
    logger.debug(`Player ${playerSlot} set not ready in room ${roomCode}`);
    return { success: true, player };
  }

  // Clean up old rooms (called periodically)
  cleanupOldRooms(maxAge = 3600000) { // 1 hour
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (!room.started && now - room.createdAt > maxAge) {
        // Clear any pending deletion timer for this room
        if (this.roomDeletionTimers.has(code)) {
          clearTimeout(this.roomDeletionTimers.get(code));
          this.roomDeletionTimers.delete(code);
        }
        // Remove all players from this room
        room.players.forEach(p => this.playerRooms.delete(p.socketId));
        this.rooms.delete(code);
        // Also clear any disconnected tracking for this room
        if (this.disconnectedPlayers.has(code)) {
          this.disconnectedPlayers.delete(code);
        }
        logger.info(`Cleaned up old room ${code}`);
      }
    }
  }
}

export default new RoomManager();
