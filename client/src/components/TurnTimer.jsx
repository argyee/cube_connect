import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

const TurnTimer = ({
  isActive,
  timerSeconds,
  onTimeout,
  currentPlayer,
  players
}) => {
  const [timeLeft, setTimeLeft] = useState(timerSeconds);

  useEffect(() => {
    // Reset timer when turn changes
    setTimeLeft(timerSeconds);
  }, [currentPlayer, timerSeconds]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout && onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onTimeout]);

  if (!isActive) return null;

  const percentage = (timeLeft / timerSeconds) * 100;
  const isLowTime = timeLeft <= 10;
  const player = players[currentPlayer];

  return (
    <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
      <Timer
        size={16}
        className={isLowTime ? 'text-red-600 animate-pulse' : 'text-slate-600'}
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isLowTime ? 'text-red-600' : 'text-slate-700'}`}>
            {timeLeft}s
          </span>
          <span className="text-xs text-slate-500">
            ({player?.name}'s turn)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-32 h-1.5 bg-slate-300 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              isLowTime ? 'bg-red-600' : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default TurnTimer;
