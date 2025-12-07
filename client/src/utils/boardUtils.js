/**
 * Utility functions for board position management
 */

export const getCubeKey = (row, col) => `${row},${col}`;

export const parseCubeKey = (key) => {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
};

/**
 * Get 4-way adjacent positions (horizontal/vertical only)
 * Used for placement validation and connectivity checks
 */
export const getAdjacentPositions = (row, col) => {
  return [
    { row: row - 1, col },      // up
    { row: row + 1, col },      // down
    { row, col: col - 1 },      // left
    { row, col: col + 1 }       // right
  ];
};

/**
 * Check if a position is valid on the board
 */
export const isValidPosition = (row, col, gridSize) => {
  return row >= 0 && row < gridSize && col >= 0 && col < gridSize;
};

/**
 * Check if a position touches any cube (4-way adjacency)
 */
export const touchesAnyCube = (row, col, board) => {
  const adjacent = getAdjacentPositions(row, col);
  return adjacent.some(pos => board[getCubeKey(pos.row, pos.col)]);
};
