/**
 * Server-side game logic utilities
 */

const GRID_SIZE = 20;

export const getCubeKey = (row, col) => `${row},${col}`;

export const parseCubeKey = (key) => {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
};

export const getAdjacentPositions = (row, col) => {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ];
};

export const touchesAnyCube = (row, col, board) => {
  const adjacent = getAdjacentPositions(row, col);
  return adjacent.some(pos => board[getCubeKey(pos.row, pos.col)]);
};

export const checkConnectivity = (playerId, board, excludeKey = null) => {
  const playerCubes = Object.entries(board)
    .filter(([key, val]) => val === playerId && key !== excludeKey)
    .map(([key]) => key);

  if (playerCubes.length <= 1) return true;

  const remainingSet = new Set(playerCubes);
  const visited = new Set();
  const queue = [playerCubes[0]];
  visited.add(playerCubes[0]);

  while (queue.length > 0) {
    const current = queue.shift();
    const { row, col } = parseCubeKey(current);
    const adjacent = getAdjacentPositions(row, col);

    for (const pos of adjacent) {
      const key = getCubeKey(pos.row, pos.col);
      if (remainingSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(key);
      }
    }
  }

  return visited.size === remainingSet.size;
};

export const canMoveCube = (cubeKey, playerId, board) => {
  const tempBoard = { ...board };
  delete tempBoard[cubeKey];
  const remainingCubes = Object.entries(tempBoard)
    .filter(([k, val]) => val === playerId)
    .map(([k]) => k);

  if (remainingCubes.length <= 1) return true;

  const remainingSet = new Set(remainingCubes);
  const visited = new Set();
  const queue = [remainingCubes[0]];
  visited.add(remainingCubes[0]);

  while (queue.length > 0) {
    const current = queue.shift();
    const { row, col } = parseCubeKey(current);
    const adjacent = getAdjacentPositions(row, col);

    for (const pos of adjacent) {
      const adjKey = getCubeKey(pos.row, pos.col);
      if (remainingSet.has(adjKey) && !visited.has(adjKey)) {
        visited.add(adjKey);
        queue.push(adjKey);
      }
    }
  }

  return visited.size === remainingSet.size;
};

export const checkWin = (row, col, playerId, board, winCondition) => {
  const directions = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 },
    { dr: 1, dc: 1 },
    { dr: 1, dc: -1 }
  ];

  for (const { dr, dc } of directions) {
    let count = 1;

    for (let i = 1; i < winCondition; i++) {
      const key = getCubeKey(row + dr * i, col + dc * i);
      if (board[key] === playerId) {
        count++;
      } else {
        break;
      }
    }

    for (let i = 1; i < winCondition; i++) {
      const key = getCubeKey(row - dr * i, col - dc * i);
      if (board[key] === playerId) {
        count++;
      } else {
        break;
      }
    }

    if (count >= winCondition) {
      return true;
    }
  }

  return false;
};
