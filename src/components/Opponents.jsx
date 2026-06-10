import React from 'react';

export default function Opponents({ players, currentPlayer, myPlayerIndex = 0 }) {
  const otherPlayers = [];
  const numPlayers = players.length;
  for (let i = 1; i < numPlayers; i++) {
    const idx = (myPlayerIndex + i) % numPlayers;
    otherPlayers.push({ player: players[idx], index: idx });
  }
  
  return (
    <div className="opponents" id="opponents">
      {otherPlayers.map(({ player: p, index: actualIndex }) => {
        const isActive = currentPlayer === actualIndex;
        if (!p) return null;
        
        // Show up to 10 cards backs visually
        const visibleCardsCount = Math.min(p.hand.length, 10);
        const cardBacks = Array.from({ length: visibleCardsCount }).map((_, cIdx) => (
          <div key={cIdx} className="opp-card-back" />
        ));
        
        return (
          <div key={p.name} className={`opponent ${isActive ? 'active' : ''}`}>
            <div className="opp-avatar" style={{ backgroundColor: p.color }}>
              {p.name[0]}
            </div>
            <div className="opp-name">{p.name}</div>
            <div className="opp-cards">{cardBacks}</div>
            <div className="opp-card-count">
              {p.hand.length} card{p.hand.length !== 1 ? 's' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
