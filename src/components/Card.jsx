import React from 'react';

const CARD_SYMBOLS = {
  skip: '⊘',
  reverse: '⟲',
  draw2: '+2',
  wild: '★',
  wild4: '+4'
};

export default function Card({ card, faceUp = true, extraClass = '', onClick }) {
  if (!faceUp) {
    return (
      <div 
        className={`card card-back ${extraClass}`} 
        data-id={card?.id}
        onClick={onClick}
      >
        <div className="card-inner">
          <div className="card-back-pattern">UNO</div>
        </div>
      </div>
    );
  }

  const isWild = card.color === 'wild';
  const colorClass = isWild ? 'card-wild' : `card-${card.color}`;
  const display = CARD_SYMBOLS[card.value] || card.value;

  return (
    <div
      className={`card ${colorClass} ${extraClass}`}
      data-id={card.id}
      data-color={card.color}
      data-value={card.value}
      onClick={onClick}
    >
      <div className="card-inner">
        {isWild && (
          <div className="wild-segments">
            <div className="wild-seg r"></div>
            <div className="wild-seg b"></div>
            <div className="wild-seg g"></div>
            <div className="wild-seg y"></div>
          </div>
        )}
        <div className="card-corner tl">{display}</div>
        <div className="card-oval">
          <span className="card-value">{display}</span>
        </div>
        <div className="card-corner br">{display}</div>
      </div>
    </div>
  );
}
