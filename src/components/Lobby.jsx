import React, { useState, useMemo } from 'react';

export default function Lobby({ onStartGame, coins, gems, onAddCoins, showToast }) {
  const [rewardClaimed, setRewardClaimed] = useState(false);

  // Generate floating cards configuration once
  const floatingCards = useMemo(() => {
    const colors = ['card-red', 'card-blue', 'card-green', 'card-yellow'];
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      className: `floating-card ${colors[i % 4]}`,
      left: `${Math.random() * 90}%`,
      top: `${Math.random() * 90}%`,
      animationDelay: `${Math.random() * 8}s`,
      animationDuration: `${8 + Math.random() * 8}s`
    }));
  }, []);

  const claimReward = (e) => {
    e.stopPropagation();
    if (rewardClaimed) return;
    setRewardClaimed(true);
    onAddCoins(200);
    showToast(' +200 coins claimed!', 'success');
    if (window.spawnCoinParticles) {
      window.spawnCoinParticles(window.innerWidth / 2, window.innerHeight * 0.7, 15);
    }
  };

  return (
    <div id="lobby" className="screen">
      <div className="lobby-bg-cards">
        {floatingCards.map((card) => (
          <div
            key={card.id}
            className={card.className}
            style={{
              left: card.left,
              top: card.top,
              animationDelay: card.animationDelay,
              animationDuration: card.animationDuration
            }}
          />
        ))}
      </div>
      <div className="lobby-content">
        <div className="top-bar">
          <div className="player-info">
            <div className="avatar">Y</div>
            <div>
              <div className="player-name">You</div>
              <div className="player-level">Lvl 12</div>
            </div>
          </div>
          <div className="currency">
            <div className="currency-item">
              <i className="fas fa-coins coin-icon"></i>
              <span>{coins.toLocaleString()}</span>
            </div>
            <div className="currency-item">
              <i className="fas fa-gem gem-icon"></i>
              <span>{gems}</span>
            </div>
          </div>
        </div>

        <div className="logo-section">
          <div className="uno-logo">UNO</div>
          <div className="logo-sub">CARD PARTY</div>
        </div>

        <button className="play-btn" onClick={onStartGame}>
          <i className="fas fa-play" style={{ marginRight: '8px' }}></i>PLAY NOW
        </button>

        <div className="lobby-options">
          <button className="option-btn" onClick={onStartGame}>
            <i className="fas fa-bolt"></i>Quick Match
          </button>
          <button className="option-btn" onClick={onStartGame}>
            <i className="fas fa-plus-circle"></i>Create Room
          </button>
          <button className="option-btn" onClick={onStartGame}>
            <i className="fas fa-door-open"></i>Join Room
          </button>
          <button className="option-btn" onClick={onStartGame}>
            <i className="fas fa-user-friends"></i>Friends
          </button>
        </div>

        <div className="daily-reward" onClick={claimReward}>
          <div className="daily-icon">
            <i className="fas fa-gift"></i>
          </div>
          <div className="daily-text">
            <h4>Daily Reward</h4>
            <p>{rewardClaimed ? 'Day 3 claimed' : 'Day 3 of 7 — Claim your coins!'}</p>
          </div>
          <button
            className="daily-claim"
            style={{
              background: rewardClaimed ? '#666' : 'var(--gold)',
              color: rewardClaimed ? '#fff' : '#000',
              cursor: rewardClaimed ? 'default' : 'pointer'
            }}
            onClick={claimReward}
          >
            {rewardClaimed ? 'CLAIMED' : 'CLAIM'}
          </button>
        </div>

        <div className="bottom-nav">
          <div className="nav-btn">
            <i className="fas fa-trophy"></i>Leaderboard
          </div>
          <div className="nav-btn">
            <i className="fas fa-store"></i>Shop
          </div>
          <div className="nav-btn">
            <i className="fas fa-scroll"></i>Season
          </div>
          <div className="nav-btn">
            <i className="fas fa-cog"></i>Settings
          </div>
        </div>
      </div>
    </div>
  );
}
