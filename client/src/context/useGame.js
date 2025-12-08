import { useContext, createContext } from 'react';

// Export the context so GameContext.jsx can import it
export const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};
