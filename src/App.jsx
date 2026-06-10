import React, { useState, useEffect, useRef } from 'react';
import Lobby from './components/Lobby';
import Opponents from './components/Opponents';
import Card from './components/Card';
import ColorPicker from './components/ColorPicker';
import ActionOverlay from './components/ActionOverlay';
import Toast from './components/Toast';
import Results from './components/Results';
import ParticlesCanvas from './components/ParticlesCanvas';
import './App.css';

/* ====== CONSTANTS ====== */
const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_HEX = { red: '#ED1C24', blue: '#00AEEF', green: '#00A651', yellow: '#FFF200' };
const ACTIONS = ['skip', 'reverse', 'draw2'];
const WILDS = ['wild', 'wild4'];
const AI_NAMES = ['Luna', 'Max', 'Zara'];
const AI_COLORS = ['#a855f7', '#3b82f6', '#10b981'];

/* ====== HELPER FUNCTIONS ====== */
const cardPoints = (card) => {
  if (card.value === 'wild' || card.value === 'wild4') return 50;
  if (ACTIONS.includes(card.value)) return 20;
  return parseInt(card.value) || 0;
};

const getNextPlayerIndex = (current, dir, numPlayers = 4) => {
  let next = current + dir;
  if (next >= numPlayers) next = 0;
  if (next < 0) next = numPlayers - 1;
  return next;
};

const createDeck = () => {
  let cardId = 0;
  const deck = [];
  for (const c of COLORS) {
    deck.push({ id: cardId++, color: c, value: '0' });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: cardId++, color: c, value: String(n) });
      deck.push({ id: cardId++, color: c, value: String(n) });
    }
    for (const a of ACTIONS) {
      deck.push({ id: cardId++, color: c, value: a });
      deck.push({ id: cardId++, color: c, value: a });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: cardId++, color: 'wild', value: 'wild' });
    deck.push({ id: cardId++, color: 'wild', value: 'wild4' });
  }
  return deck;
};

