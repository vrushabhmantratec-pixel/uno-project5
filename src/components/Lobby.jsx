import React, { useState, useMemo } from 'react';

export default function Lobby({ 
  onStartGame, 
  coins, 
  gems, 
  onAddCoins, 
  showToast,
  myRoomId,
  isHost,
  lobbyPlayers = [],
  maxPlayersLimit = 4,
  joiningRoomId,
  onJoinRoom,
  onCreateRoom,
  onStartMultiplayerGame,
  onLeaveRoom
}) {
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [playerLimit, setPlayerLimit] = useState(4);
  const [joinName, setJoinName] = useState('');

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

  const inviteLink = useMemo(() => {
    if (!myRoomId) return '';
    return `${window.location.origin}${window.location.pathname}?room=${myRoomId}`;
  }, [myRoomId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    showToast('Invitation link copied to clipboard!', 'success');
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (!joinName.trim()) {
      showToast('Please enter your name!', 'warn');
      return;
    }
    onJoinRoom(joinName.trim());
  };

  const handleCreateSubmit = () => {
    onCreateRoom(playerLimit);
    setIsCreatingRoom(false);
  };

  // Render Join Name Input Screen
  if (joiningRoomId && !myRoomId) {
    return (
      <div id="lobby" className="screen">
        <div className="lobby-content" style={{ justifyContent: 'center' }}>
          <div className="logo-section">
            <div className="uno-logo">UNO</div>
            <div className="logo-sub">JOIN MULTIPLAYER</div>
          </div>
          <form className="join-room-form" onSubmit={handleJoinSubmit}>
            <h3 style={{ marginBottom: '12px', textAlign: 'center', color: 'var(--accent)' }}>Join Room: #{joiningRoomId}</h3>
            <input 
              type="text" 
              placeholder="Enter your nickname" 
              value={joinName} 
              onChange={(e) => setJoinName(e.target.value)}
              className="nickname-input"
              maxLength={12}
              autoFocus
            />
            <button type="submit" className="play-btn" style={{ marginTop: '16px' }}>
              JOIN NOW
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Waiting Room Screen
  if (myRoomId) {
    return (
      <div id="lobby" className="screen">
        <div className="lobby-content" style={{ paddingBottom: '30px' }}>
          <div className="top-bar">
            <h3 className="room-title">ROOM: #{myRoomId}</h3>
            <span className="room-limit">{lobbyPlayers.length} / {maxPlayersLimit} Players</span>
          </div>

          <div className="room-members-list">
            {Array.from({ length: maxPlayersLimit }).map((_, idx) => {
              const p = lobbyPlayers[idx];
              return (
                <div key={idx} className={`room-member-slot ${p ? 'filled' : 'empty'}`}>
                  {p ? (
                    <>
                      <div className="member-avatar" style={{ backgroundColor: p.color }}>
                        {p.name[0]}
                      </div>
                      <div className="member-details">
                        <span className="member-name">{p.name}</span>
                        {idx === 0 && <span className="host-badge">HOST</span>}
                      </div>
                    </>
                  ) : (
                    <span className="waiting-placeholder">Waiting for player...</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="invite-card">
            <h4>Invite Friends</h4>
            <p className="invite-desc">Share this link to let your friends join directly</p>
            <div className="invite-link-container">
              <input type="text" readOnly value={inviteLink} className="invite-link-input" />
              <button className="copy-link-btn" onClick={handleCopyLink} aria-label="Copy invitation link">
                <i className="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <div className="room-actions" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
            {isHost ? (
              <button 
                className="play-btn" 
                onClick={onStartMultiplayerGame} 
                disabled={lobbyPlayers.length < 2}
                style={{ opacity: lobbyPlayers.length < 2 ? 0.6 : 1, width: '100%', maxWidth: 'none' }}
              >
                START GAME
              </button>
            ) : (
              <div className="waiting-msg">
                <i className="fas fa-spinner fa-spin"></i> Waiting for host to start the game...
              </div>
            )}
            <button className="option-btn" onClick={onLeaveRoom} style={{ width: '100%', padding: '12px' }}>
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Default Main Lobby
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
          <button className="option-btn" onClick={() => setIsCreatingRoom(true)}>
            <i className="fas fa-plus-circle"></i>Create Room
          </button>
          <button className="option-btn" onClick={() => {
            const code = prompt('Enter 5-digit room code to join:');
            if (code && code.trim()) {
              window.location.search = `?room=${code.trim()}`;
            }
          }}>
            <i className="fas fa-door-open"></i>Join Room
          </button>
          <button className="option-btn" onClick={() => setIsCreatingRoom(true)}>
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

      {/* Room Creation Options Modal */}
      {isCreatingRoom && (
        <div className="color-picker-overlay visible" onClick={() => setIsCreatingRoom(false)}>
          <div className="color-picker" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '360px' }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: '8px' }}>Create Private Room</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '20px' }}>Select the maximum player capacity for this game session</p>
            
            <div className="limit-selector-container" style={{ margin: '20px 0' }}>
              <div className="limit-value" style={{ fontFamily: "'Fredoka One', cursive", fontSize: '40px', color: 'var(--gold)', marginBottom: '8px' }}>
                {playerLimit} <span style={{ fontSize: '16px', color: '#fff' }}>Players</span>
              </div>
              <input 
                type="range" 
                min="2" 
                max="6" 
                value={playerLimit} 
                onChange={(e) => setPlayerLimit(parseInt(e.target.value))}
                className="limit-range-slider"
                style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', outline: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>
                <span>Min: 2</span>
                <span>Max: 6</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="results-btn secondary" onClick={() => setIsCreatingRoom(false)}>
                Cancel
              </button>
              <button className="results-btn primary" onClick={handleCreateSubmit}>
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
