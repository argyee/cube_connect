/**
 * Utility functions for player operations
 */

/**
 * Find a player by their ID
 * @param {number} playerId - The player ID
 * @param {Array} players - Array of player objects
 * @returns {Object|null} - The player object or null
 */
export const findPlayerById = (playerId, players) => {
  return players.find(p => p.id === playerId) || null;
};

/**
 * Get player name by ID
 * @param {number} playerId - The player ID
 * @param {Array} players - Array of player objects
 * @returns {string} - The player name or 'Unknown'
 */
export const getPlayerName = (playerId, players) => {
  const player = findPlayerById(playerId, players);
  return player ? player.name : 'Unknown';
};

/**
 * Get player color by ID
 * @param {number} playerId - The player ID
 * @param {Array} players - Array of player objects
 * @returns {string} - The player color or default gray
 */
export const getPlayerColor = (playerId, players) => {
  const player = findPlayerById(playerId, players);
  return player ? player.color : '#666';
};

/**
 * Format board position to chess-style notation
 * Columns as letters (A-T), rows as numbers (1-20)
 * @param {number} row - The row index (0-19)
 * @param {number} col - The column index (0-19)
 * @returns {string} - Position in notation format (e.g., "A1", "T20")
 */
export const formatPosition = (row, col) => {
  const colLetter = String.fromCharCode(65 + col); // A, B, C, ...
  const rowNumber = row + 1;
  return `${colLetter}${rowNumber}`;
};
