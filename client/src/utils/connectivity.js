import { getCubeKey, parseCubeKey, getAdjacentPositions } from './boardUtils.js';
import logger from './logger.js';

/**
 * Find all connected components in the board after removing a cube
 * Returns the smallest component(s) that would be disconnected
 * @param {string[]} allCubes - All cube keys on the board
 * @param {Object} board - The current board state
 * @returns {Set} - Set of cube keys that form isolated groups
 */
const findAllConnectedComponents = (allCubes, board) => {
  const visited = new Set();
  const components = []; // Array of Sets, each Set is a connected component

  for (const startCube of allCubes) {
    if (visited.has(startCube)) continue;

    // BFS from this cube
    const queue = [startCube];
    const component = new Set([startCube]);
    visited.add(startCube);

    while (queue.length > 0) {
      const current = queue.shift();
      const { row, col } = parseCubeKey(current);
      const adjacent = getAdjacentPositions(row, col);

      for (const pos of adjacent) {
        const key = getCubeKey(pos.row, pos.col);
        // Check if there's a cube at this position AND we haven't visited it
        if (board[key] !== undefined && !visited.has(key)) {
          visited.add(key);
          component.add(key);
          queue.push(key);
        }
      }
    }

    components.push(component);
  }

  return components;
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

    // Filter to only this player's cubes
    const playerCubes = Object.keys(tempBoard).filter(key => tempBoard[key] === playerId);

    // Empty or single cube is always connected
    if (playerCubes.length <= 1) return true;

    // Check if ALL of this player's remaining cubes stay in one connected network
    const reachableCubes = findReachableCubes(playerCubes, tempBoard);
    const canMove = reachableCubes.size === playerCubes.length;
    
    if (!canMove) {
      logger.debug('Connectivity', 'Move rejected - would break player connectivity', { cubeKey, playerId, reachable: reachableCubes.size, total: playerCubes.length });
    }
    
    return canMove;
  } catch (error) {
    logger.error('Connectivity', 'Error checking cube move connectivity', { cubeKey, playerId, error: error.message });
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

  logger.debug('Connectivity', 'Board state before removal', { 
    totalCubes: Object.keys(board).length,
    boardKeys: Object.keys(board).sort().join(', ')
  });

  // Find all connected components after removal
  const components = findAllConnectedComponents(allRemainingCubes, tempBoard);

  logger.debug('Connectivity', 'getDisconnectedCubes', { 
    cubeKey, 
    allCubes: allRemainingCubes.length, 
    numComponents: components.length,
    componentSizes: components.map(c => c.size).join(', ')
  });

  // If there's only 1 component, nothing is disconnected
  if (components.length === 1) return [];

  // Return all cubes from components that are NOT the largest
  // (the largest is the "main" group, smaller ones are "isolated")
  let largestComponent = components[0];
  for (const component of components) {
    if (component.size > largestComponent.size) {
      largestComponent = component;
    }
  }

  const disconnected = allRemainingCubes.filter(cube => !largestComponent.has(cube));
  logger.debug('Connectivity', 'Disconnected cubes found', { disconnected: disconnected.join(', ') });
  return disconnected;
};