const shuffle = (arr) => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const canPlay = (card, activeColor, topCard) => {
  if (!topCard) return false;
  if (card.color === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
};

const drawCardsHelper = (playerIdx, count, currentPlayers, currentDrawPile, currentDiscardPile) => {
  const playersCopy = currentPlayers.map((p, idx) => idx === playerIdx ? { ...p, hand: [...p.hand] } : p);
  const drawPileCopy = [...currentDrawPile];
  let discardPileCopy = [...currentDiscardPile];

  for (let i = 0; i < count; i++) {
    if (drawPileCopy.length === 0) {
      if (discardPileCopy.length <= 1) break;
      const topCard = discardPileCopy.pop();
      const reshuffled = shuffle(discardPileCopy);
      drawPileCopy.push(...reshuffled);
      discardPileCopy = [topCard];
    }
    if (drawPileCopy.length > 0) {
      playersCopy[playerIdx].hand.push(drawPileCopy.pop());
    }
  }
  return { players: playersCopy, drawPile: drawPileCopy, discardPile: discardPileCopy };
};

export default function App() {
  const [coins, setCoins] = useState(2450);
  const [gems, setGems] = useState(38);

  const addCoins = (amount) => {
    setCoins(prev => prev + amount);
  };

  const [gameState, setGameState] = useState({
    phase: 'lobby',
    players: [],
    drawPile: [],
    discardPile: [],
    currentColor: '',
    currentPlayer: 0,
    direction: 1,
    roundScore: 0,
    hasDrawnThisTurn: false,
    inputDisabled: false,
    unoCallRequired: false,
    unoCalled: false,
    pendingWild: null,
    soundOn: true
  });

  const [timer, setTimer] = useState(0);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const [actionOverlay, setActionOverlay] = useState({ text: '', color: '', visible: false });

  const toastTimeoutRef = useRef(null);
  const actionOverlayTimeoutRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gameStateRef = useRef(gameState);
  const handContainerRef = useRef(null);

  // Sync gameState to ref to avoid stale state in AI loops
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Round Timer effect
  useEffect(() => {
    let interval = null;
    if (gameState.phase === 'playing') {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState.phase]);

  // AI Turn schedule effect
  useEffect(() => {
    if (gameState.phase === 'playing' && gameState.currentPlayer !== 0) {
      const delay = 1000 + Math.random() * 800;
      const timerId = setTimeout(() => {
        executeAiTurn();
      }, delay);
      return () => clearTimeout(timerId);
    }
  }, [gameState.phase, gameState.currentPlayer]);

  // Scroll player hand container to right when cards count change
  useEffect(() => {
    if (gameState.phase === 'playing' && handContainerRef.current) {
      const container = handContainerRef.current;
      container.scrollLeft = container.scrollWidth;
    }
  }, [gameState.players[0]?.hand?.length, gameState.phase]);

  // Play sound controller
  const playSound = (type) => {
    if (!gameState.soundOn) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.1;
      const t = ctx.currentTime;
      switch (type) {
        case 'draw':
          osc.frequency.value = 300;
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.start(t);
          osc.stop(t + 0.15);
          break;
        case 'skip':
          osc.frequency.value = 500;
          osc.type = 'square';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
          break;
        case 'reverse':
          osc.frequency.setValueAtTime(400, t);
          osc.frequency.linearRampToValueAtTime(600, t + 0.2);
          osc.type = 'sawtooth';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          osc.start(t);
          osc.stop(t + 0.25);
          break;
        case 'draw2':
          osc.frequency.value = 350;
          osc.type = 'triangle';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
          break;
        case 'wild4':
          osc.frequency.setValueAtTime(200, t);
          osc.frequency.linearRampToValueAtTime(800, t + 0.3);
          osc.type = 'sawtooth';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.start(t);
          osc.stop(t + 0.35);
          break;
        case 'wild':
          osc.frequency.setValueAtTime(400, t);
          osc.frequency.linearRampToValueAtTime(700, t + 0.15);
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t);
          osc.stop(t + 0.2);
          break;
        case 'uno':
          osc.frequency.setValueAtTime(523, t);
          osc.frequency.setValueAtTime(659, t + 0.1);
          osc.frequency.setValueAtTime(784, t + 0.2);
          osc.type = 'square';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.start(t);
          osc.stop(t + 0.35);
          break;
        default:
          osc.frequency.value = 440;
          osc.type = 'sine';
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
      }
    } catch (e) {
      console.warn('Audio Context resume/play issue:', e);
    }
  };

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, visible: true });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  };

  const showActionOverlay = (text, color) => {
    if (actionOverlayTimeoutRef.current) clearTimeout(actionOverlayTimeoutRef.current);
    setActionOverlay({ text, color, visible: true });
    actionOverlayTimeoutRef.current = setTimeout(() => {
      setActionOverlay(prev => ({ ...prev, visible: false }));
    }, 900);
  };

  const toggleSound = () => {
    setGameState(prev => ({ ...prev, soundOn: !prev.soundOn }));
  };

  const goLobby = () => {
    setGameState(prev => ({ ...prev, phase: 'lobby' }));
  };

  const exitGame = () => {
    goLobby();
  };

  const startGame = () => {
    const deck = shuffle(createDeck());
    const prevPlayers = gameState.players;
    const initialPlayers = [
      { name: 'You', hand: [], isHuman: true, color: '#ff3366', score: prevPlayers.length > 0 ? prevPlayers[0].score : 0 },
      { name: AI_NAMES[0], hand: [], isHuman: false, color: AI_COLORS[0], score: prevPlayers.length > 0 ? prevPlayers[1].score : 0 },
      { name: AI_NAMES[1], hand: [], isHuman: false, color: AI_COLORS[1], score: prevPlayers.length > 0 ? prevPlayers[2].score : 0 },
      { name: AI_NAMES[2], hand: [], isHuman: false, color: AI_COLORS[2], score: prevPlayers.length > 0 ? prevPlayers[3].score : 0 }
    ];

    // Deal 7 cards
    for (let r = 0; r < 7; r++) {
      for (let p = 0; p < 4; p++) {
        initialPlayers[p].hand.push(deck.pop());
      }
    }

    // Flip first discard card (non-wild4)
    let firstCard;
    do {
      firstCard = deck.pop();
      if (firstCard.value === 'wild4') {
        deck.unshift(firstCard);
        firstCard = null;
      }
    } while (!firstCard);

    const initialDiscardPile = [firstCard];
    const initialColor = firstCard.color === 'wild' ? COLORS[Math.floor(Math.random() * 4)] : firstCard.color;

    let initialPlayer = 0;
    let initialDirection = 1;

    // Apply first card action effects
    if (firstCard.value === 'skip') {
      initialPlayer = 1;
    } else if (firstCard.value === 'reverse') {
      initialDirection = -1;
    } else if (firstCard.value === 'draw2') {
      initialPlayers[0].hand.push(deck.pop(), deck.pop());
      initialPlayer = 1;
    }

    setGameState({
      phase: 'playing',
      players: initialPlayers,
      drawPile: deck,
      discardPile: initialDiscardPile,
      currentColor: initialColor,
      currentPlayer: initialPlayer,
      direction: initialDirection,
      roundScore: 0,
      hasDrawnThisTurn: false,
      inputDisabled: false,
      unoCallRequired: false,
      unoCalled: false,
      pendingWild: null,
      soundOn: gameState.soundOn
    });
  };

  const canPlayAny = (hand, activeColor, topCard) => {
    return hand.some(c => canPlay(c, activeColor, topCard));
  };

  const humanDraw = () => {
    if (gameState.currentPlayer !== 0 || gameState.phase !== 'playing' || gameState.inputDisabled) return;
    if (gameState.hasDrawnThisTurn) {
      showToast('You can only draw once per turn!', 'warn');
      return;
    }

    setGameState(prev => {
      let currentDrawPile = [...prev.drawPile];
      let currentDiscardPile = [...prev.discardPile];
      let nextPlayers = prev.players.map((p, idx) => idx === 0 ? { ...p, hand: [...p.hand] } : p);

      if (currentDrawPile.length === 0) {
        if (currentDiscardPile.length > 1) {
          const topCard = currentDiscardPile.pop();
          currentDrawPile = shuffle(currentDiscardPile);
          currentDiscardPile = [topCard];
        }
      }

      if (currentDrawPile.length === 0) {
        showToast('No cards left in the draw pile!', 'warn');
        return prev;
      }

      const drawnCard = currentDrawPile.pop();
      nextPlayers[0].hand.push(drawnCard);
      playSound('draw');
      showToast(`Drew a card: ${drawnCard.color} ${drawnCard.value}`, 'info');

      const topCard = currentDiscardPile[currentDiscardPile.length - 1];
      const isPlayable = canPlay(drawnCard, prev.currentColor, topCard);

      if (!isPlayable) {
        // Automatically pass after 1.5s
        setTimeout(() => {
          setGameState(latest => {
            showToast('Card not playable. Passing turn...', 'info');
            const nextP = getNextPlayerIndex(latest.currentPlayer, latest.direction);
            return {
              ...latest,
              currentPlayer: nextP,
              hasDrawnThisTurn: false,
              inputDisabled: false
            };
          });
        }, 1500);

        return {
          ...prev,
          players: nextPlayers,
          drawPile: currentDrawPile,
          discardPile: currentDiscardPile,
          hasDrawnThisTurn: true,
          inputDisabled: true
        };
      } else {
        // User has a playable drawn card. They can play it or click Pass Turn.
        return {
          ...prev,
          players: nextPlayers,
          drawPile: currentDrawPile,
          discardPile: currentDiscardPile,
          hasDrawnThisTurn: true,
          inputDisabled: false
        };
      }
    });
  };

  const humanPass = () => {
    if (gameState.currentPlayer !== 0 || gameState.phase !== 'playing' || gameState.inputDisabled || !gameState.hasDrawnThisTurn) return;
    setGameState(prev => {
      const nextP = getNextPlayerIndex(prev.currentPlayer, prev.direction);
      return {
        ...prev,
        currentPlayer: nextP,
        hasDrawnThisTurn: false,
        inputDisabled: false
      };
    });
  };

  const handleCardClick = (index) => {
    if (gameState.currentPlayer !== 0 || gameState.phase !== 'playing' || gameState.inputDisabled) return;
    const card = gameState.players[0].hand[index];
    if (!card) return;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (!canPlay(card, gameState.currentColor, topCard)) {
      showToast('Cannot play this card', 'warn');
      return;
    }

    if (card.color === 'wild') {
      setGameState(prev => ({ ...prev, pendingWild: index }));
      return;
    }
    executePlayCard(0, index);
  };

  const handlePickColor = (color) => {
    if (gameState.pendingWild !== null) {
      const idx = gameState.pendingWild;
      setGameState(prev => ({ ...prev, pendingWild: null }));
      executePlayCard(0, idx, color);
    }
  };

  const callUno = () => {
    if (gameState.unoCallRequired) {
      setGameState(prev => ({
        ...prev,
        unoCalled: true,
        unoCallRequired: false
      }));
      showToast('UNO!', 'success');
      playSound('uno');
      if (window.spawnBurstParticles) {
        window.spawnBurstParticles(window.innerWidth / 2, window.innerHeight * 0.6, '#FFD700', 25);
      }
    }
  };

  const executePlayCard = (playerIdx, cardIndex, chosenColor = null) => {
    setGameState(prev => {
      const player = prev.players[playerIdx];
      if (!player) return prev;
      const hand = [...player.hand];
      const card = hand[cardIndex];
      if (!card) return prev;

      // Remove card
      hand.splice(cardIndex, 1);

      let updatedDrawPile = [...prev.drawPile];
      let updatedDiscardPile = [...prev.discardPile];
      updatedDiscardPile.push(card);

      let nextColor = prev.currentColor;
      if (card.color === 'wild') {
        nextColor = chosenColor || 'red';
      } else {
        nextColor = card.color;
      }

      const pts = cardPoints(card);
      const nextRoundScore = prev.roundScore + pts;
      let nextPlayers = prev.players.map((p, idx) => idx === playerIdx ? { ...p, hand } : p);

      // Check UNO
      if (hand.length === 1) {
        if (player.isHuman) {
          setTimeout(() => {
            setGameState(latest => {
              if (latest.unoCallRequired && !latest.unoCalled) {
                showToast('Forgot to call UNO! Draw 2 cards', 'warn');
                let drawPileCopy = [...latest.drawPile];
                let discardPileCopy = [...latest.discardPile];
                let playersCopy = latest.players.map((p, idx) => idx === 0 ? { ...p, hand: [...p.hand] } : p);

                const drawRes = drawCardsHelper(0, 2, playersCopy, drawPileCopy, discardPileCopy);
                return {
                  ...latest,
                  players: drawRes.players,
                  drawPile: drawRes.drawPile,
                  discardPile: drawRes.discardPile,
                  unoCallRequired: false
                };
              }
              return latest;
            });
          }, 3000);
        } else {
          setTimeout(() => showToast(`${player.name} calls UNO!`, 'info'), 500);
        }
      }

      // Check Win
      if (hand.length === 0) {
        setTimeout(() => triggerEndGame(playerIdx, nextPlayers, nextRoundScore), 800);
        return {
          ...prev,
          phase: 'gameOver',
          players: nextPlayers,
          discardPile: updatedDiscardPile,
          currentColor: nextColor,
          roundScore: nextRoundScore
        };
      }

      // Card action logic
      let skipNext = false;
      let nextDirection = prev.direction;

      if (card.value === 'skip') {
        skipNext = true;
        showActionOverlay('SKIP!', '#ED1C24');
      } else if (card.value === 'reverse') {
        nextDirection = -prev.direction;
        showActionOverlay('REVERSE!', '#a855f7');
      } else if (card.value === 'draw2') {
        skipNext = true;
        const nextPIndex = getNextPlayerIndex(playerIdx, card.value === 'reverse' ? -prev.direction : prev.direction);
        const drawRes = drawCardsHelper(nextPIndex, 2, nextPlayers, updatedDrawPile, updatedDiscardPile);
        nextPlayers = drawRes.players;
        updatedDrawPile = drawRes.drawPile;
        updatedDiscardPile = drawRes.discardPile;

        showActionOverlay('+2!', COLOR_HEX[card.color] || '#ED1C24');
        if (window.spawnBurstParticles) {
          window.spawnBurstParticles(window.innerWidth / 2, window.innerHeight / 2, COLOR_HEX[card.color] || '#ED1C24', 20);
        }
      } else if (card.value === 'wild4') {
        skipNext = true;
        const nextPIndex = getNextPlayerIndex(playerIdx, prev.direction);
        const drawRes = drawCardsHelper(nextPIndex, 4, nextPlayers, updatedDrawPile, updatedDiscardPile);
        nextPlayers = drawRes.players;
        updatedDrawPile = drawRes.drawPile;
        updatedDiscardPile = drawRes.discardPile;

        showActionOverlay('+4!', '#333');
        if (window.spawnBurstParticles) {
          window.spawnBurstParticles(window.innerWidth / 2, window.innerHeight / 2, COLOR_HEX[nextColor], 30);
        }
        const gameEl = document.getElementById('game');
        if (gameEl) {
          gameEl.classList.add('shake');
          setTimeout(() => gameEl.classList.remove('shake'), 400);
        }
      } else if (card.value === 'wild') {
        showActionOverlay('WILD!', '#a855f7');
        if (window.spawnBurstParticles) {
          window.spawnBurstParticles(window.innerWidth / 2, window.innerHeight / 2, COLOR_HEX[nextColor], 15);
        }
      }

      playSound(card.value);

      // Advance turn
      let nextP = getNextPlayerIndex(playerIdx, nextDirection);
      if (skipNext) {
        nextP = getNextPlayerIndex(nextP, nextDirection);
      }

      return {
        ...prev,
        players: nextPlayers,
        drawPile: updatedDrawPile,
        discardPile: updatedDiscardPile,
        currentColor: nextColor,
        currentPlayer: nextP,
        direction: nextDirection,
        roundScore: nextRoundScore,
        hasDrawnThisTurn: false,
        inputDisabled: false,
        unoCallRequired: hand.length === 1 && playerIdx === 0,
        unoCalled: false
      };
    });
  };

  const triggerEndGame = (winnerIdx, finalPlayers, finalRoundScore) => {
    const isHumanWin = winnerIdx === 0;

    const updatedPlayers = finalPlayers.map((p, i) => {
      let pts = 0;
      p.hand.forEach(c => {
        pts += cardPoints(c);
      });
      const change = (i === winnerIdx) ? finalRoundScore : -pts;
      return { ...p, score: p.score + change };
    });

    const rewardCoins = isHumanWin ? 150 : 30;
    setCoins(prev => prev + rewardCoins);

    setGameState(prev => ({
      ...prev,
      phase: 'results',
      players: updatedPlayers
    }));

    if (isHumanWin && window.spawnConfetti) {
      window.spawnConfetti();
    }
  };

  const executeAiTurn = () => {
    const latestState = gameStateRef.current;
    if (latestState.phase !== 'playing') return;

    const pi = latestState.currentPlayer;
    const player = latestState.players[pi];
    if (!player || player.isHuman) return;

    const topCard = latestState.discardPile[latestState.discardPile.length - 1];
    const playable = player.hand.map((card, idx) => ({ card, index: idx }))
      .filter(({ card }) => canPlay(card, latestState.currentColor, topCard));

    if (playable.length === 0) {
      // AI draws card
      setGameState(prev => {
        let currentDrawPile = [...prev.drawPile];
        let currentDiscardPile = [...prev.discardPile];
        let nextPlayers = prev.players.map((p, idx) => idx === pi ? { ...p, hand: [...p.hand] } : p);

        if (currentDrawPile.length === 0) {
          if (currentDiscardPile.length > 1) {
            const topCard = currentDiscardPile.pop();
            currentDrawPile = shuffle(currentDiscardPile);
            currentDiscardPile = [topCard];
          }
        }

        if (currentDrawPile.length === 0) {
          const nextP = getNextPlayerIndex(pi, prev.direction);
          return {
            ...prev,
            currentPlayer: nextP
          };
        }

        const drawnCard = currentDrawPile.pop();
        nextPlayers[pi].hand.push(drawnCard);
        playSound('draw');

        const isPlayable = canPlay(drawnCard, prev.currentColor, currentDiscardPile[currentDiscardPile.length - 1]);

        if (isPlayable) {
          setTimeout(() => {
            const chosenColor = drawnCard.color === 'wild' ? aiChooseColor(pi, nextPlayers) : null;
            executePlayCard(pi, nextPlayers[pi].hand.length - 1, chosenColor);
          }, 600);
        } else {
          setTimeout(() => {
            setGameState(latest => {
              const nextP = getNextPlayerIndex(latest.currentPlayer, latest.direction);
              return {
                ...latest,
                currentPlayer: nextP
              };
            });
          }, 1000);
        }

        return {
          ...prev,
          players: nextPlayers,
          drawPile: currentDrawPile,
          discardPile: currentDiscardPile
        };
      });
    } else {
      // Sort and play
      playable.sort((a, b) => {
        const aIsWild = a.card.color === 'wild' ? 0 : 1;
        const bIsWild = b.card.color === 'wild' ? 0 : 1;
        if (aIsWild !== bIsWild) return aIsWild - bIsWild;
        const aIsAction = ACTIONS.includes(a.card.value) ? 1 : 0;
        const bIsAction = ACTIONS.includes(b.card.value) ? 1 : 0;
        return bIsAction - aIsAction;
      });

      const chosen = playable[0];
      const chosenColor = chosen.card.color === 'wild' ? aiChooseColor(pi, latestState.players) : null;
      executePlayCard(pi, chosen.index, chosenColor);
    }
  };

  const aiChooseColor = (pi, playersList) => {
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    playersList[pi].hand.forEach(c => {
      if (counts[c.color] !== undefined) counts[c.color]++;
    });
    let best = 'red', max = 0;
    for (const c of COLORS) {
      if (counts[c] > max) {
        max = counts[c];
        best = c;
      }
    }
    return best;
  };

  const formatTimer = (time) => {
    const m = Math.floor(time / 60);
    const s = time % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Human hand list
  const humanHand = gameState.players[0]?.hand || [];
  const topDiscardCard = gameState.discardPile[gameState.discardPile.length - 1];
  const isMyTurn = gameState.currentPlayer === 0 && gameState.phase === 'playing';

  return (
    <>
      {gameState.phase === 'lobby' && (
        <Lobby
          onStartGame={startGame}
          coins={coins}
          gems={gems}
          onAddCoins={addCoins}
          showToast={showToast}
        />
      )}

      {(gameState.phase === 'playing' || gameState.phase === 'gameOver') && (
        <div id="game" className="screen">
          <div className="game-table">
            <div className="game-top">
              <button className="game-exit" onClick={exitGame} aria-label="Exit game">
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className={`direction-indicator ${gameState.direction === -1 ? 'ccw' : ''}`} id="dirIndicator">
                <i className="fas fa-redo"></i>
              </div>
              <div className="game-info">
                <div className="game-timer" id="gameTimer">
                  {formatTimer(timer)}
                </div>
                <button
                  className="game-exit"
                  onClick={toggleSound}
                  aria-label="Toggle sound"
                  id="soundBtn"
                >
                  <i className={`fas ${gameState.soundOn ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                </button>
              </div>
            </div>

            <Opponents players={gameState.players} currentPlayer={gameState.currentPlayer} />

            <div className="center-area">
              <div className="pile">
                <div className="draw-pile" id="drawPile" onClick={humanDraw} aria-label="Draw card">
                  <div className="card card-back lg">
                    <div className="card-inner">
                      <div className="card-back-pattern">UNO</div>
                    </div>
                  </div>
                  <div className="draw-count" id="drawCount">
                    {gameState.drawPile.length}
                  </div>
                </div>
                <div className="pile-label">DRAW</div>
              </div>
              <div className="pile">
                <div className="discard-pile" id="discardPile">
                  {topDiscardCard && <Card card={topDiscardCard} faceUp={true} extraClass="lg" />}
                  <div
                    className="color-indicator"
                    style={{
                      background: COLOR_HEX[gameState.currentColor] || '#888',
                      color: COLOR_HEX[gameState.currentColor] || '#888'
                    }}
                  />
                </div>
                <div className="pile-label">DISCARD</div>
              </div>
            </div>

            <div className="player-area">
              <div className="player-status">
                <div className="player-status-left">
                  <div className="your-avatar">Y</div>
                  <span className="your-name">You</span>
                  <span className="your-cards-count" id="yourCardCount">
                    {humanHand.length} card{humanHand.length !== 1 ? 's' : ''}
                  </span>
                  {gameState.hasDrawnThisTurn && isMyTurn && canPlayAny(humanHand, gameState.currentColor, topDiscardCard) && (
                    <button 
                      className="daily-claim" 
                      style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', fontSize: '11px', marginLeft: '10px', height: 'auto', border: 'none', borderRadius: '12px' }}
                      onClick={humanPass}
                    >
                      PASS
                    </button>
                  )}
                </div>
                <div className={`turn-indicator ${isMyTurn ? 'your-turn' : ''}`} id="turnIndicator">
                  {isMyTurn ? 'YOUR TURN' : `${gameState.players[gameState.currentPlayer]?.name || ''}'s TURN`}
                </div>
              </div>
              <div className="hand-container" ref={handContainerRef} id="handContainer">
                {humanHand.map((card, i) => {
                  const playable = isMyTurn && canPlay(card, gameState.currentColor, topDiscardCard);
                  const cls = `hand-card ${isMyTurn ? (playable ? 'playable' : 'not-playable') : ''}`;
                  return (
                    <div
                      key={card.id}
                      className={cls}
                      onClick={() => handleCardClick(i)}
                    >
                      <Card card={card} faceUp={true} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            className={`uno-btn ${gameState.unoCallRequired ? 'visible' : ''}`}
            id="unoBtn"
            onClick={callUno}
          >
            UNO!
          </button>
        </div>
      )}

      {gameState.phase === 'results' && (
        <Results
          players={gameState.players}
          winnerIdx={gameState.players.findIndex(p => p.hand.length === 0)}
          onGoLobby={goLobby}
          onPlayAgain={startGame}
        />
      )}

      <ColorPicker
        visible={gameState.pendingWild !== null}
        onPickColor={handlePickColor}
      />

      <ActionOverlay
        text={actionOverlay.text}
        color={actionOverlay.color}
        visible={actionOverlay.visible}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
      />

      <ParticlesCanvas />
    </>
  );
}
