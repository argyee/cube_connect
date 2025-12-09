import { useState, useCallback } from 'react';

/**
 * Custom hook to handle connection timeout warnings
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {object} { startTimeout, clearTimeoutWarning, isTimeout, setIsTimeout }
 */
export const useConnectionTimeout = (timeoutMs = 5000) => {
  const [isTimeout, setIsTimeout] = useState(false);

  const startTimeout = useCallback((onTimeout) => {
    const timeoutId = setTimeout(() => {
      setIsTimeout(true);
      if (onTimeout) onTimeout();
    }, timeoutMs);

    return timeoutId;
  }, [timeoutMs]);

  const clearTimeoutWarning = useCallback((timeoutId) => {
    clearTimeout(timeoutId);
    setIsTimeout(false);
  }, []);

  return { startTimeout, clearTimeoutWarning, isTimeout, setIsTimeout };
};

export default useConnectionTimeout;
