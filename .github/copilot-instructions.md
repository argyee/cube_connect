# Copilot Instructions — Cube Connect

Purpose: give an AI coding assistant immediate, actionable context for working in this repository.

1) Big picture
- Server: `server/src/index.js` — Express + Socket.IO. Socket events are the primary surface for multiplayer behavior.
  - Room & player lifecycle is implemented in `server/src/services/roomManager.js`.
  - Event handlers live in `server/src/controllers/gameController.js` and call game rules in `server/src/utils/gameLogic.js`.
- Client: `client/src` — React + Vite. `client/src/context/GameContext.jsx` centralizes socket logic, reconnect/session handling, and exposes actions used by components.
- Deployment: nginx config in `deploy/nginx/cube_connect.conf` proxies `/socket.io/` to backend (3001). PM2 config in `server/ecosystem.config.cjs` is provided for production.

2) Critical developer workflows (commands)
- Install both sides: `npm run install:all` (from repo root).
- Local dev (recommended):
  - Run client: `npm run dev:client`
  - Run server: `npm run dev:server`
  - Both of the above are available via separate terminals or your process manager.
- Build + production run:
  - Build client: `npm run build:client`
  - Start server: `npm run start:server` (starts node `src/index.js`), or use PM2:
    `pm2 start server/ecosystem.config.cjs --env production`
- Health & logs:
  - Health endpoint: `GET /health` (see `server/src/index.js`).
  - Client logging endpoint: `POST /api/logs` (rate-limited).

3) Socket events & payload shapes (must keep client & server in sync)
- Client emits:
  - `createRoom`: { winCondition, playerCount, cubesPerPlayer, playerName }
  - `joinRoom`: { roomCode, playerName }
  - `leaveRoom`: no payload
  - `startGame`: { roomCode }
  - `setReady` / `setNotReady`: { roomCode, playerSlot }
  - `makeMove`: { roomCode, row, col, selectedCube? }
  - `cursorMove`: { roomCode, row, col }
  - `sendEmote`: { roomCode, emote }
  - `reconnect`: { roomCode, playerSlot }
- Server emits:
  - `roomCreated`, `roomJoined`, `playerJoined`, `playerLeft`, `playerReconnected`
  - `gameStarted` (payload: `{ gameState }`)
  - `gameStateUpdate` (payload: `{ gameState }`)
  - `invalidMove`, `error`, `playerCursorMove`, `playerEmote`

4) Project-specific conventions & patterns
- ES module style (`"type": "module"` in package.json). Use `import`/`export` in server and client.
- Centralized socket logic: modify `GameContext.jsx` when you change or add events; it is the single source of client-side socket behavior.
- Server-side single-thread model by default: `server/ecosystem.config.cjs` uses `exec_mode: 'fork'` and `instances: 1`. If you change to clustering, be careful with in-memory room state (RoomManager keeps state in-process).
- Persistence & reconnect: the client saves room/session state in `client/src/utils/sessionStorage.js` and attempts auto-reconnect on mount. Preserve keys `cubeConnectRoomSession` and `cubeConnectGameState` if you change reconnect behavior.
- Game rules live in `server/src/utils/gameLogic.js`. Keep server authoritative — validate on server before accepting moves.

5) Integration points / external dependencies
- Socket.IO: bidirectional events (see above). Changing event names requires updating both client and server.
- Reverse proxy: `deploy/nginx/cube_connect.conf` proxies `/socket.io/` to `http://127.0.0.1:3001/socket.io/` and proxies `/health` and `/api/logs`.
- Environment: production origin whitelist is read from `ALLOWED_ORIGINS` (see `server/src/index.js` and `server/ecosystem.config.cjs`). Set it at deployment.

6) Files to inspect when making changes
- Server: `server/src/index.js`, `server/src/controllers/gameController.js`, `server/src/services/roomManager.js`, `server/src/utils/gameLogic.js`, `server/ecosystem.config.cjs`.
- Client: `client/src/context/GameContext.jsx`, `client/src/utils/sessionStorage.js`, `client/src/pages/*`, `client/src/components/*`.
- Deployment: `deploy/nginx/cube_connect.conf`, `server/ecosystem.config.cjs`.

7) Quick debugging tips
- To reproduce a socket issue: run `npm run dev:server` and `npm run dev:client` and open browser console + server logs. Server logs write to console (and PM2 logs if used).
- If changing room behavior, test cases:
  - Create room -> join multiple clients -> start game -> make moves.
  - Disconnect a client during an active game and verify reconnect logic (server keeps a 2-minute grace period in `roomManager.leaveRoom`).
- If moving state to a clustered environment, replace `RoomManager` in-memory maps with an external store (Redis) before switching PM2 to `cluster`.

If anything above is unclear or you'd like me to expand examples (e.g., exact `makeMove` message handling or a small unit test for `checkWin`), tell me which area to expand.
