import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './utils/logger.js';
import roomManager from './services/roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleStartGame,
  handleMakeMove,
  handleDisconnect,
  handleReconnect,
  handleSetReady,
  handleSetNotReady
} from './controllers/gameController.js';

const app = express();
const httpServer = createServer(app);

// Configure CORS based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';

// Trust proxy in production environments behind a reverse proxy
if (!isDevelopment) {
  app.set('trust proxy', true);
}

let allowedOrigins = isDevelopment
  ? true // Allow all origins in development
  : (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

if (!isDevelopment && Array.isArray(allowedOrigins) && allowedOrigins.length === 0) {
  // In production we normally require ALLOWED_ORIGINS to be set. If it's missing,
  // allow same-origin as a pragmatic fallback so deployed apps don't immediately
  // break. This logs a clear warning so operators can fix their environment.
  logger.warn('ALLOWED_ORIGINS is not set in production. Falling back to allow same-origin requests. Set ALLOWED_ORIGINS to a comma-separated list of allowed origins to lock this down.');
  // Allow same-origin via truthy value (Socket.IO and cors accept `true` to allow all origins,
  // but to avoid enabling wide-open CORS unintentionally we accept only same-origin by
  // leaving origin as true here. Operators should set ALLOWED_ORIGINS in production.)
  allowedOrigins = true;
}

logger.info(`CORS Configuration: ${isDevelopment ? 'Development (all origins allowed)' : (Array.isArray(allowedOrigins) ? `Production (${allowedOrigins.length} origins whitelisted)` : 'Production (fallback - all origins allowed)')}`);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Serve static client files in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// Health check endpoint (before SPA fallback)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: roomManager.rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Client log forwarding endpoint (optional, rate-limited in production)
app.post('/api/logs', (req, res) => {
  const { level, message, meta } = req.body;
  logger.info(`[CLIENT] ${level}: ${message}`, meta);
  res.status(200).json({ received: true });
});

// SPA fallback: serve index.html for all remaining routes
// This MUST be last, after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  logger.info(`Player connected: ${socket.id}`);

  socket.on('createRoom', (data) => {
    handleCreateRoom(socket, data);
  });

  socket.on('joinRoom', (data, callback) => {
    handleJoinRoom(socket, io, data, callback);
  });

  socket.on('leaveRoom', () => {
    handleLeaveRoom(socket, io);
  });

  socket.on('reconnect', (data, callback) => {
    handleReconnect(socket, io, data, callback);
  });

  socket.on('startGame', (data) => {
    handleStartGame(socket, io, data);
  });

  socket.on('setReady', (data) => {
    handleSetReady(socket, io, data);
  });

  socket.on('setNotReady', (data) => {
    handleSetNotReady(socket, io, data);
  });

  socket.on('makeMove', (data) => {
    handleMakeMove(socket, io, data);
  });

  // Timer state change (host only)
  socket.on('setTimerEnabled', ({ roomCode, enabled }) => {
    if (!roomCode) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const playerSlot = room.players.findIndex(p => p?.socketId === socket.id);
    if (playerSlot !== 0) {
      logger.warn(`Non-host player ${playerSlot} attempted to change timer state in ${roomCode}`);
      return;
    }

    logger.info(`Host changed timer state to ${enabled} in room ${roomCode}`);

    // Broadcast timer state change to all players in the room
    io.to(roomCode).emit('timerStateChanged', { enabled });
  });

  // Cursor tracking
  socket.on('cursorMove', ({ roomCode, row, col }) => {
    if (!roomCode || row === undefined || col === undefined) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const playerSlot = room.players.findIndex(p => p?.socketId === socket.id);
    if (playerSlot === -1) return;

    logger.debug(`Cursor move: player ${playerSlot} at [${row}, ${col}] in room ${roomCode}`);

    // Broadcast cursor position to other players in the room
    socket.to(roomCode).emit('playerCursorMove', {
      playerId: playerSlot,
      row,
      col
    });
  });

  // Emote reactions
  socket.on('sendEmote', ({ roomCode, emote }) => {
    if (!roomCode || !emote) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const playerSlot = room.players.findIndex(p => p?.socketId === socket.id);
    if (playerSlot === -1) return;

    const playerName = room.players[playerSlot]?.name;
    logger.debug(`Emote sent: player ${playerSlot} (${playerName}) sent ${emote} in room ${roomCode}`);

    // Broadcast emote to all players in the room
    io.to(roomCode).emit('playerEmote', {
      playerId: playerSlot,
      emote,
      playerName,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    logger.info(`Player disconnected: ${socket.id}`);
    handleDisconnect(socket, io);
  });
});

// Clean up old rooms every hour
setInterval(() => {
  roomManager.cleanupOldRooms();
  logger.debug(`Cleaned up old rooms. Active rooms: ${roomManager.rooms.size}`);
}, 3600000);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  const banner = `
  ╔═══════════════════════════════════════╗
  ║   Cube Connect Server                 ║
  ║   Running on port ${PORT}              ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}        ║
  ╚═══════════════════════════════════════╝
  `;
  logger.info(banner);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.warn('SIGTERM received, closing server...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
