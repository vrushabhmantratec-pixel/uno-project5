import React from 'react';

export default function Opponents({ players, currentPlayer }) {
  // AI players are at index 1, 2, 3
  const aiPlayers = [players[1], players[2], players[3]];
  
  return (
    <div className="opponents" id="opponents">
      {aiPlayers.map((p, idx) => {
        const actualIndex = idx + 1;
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
