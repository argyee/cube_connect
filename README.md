# Cube Connect

A multiplayer strategy board game built with React, Node.js, and Socket.IO. Supports 2-6 players with customizable win conditions and game settings.

## Overview

Cube Connect is a turn-based strategy game where players place and move cubes on a 20×20 grid while maintaining connectivity. The goal is to create a line of N cubes (configurable, default 4) in any direction.

### Game Features

- **2-6 Players**: Flexible player count for different game experiences
- **Local & Online Multiplayer**: Play hot-seat locally or create online rooms with friends
- **Customizable Settings**: Adjust win condition (4-6), cubes per player (8-20), and player count
- **Turn Timer**: Optional timer with host control in multiplayer games
- **Real-time Features**: Live cursor positions, emote reactions, and instant updates
- **Auto-Reconnect**: Seamless reconnection if disconnected during a game
- **Session Persistence**: Rejoin your last room after closing the browser

### Game Rules

- **Placement Phase**: All players place cubes from their pool, one per turn
- **Movement Phase**: When out of cubes, players can move their existing cubes
- **Connectivity Requirement**: All cubes must form a connected group (horizontally/vertically only)
- **Win Condition**: Get N cubes in a row (any direction, including diagonals)
- **Turn Order**: Turns rotate among all active players

## Project Structure

```
cube-connect/
├── client/                   # React + Vite frontend
├── server/                   # Node.js + Express + Socket.IO backend
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml
├── .env.example              # Sample environment variables
├── logs/                     # Local logs (ignored in Docker)
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Local Setup

Install dependencies for both client and server:

```bash
npm run install:all
```

### Running Locally

Start the server and client in separate terminals:

**Terminal 1 - Server** (runs on port 3001):
```bash
npm run dev:server
```

**Terminal 2 - Client** (runs on port 3000 with Vite HMR):
```bash
npm run dev:client
```

Then open http://localhost:3000 in your browser.

### Logs During Development

- **Client**: Check browser DevTools console (F12)
- **Server**: Logs appear in terminal where `npm run dev:server` is running

## Production Deployment with Docker

### Building the Docker Image

```bash
npm run docker:build
# or manually:
docker build -t cube-connect:latest .
```

This creates a multi-stage image that:
1. **Stage 1**: Builds the React client (`npm run build`)
2. **Stage 2**: Copies server and built client dist, installs production dependencies

### Environment Variables

Set these in `docker-compose.yml` or via `-e` flags:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `PORT` | `3001` | Server port |
| `ALLOWED_ORIGINS` | `http://localhost:3001` | CORS-allowed origins (comma-separated) |

Example with custom origins:
```bash
docker run -e ALLOWED_ORIGINS="https://example.com,https://app.example.com" cube-connect:latest
```

### Log Management

Logs are automatically managed by Docker's json-file driver:
- **Location on host**: `/var/lib/docker/containers/<container-id>/<container-id>-json.log`
- **Rotation**: 10MB per file, keeps 3 files (30MB total)
- **Access**: `docker logs cube-connect` or `npm run docker:logs`

Old log files are automatically deleted when rotation limit is reached.

### Health Check

The container includes a health check that verifies the `/health` endpoint responds with status 200:

```bash
# Check container health status
docker ps | grep cube-connect  # Look for "(healthy)" status
```

## Architecture

### Server
- **Framework**: Express.js
- **Real-time**: Socket.IO for multiplayer events
- **Logging**: Winston (stdout for Docker)
- **Static Files**: Serves React SPA from `client/dist`

### Client
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **Real-time**: Socket.IO client

### Game Logic
- **Board State**: In-memory (server-authoritative)
- **Connectivity Validation**: BFS algorithm
- **Win Detection**: Line detection in 4 directions

## Socket.IO Events

### Client → Server
- `createRoom`: Create a new game room with settings (winCondition, playerCount, cubesPerPlayer, playerName)
- `joinRoom`: Join an existing room by code
- `leaveRoom`: Leave the current room
- `reconnect`: Reconnect to a room after disconnect
- `startGame`: Start the game (host only, when all players ready)
- `makeMove`: Place or move a cube (or skip turn on timeout: row=-1, col=-1)
- `setReady` / `setNotReady`: Toggle player ready status
- `setTimerEnabled`: Toggle turn timer (host only)
- `cursorMove`: Update cursor position (for UI feedback)
- `sendEmote`: Send an emote reaction

### Server → Client
- `roomCreated`: Room successfully created with room code
- `roomJoined`: Player joined room (includes playerSlot, settings)
- `playerJoined`: Another player joined
- `playerLeft`: Another player left
- `playerReconnected`: Player reconnected after disconnect
- `gameStarted`: Game initialization data with full game state
- `gameStateUpdate`: Board/game state changes (includes winningLine if game won)
- `invalidMove`: Move rejected with reason
- `timerStateChanged`: Timer enabled/disabled by host
- `playerCursorMove`: Another player's cursor position
- `playerEmote`: Another player sent emote
- `error`: General error message

## Building for Production

### Docker Approach (Recommended)

```bash
docker build -t cube-connect:latest .
docker-compose up -d
```

### Manual Build

If deploying without Docker:

```bash
# Build client
npm run build:client

# Start server (will serve built client)
npm run start:server
```

Server will serve static files from `client/dist` and listen on port 3001.

## Logging

### Production (Docker)
All logs go to stdout, captured by Docker log driver:
```bash
docker logs cube-connect
docker logs -f cube-connect  # Follow in real-time
```

### Development
- **Server**: Logs in terminal
- **Client**: Browser console (DevTools)

No client → server log forwarding. Logs remain local for simplicity.

## Troubleshooting

### Container won't start
```bash
docker logs cube-connect
```
Check for port 3001 already in use or missing environment variables.

### Socket.IO connection failed
Verify `ALLOWED_ORIGINS` includes your client's origin in docker-compose.yml or container env vars.

### Client files not serving
Ensure client was built: `npm run build:client` before Docker build.

### Health check failing
```bash
docker exec cube-connect curl http://localhost:3001/health
```

## Development Notes

- **Node.js Version**: 18+ (specified in Dockerfile)
- **Package Manager**: npm
- **ES Modules**: `"type": "module"` in package.json
- **Server-Authoritative**: All game logic validated on server
- **Single-Instance**: Room state is in-memory. For multi-instance deployment, migrate to Redis.

## Current Limitations

- **Single-Instance Only**: Room state is in-memory. For multi-instance/clustered deployment, migrate to Redis or similar external store
- **No Persistence**: Games are lost on server restart
- **Grace Periods**: Rooms expire 10 minutes after last player leaves; disconnected players have 2 minutes to reconnect

## Future Enhancements

- [ ] Database persistence (rooms, game history, player stats)
- [ ] Multi-instance support with Redis
- [ ] Game replay/history viewer
- [ ] Player rankings and statistics
- [ ] Advanced error monitoring (Sentry integration)
- [ ] Mobile-optimized UI improvements
- [ ] Spectator mode
- [ ] In-game chat

## License

MIT

## Contributing

Pull requests welcome. Please ensure:
1. Dev setup works (`npm run install:all` + `npm run dev:*`)
2. No breaking Socket.IO event changes without coordination
3. Server-side game logic validated
