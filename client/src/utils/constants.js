export const GRID_SIZE = 20;

// Player color palette (supports up to 6 players)
export const PLAYER_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899'  // Pink
];

// Legacy config (kept for backwards compatibility)
export const PLAYERS_CONFIG = [
  { id: 1, name: 'Player 1', color: '#3b82f6' }, // Blue
  { id: 2, name: 'Player 2', color: '#ef4444' }, // Red
  { id: 3, name: 'Player 3', color: '#22c55e' }  // Green
];

// Player count limits
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

// Cube count settings
export const INITIAL_CUBES = 14;
export const MIN_CUBES_PER_PLAYER = 8;
export const MAX_CUBES_PER_PLAYER = 20;

// Recommended cube counts based on player count
export const RECOMMENDED_CUBES = {
  2: 20,  // 40 total (10% of 400 squares)
  3: 14,  // 42 total (10.5%)
  4: 12,  // 48 total (12%)
  5: 10,  // 50 total (12.5%)
  6: 10   // 60 total (15%)
};

export const WIN_CONDITIONS = {
  MIN: 4,
  MAX: 6,
  DEFAULT: 4
};

/**
 * Generate player configuration dynamically based on player count
 * @param {number} count - Number of players (2-6)
 * @param {string[]} names - Optional custom player names
 * @param {number} cubesPerPlayer - Cubes each player gets
 * @returns {Array} Array of player objects
 */
export const generatePlayers = (count, names = [], cubesPerPlayer = INITIAL_CUBES) => {
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`Player count must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}`);
  }

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: names[i] || `Player ${i + 1}`,
    color: PLAYER_COLORS[i],
    cubesLeft: cubesPerPlayer
  }));
};
