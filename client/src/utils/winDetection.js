import { getCubeKey } from './boardUtils.js';
import logger from './logger.js';

/**
 * Count cubes in a specific direction
 * @param {number} row - Starting row
 * @param {number} col - Starting column
 * @param {number} dr - Row direction delta
 * @param {number} dc - Column direction delta
 * @param {number} playerId - The player ID to check
 * @param {Object} board - The current board state
 * @param {number} maxCount - Maximum count to check
 * @returns {number} - Number of consecutive cubes found
 */
const countInDirection = (row, col, dr, dc, playerId, board, maxCount) => {
  let count = 0;
  for (let i = 1; i < maxCount; i++) {
    const key = getCubeKey(row + dr * i, col + dc * i);
    if (board[key] === playerId) {
      count++;
    } else {
      break;
    }
  }
  return count;
};

/**
 * Check if a player has won by getting N in a row (8-way detection)
 * Checks horizontal, vertical, and both diagonals
 * @param {number} row - Row of the last placed cube
 * @param {number} col - Column of the last placed cube
 * @param {number} playerId - The player ID to check
 * @param {Object} board - The current board state
 * @param {number} winCondition - Number of cubes needed in a row (4, 5, or 6)
 * @returns {boolean} - True if player has won
 */
export const checkWin = (row, col, playerId, board, winCondition) => {
  try {
    const directions = [
      { dr: 0, dc: 1 },   // Horizontal
      { dr: 1, dc: 0 },   // Vertical
      { dr: 1, dc: 1 },   // Diagonal \
      { dr: 1, dc: -1 }   // Diagonal /
    ];

    for (const { dr, dc } of directions) {
      const count = 1 + // Count the placed cube itself
        countInDirection(row, col, dr, dc, playerId, board, winCondition) +
        countInDirection(row, col, -dr, -dc, playerId, board, winCondition);

      if (count >= winCondition) {
        logger.debug(`Win detected for player ${playerId} at (${row}, ${col}) with condition ${winCondition}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking win condition', { row, col, playerId, winCondition, error: error.message });
    return false;
  }
};
