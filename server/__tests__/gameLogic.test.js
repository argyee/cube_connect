import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCubeKey, checkWin, canMoveCube, checkConnectivity } from '../src/utils/gameLogic.js';

test('checkWin detects horizontal win', () => {
  const board = {};
  board[getCubeKey(0, 0)] = 1;
  board[getCubeKey(0, 1)] = 1;
  board[getCubeKey(0, 2)] = 1;

  const result = checkWin(0, 2, 1, board, 3);
  assert.strictEqual(result.isWin, true);
  assert.deepEqual(result.winningLine, [getCubeKey(0,0), getCubeKey(0,1), getCubeKey(0,2)]);
});

test('checkWin returns false when not enough in a row', () => {
  const board = {};
  board[getCubeKey(0, 0)] = 1;
  board[getCubeKey(0, 2)] = 1;

  const result = checkWin(0, 2, 1, board, 3);
  assert.strictEqual(result.isWin, false);
  assert.deepEqual(result.winningLine, []);
});

test('canMoveCube prevents breaking connectivity', () => {
  // Layout: three cubes in a line; removing middle breaks connectivity
  const board = {};
  board[getCubeKey(0, 0)] = 1;
  board[getCubeKey(0, 1)] = 1;
  board[getCubeKey(0, 2)] = 1;

  // Attempt to remove middle cube
  const canMoveMiddle = canMoveCube(getCubeKey(0,1), 1, board);
  // Removing middle leaves two separate cubes -> should be false
  assert.strictEqual(canMoveMiddle, false);

  // Removing an end cube should be ok
  const canMoveEnd = canMoveCube(getCubeKey(0,2), 1, board);
  assert.strictEqual(canMoveEnd, true);
});

test('checkConnectivity returns true for connected set', () => {
  const board = {};
  board[getCubeKey(1,1)] = 2;
  board[getCubeKey(1,2)] = 2;
  board[getCubeKey(2,2)] = 2;

  const connected = checkConnectivity(2, board);
  assert.strictEqual(connected, true);
});
