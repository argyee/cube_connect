import React, { useState, useEffect } from 'react';
import { Smile } from 'lucide-react';

const EMOTES = ['👍', '👎', '😊', '😢', '🤔', '🎉', '😮', '👏'];

const EmotePanel = ({ onSendEmote, playerEmotes, players }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [displayedEmotes, setDisplayedEmotes] = useState([]);

  useEffect(() => {
    // Update displayed emotes when new ones come in
    if (playerEmotes && playerEmotes.length > 0) {
      const latest = playerEmotes[playerEmotes.length - 1];
      const newEmote = {
        ...latest,
        id: Date.now() + Math.random()
      };

      setDisplayedEmotes(prev => [...prev, newEmote]);

      // Remove emote after 3 seconds
      setTimeout(() => {
        setDisplayedEmotes(prev => prev.filter(e => e.id !== newEmote.id));
      }, 3000);
    }
  }, [playerEmotes]);

  const handleEmoteClick = (emote) => {
    onSendEmote(emote);
    setShowPanel(false);
  };

  return (
    <div className="relative">
      {/* Emote Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className={`flex items-center gap-2 ${showPanel ? 'bg-blue-600' : 'bg-slate-600'} hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm`}
        title="Send Emote"
      >
        <Smile size={16} />
        <span className="hidden sm:inline">Emote</span>
      </button>

      {/* Emote Selection Panel */}
      {showPanel && (
        <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-3">
          <div className="grid grid-cols-4 gap-2">
            {EMOTES.map((emote) => (
              <button
                key={emote}
                onClick={() => handleEmoteClick(emote)}
                className="text-2xl hover:scale-125 transition-transform active:scale-95 p-2 hover:bg-slate-100 rounded"
              >
                {emote}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Emote Display */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2 pointer-events-none">
        {displayedEmotes.map((emote) => {
          const player = players.find(p => p.id === emote.playerId);
          return (
            <div
              key={emote.id}
              className="flex items-center gap-2 bg-white rounded-lg shadow-lg px-3 py-2 animate-bounce"
              style={{
                animation: 'slideIn 0.3s ease-out, fadeOut 0.5s ease-in 2.5s forwards'
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: player?.color || '#666' }}
              />
              <span className="text-sm font-medium text-slate-700">
                {player?.name || 'Player'}
              </span>
              <span className="text-2xl">{emote.emote}</span>
            </div>
          );
        })}
      </div>

      {/* Click outside to close */}
      {showPanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPanel(false)}
        />
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default EmotePanel;
