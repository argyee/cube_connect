import { getCubeKey, parseCubeKey, getAdjacentPositions, isValidPosition } from './boardUtils.js';
import { GRID_SIZE, PLAYERS_CONFIG, INITIAL_CUBES } from './constants.js';
import logger from './logger.js';

/**
 * Check if a placement would create a win (used during random generation)
 */
const wouldCreateWin = (row, col, playerId, testBoard, winCondition) => {
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
      if (testBoard[key] === playerId) count++;
      else break;
    }

    for (let i = 1; i < winCondition; i++) {
      const key = getCubeKey(row - dr * i, col - dc * i);
      if (testBoard[key] === playerId) count++;
      else break;
    }

    if (count >= winCondition) return true;
  }
  return false;
};

/**
 * Generate a random test board with cubes for all players
 * Only used in debug mode for testing
 * @param {number} winCondition - The win condition (4, 5, or 6)
 * @returns {Object} - Object with board and updated player states
 */
export const generateRandomBoard = (winCondition, players = [], cubesPerPlayerOverride = null) => {
  try {
    const activePlayers = (players && players.length > 0 ? players : PLAYERS_CONFIG).map(p => ({ ...p }));
    const newBoard = {};

    // Target ~80% of each player's available cubes so movement phase is quickly reachable
    const targetFillRatio = 0.8;
    const targetPerPlayer = {};
    const playerCubeCount = {};

    activePlayers.forEach(p => {
      const maxCubes = cubesPerPlayerOverride ?? p.cubesLeft ?? INITIAL_CUBES;
      targetPerPlayer[p.id] = Math.max(1, Math.round(maxCubes * targetFillRatio));
      playerCubeCount[p.id] = 0;
    });

    const totalTarget = Object.values(targetPerPlayer).reduce((sum, val) => sum + val, 0);
    const centerRow = Math.floor(GRID_SIZE / 2);
    const centerCol = Math.floor(GRID_SIZE / 2);

    // Place the first cube at center for player 0
    const firstKey = getCubeKey(centerRow, centerCol);
    newBoard[firstKey] = activePlayers[0].id;
    playerCubeCount[activePlayers[0].id] = 1;

    // Keep placing cubes until all players have their target amount
    let totalPlaced = 1;
    const maxAttempts = 1000;
    let globalAttempts = 0;

    while (totalPlaced < totalTarget && globalAttempts < maxAttempts) {
      globalAttempts++;

      // Pick a random player who hasn't reached their limit
      const playersNeedingCubes = activePlayers.filter(
        p => playerCubeCount[p.id] < targetPerPlayer[p.id]
      );

      if (playersNeedingCubes.length === 0) break;

      const targetPlayer = playersNeedingCubes[Math.floor(Math.random() * playersNeedingCubes.length)];

      // Find all empty positions adjacent to ANY existing cube
      const allCubeKeys = Object.keys(newBoard);
      const candidates = [];

      allCubeKeys.forEach(cubeKey => {
        const { row: r, col: c } = parseCubeKey(cubeKey);
        const adjacent = getAdjacentPositions(r, c);

        adjacent.forEach(pos => {
          if (isValidPosition(pos.row, pos.col, GRID_SIZE)) {
            const key = getCubeKey(pos.row, pos.col);
            if (!newBoard[key] && !candidates.includes(key)) {
              candidates.push(key);
            }
          }
        });
      });

      if (candidates.length === 0) break;

      // Try a random candidate
      const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
      const { row, col } = parseCubeKey(randomCandidate);

      // Test if this placement would create a win
      const testBoard = { ...newBoard, [randomCandidate]: targetPlayer.id };
      if (!wouldCreateWin(row, col, targetPlayer.id, testBoard, winCondition)) {
        newBoard[randomCandidate] = targetPlayer.id;
        playerCubeCount[targetPlayer.id]++;
        totalPlaced++;
      }
    }

    // Update player cube counts
    const updatedPlayers = activePlayers.map(player => {
      const placedCubes = playerCubeCount[player.id] || 0;
      const maxCubes = cubesPerPlayerOverride ?? player.cubesLeft ?? INITIAL_CUBES;
      return {
        ...player,
        cubesLeft: Math.max(0, maxCubes - placedCubes)
      };
    });

    logger.debug(`Board generation complete: ${totalPlaced} cubes placed in ${globalAttempts} attempts (~${Math.round(targetFillRatio * 100)}% of available cubes per player)`);
    return { board: newBoard, players: updatedPlayers };
  } catch (error) {
    logger.error('Error generating random board', { winCondition, error: error.message });
    return { board: {}, players: players && players.length > 0 ? players : PLAYERS_CONFIG };
  }
};
