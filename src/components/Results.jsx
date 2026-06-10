import React, { useEffect, useState } from 'react';

export default function Results({ players, winnerIdx, onGoLobby, onPlayAgain }) {
  const isHumanWin = winnerIdx === 0;
  const winner = players[winnerIdx];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const rewardCoins = isHumanWin ? 150 : 30;
  const rewardXP = isHumanWin ? 45 : 15;

  const [xpWidth, setXpWidth] = useState('0%');

  useEffect(() => {
    const timer = setTimeout(() => {
      setXpWidth('68%');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="results" className="screen">
      <div className={`results-title ${isHumanWin ? 'win' : 'lose'}`} id="resultsTitle">
        {isHumanWin ? 'Victory!' : `${winner?.name || 'Player'} Wins!`}
      </div>
      <div className="results-subtitle" id="resultsSubtitle">
        {isHumanWin ? 'Amazing play!' : 'Better luck next time!'}
      </div>
      
      <div className="results-scores" id="resultsScores">
        {sortedPlayers.map((p, idx) => {
          const isWinner = players.indexOf(p) === winnerIdx;
          return (
            <div key={p.name} className={`result-row ${isWinner ? 'winner' : ''}`}>
              <div className="result-rank">{idx + 1}</div>
              <div className="result-avatar" style={{ backgroundColor: p.color }}>
                {p.name[0]}
              </div>
              <div className="result-name">{p.name}</div>
              <div className="result-score">
                {p.score > 0 ? '+' : ''}
                {p.score}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rewards-section" id="rewardsSection">
        <div className="reward-item">
          <i className="fas fa-coins reward-icon" style={{ color: 'var(--gold)' }}></i>
          <div className="reward-value" id="rewardCoins">+{rewardCoins}</div>
          <div className="reward-label">Coins</div>
        </div>
        <div className="reward-item">
          <i className="fas fa-star reward-icon" style={{ color: '#a855f7' }}></i>
          <div className="reward-value" id="rewardXP">+{rewardXP}</div>
          <div className="reward-label">XP</div>
        </div>
      </div>

      <div className="xp-bar-container">
        <div className="xp-bar-label">
          <span>Level 12</span>
          <span id="xpText">340/500 XP</span>
        </div>
        <div className="xp-bar">
          <div 
            className="xp-bar-fill" 
            id="xpFill" 
            style={{ width: xpWidth }}
          />
        </div>
      </div>

      <div className="results-actions">
        <button className="results-btn secondary" onClick={onGoLobby}>
          Lobby
        </button>
        <button className="results-btn primary" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
