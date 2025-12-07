import { getCubeKey, parseCubeKey, getAdjacentPositions } from './boardUtils.js';
import logger from './logger.js';

/**
 * Core BFS function to find all reachable cubes from a starting position
 * @param {string[]} targetCubes - Array of cube keys to check reachability for
 * @param {Object} board - The current board state
 * @returns {Set} - Set of reachable target cube keys
 */
const findReachableCubes = (targetCubes, board) => {
  if (targetCubes.length === 0) return new Set();

  const visited = new Set();
  const queue = [targetCubes[0]];
  visited.add(targetCubes[0]);
  const reachedTargets = new Set([targetCubes[0]]);

  while (queue.length > 0) {
    const current = queue.shift();
    const { row, col } = parseCubeKey(current);
    const adjacent = getAdjacentPositions(row, col);

    for (const pos of adjacent) {
      const key = getCubeKey(pos.row, pos.col);
      // Traverse through ANY occupied square (any color)
      if (board[key] && !visited.has(key)) {
        visited.add(key);
        queue.push(key);
        // Track if it's one of our target cubes
        if (targetCubes.includes(key)) {
          reachedTargets.add(key);
        }
      }
    }
  }

  return reachedTargets;
};

/**
 * Check if a cube can be moved without breaking board connectivity
 * Rule: ALL cubes on the board must remain in one connected network
 * @param {string} cubeKey - The cube position key to check
 * @param {number} playerId - The player ID (not used, kept for API compatibility)
 * @param {Object} board - The current board state
 * @returns {boolean} - True if the cube can be moved without breaking connectivity
 */
export const canMoveCube = (cubeKey, playerId, board) => {
  try {
    // Simulate removing the cube
    const tempBoard = { ...board };
    delete tempBoard[cubeKey];

    const allRemainingCubes = Object.keys(tempBoard);

    // Empty or single cube is always connected
    if (allRemainingCubes.length <= 1) return true;

    // Check if ALL remaining cubes stay in one connected network
    const reachableCubes = findReachableCubes(allRemainingCubes, tempBoard);
    const canMove = reachableCubes.size === allRemainingCubes.length;
    
    if (!canMove) {
      logger.debug(`Move rejected: cube ${cubeKey} would break board connectivity (reachable: ${reachableCubes.size}, total: ${allRemainingCubes.length})`);
    }
    
    return canMove;
  } catch (error) {
    logger.error('Error checking cube move connectivity', { cubeKey, playerId, error: error.message });
    return false;
  }
};

/**
 * Get the cubes that would be disconnected if a cube is moved
 * Returns all cubes that would be in the smaller disconnected group(s)
 * NOTE: Checks ALL cubes on board, not just one player's cubes
 * @param {string} cubeKey - The cube position key to test removal
 * @param {number} playerId - The player ID (not used, kept for API compatibility)
 * @param {Object} board - The current board state
 * @returns {string[]} - Array of cube keys that would be disconnected
 */
export const getDisconnectedCubes = (cubeKey, playerId, board) => {
  // Simulate removing the cube
  const tempBoard = { ...board };
  delete tempBoard[cubeKey];

  const allRemainingCubes = Object.keys(tempBoard);

  if (allRemainingCubes.length <= 1) return [];

  // Find the main connected component
  const reachableFromFirst = findReachableCubes(allRemainingCubes, tempBoard);

  // If all cubes are still connected, return empty array
  if (reachableFromFirst.size === allRemainingCubes.length) return [];

  // Return the cubes that are NOT in the main connected component
  return allRemainingCubes.filter(cube => !reachableFromFirst.has(cube));
};
