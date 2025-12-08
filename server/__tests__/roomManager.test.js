import { test } from 'node:test';
import assert from 'node:assert/strict';
import roomManager from '../src/services/roomManager.js';

// Helper to reset singleton state between tests
const resetState = () => {
  // Clear any pending deletion timers
  for (const timeout of roomManager.roomDeletionTimers.values()) {
    clearTimeout(timeout);
  }
  roomManager.rooms.clear();
  roomManager.playerRooms.clear();
  roomManager.disconnectedPlayers.clear();
  roomManager.roomDeletionTimers.clear();
};

test('reindexes player slots after pre-start leave', () => {
  resetState();
  const room = roomManager.createRoom(4, 3, 14);
  const rcode = room.code;

  const r1 = roomManager.joinRoom(rcode, 's1', 'A');
  const r2 = roomManager.joinRoom(rcode, 's2', 'B');
  const r3 = roomManager.joinRoom(rcode, 's3', 'C');

  assert.strictEqual(room.players.length, 3);
  // s2 leaves before game start
  const leaveResult = roomManager.leaveRoom('s2');
  assert.strictEqual(leaveResult.roomDeleted, false);

  const remaining = leaveResult.room.players;
  assert.strictEqual(remaining.length, 2);
  // slots should be reindexed to 0 and 1
  assert.strictEqual(remaining[0].slot, 0);
  assert.strictEqual(remaining[1].slot, 1);
  // socketIds should be s1 and s3 (order preserved)
  assert.strictEqual(remaining[0].socketId, 's1');
  assert.strictEqual(remaining[1].socketId, 's3');

  // Ensure playerRooms map points to the same room for remaining sockets
  assert.strictEqual(roomManager.playerRooms.get('s1'), rcode);
  assert.strictEqual(roomManager.playerRooms.get('s3'), rcode);
});

test('clears disconnectedPlayers when deleting empty room (pre-start)', () => {
  resetState();
  const room = roomManager.createRoom(4, 2, 14);
  const rcode = room.code;

  // Simulate some disconnected tracking for this room
  roomManager.disconnectedPlayers.set(rcode, { 0: { socketId: 'x' } });
  assert.strictEqual(roomManager.disconnectedPlayers.has(rcode), true);

  // Join a single player then have them leave pre-start
  roomManager.joinRoom(rcode, 'solo', 'Solo');
  const res = roomManager.leaveRoom('solo');
  
  // With the new grace period implementation, room is not deleted immediately
  assert.strictEqual(res.roomDeleted, false);
  assert.strictEqual(res.deletionScheduled, true);
  
  // Room should still exist
  assert.strictEqual(roomManager.rooms.has(rcode), true);
  
  // disconnectedPlayers should still have an entry since room hasn't been deleted yet
  assert.strictEqual(roomManager.disconnectedPlayers.has(rcode), true);
  
  // Clean up the scheduled deletion timer
  if (roomManager.roomDeletionTimers.has(rcode)) {
    clearTimeout(roomManager.roomDeletionTimers.get(rcode));
    roomManager.roomDeletionTimers.delete(rcode);
  }
});

test('cleans up disconnectedPlayers map entry when last disconnected player reconnects', () => {
  resetState();
  const room = roomManager.createRoom(4, 3, 14);
  roomManager.joinRoom(room.code, 's1', 'P1');
  roomManager.joinRoom(room.code, 's2', 'P2');
  roomManager.joinRoom(room.code, 's3', 'P3');
  
  // Start the game
  roomManager.startGame(room.code);
  
  // Player 0 disconnects (triggers grace period)
  roomManager.leaveRoom('s1');
  
  // disconnectedPlayers should have an entry for this room
  assert.strictEqual(roomManager.disconnectedPlayers.has(room.code), true);
  const disconnects = roomManager.disconnectedPlayers.get(room.code);
  assert.strictEqual(disconnects[0] !== undefined, true);
  
  // Player 0 reconnects
  const reconnectResult = roomManager.reconnectPlayer(room.code, 's1-new', 0);
  assert.strictEqual(reconnectResult.success, true);
  
  // disconnectedPlayers entry for this room should be cleaned up
  assert.strictEqual(roomManager.disconnectedPlayers.has(room.code), false);
});
