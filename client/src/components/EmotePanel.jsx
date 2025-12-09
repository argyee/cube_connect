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
        <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 z-50 p-3" style={{ width: '300px' }}>
          <div className="flex flex-wrap gap-2 justify-center">
            {EMOTES.map((emote) => (
              <button
                key={emote}
                onClick={() => handleEmoteClick(emote)}
                className="text-3xl hover:scale-125 transition-transform active:scale-95 p-1 hover:bg-slate-100 rounded"
              >
                {emote}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Emote Display */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-3 pointer-events-none">
        {displayedEmotes.map((emote) => {
          const player = players.find(p => p.id === emote.playerId);
          const playerName = emote.playerName || player?.name || 'Player';
          return (
            <div
              key={emote.id}
              className="flex items-center gap-3 bg-white rounded-lg shadow-2xl px-4 py-3 emote-animation border border-slate-100"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: player?.color || '#cbd5e1' }}
              />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {playerName}
                </span>
              </div>
              <span className="text-3xl flex-shrink-0">{emote.emote}</span>
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
    </div>
  );
};

export default EmotePanel;
