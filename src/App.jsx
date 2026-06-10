import React, { useState, useEffect, useRef } from 'react';
import Lobby from './components/Lobby';
import Opponents from './components/Opponents';
import Card from './components/Card';
import ColorPicker from './components/ColorPicker';
import ActionOverlay from './components/ActionOverlay';
import Toast from './components/Toast';
import Results from './components/Results';
import ParticlesCanvas from './components/ParticlesCanvas';
import * as signalR from './services/signalr';
import './App.css';

/* ====== CONSTANTS ====== */
const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_HEX = { red: '#ED1C24', blue: '#00AEEF', green: '#00A651', yellow: '#FFF200' };
const ACTIONS = ['skip', 'reverse', 'draw2'];
const WILDS = ['wild', 'wild4'];
const AI_NAMES = ['Luna', 'Max', 'Zara'];
const AI_COLORS = ['#a855f7', '#3b82f6', '#10b981'];

/* ====== HELPER FUNCTIONS ====== */
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

  const [joiningRoomId, setJoiningRoomId] = useState(null);
  const [myRoomId, setMyRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [maxPlayersLimit, setMaxPlayersLimit] = useState(4);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [myPlayerName, setMyPlayerName] = useState('You');
  
  const connectionRef = useRef(null);

  useEffect(() => {
    const savedStateStr = sessionStorage.getItem('uno_game_state');
    const savedRoomId = sessionStorage.getItem('uno_room_id');
    const savedMyPlayerName = sessionStorage.getItem('uno_my_player_name');
    const savedMyPlayerIndex = sessionStorage.getItem('uno_my_player_index');
    const savedIsHost = sessionStorage.getItem('uno_is_host');
    const savedLobbyPlayers = sessionStorage.getItem('uno_lobby_players');
    const savedMaxPlayersLimit = sessionStorage.getItem('uno_max_players_limit');

    if (savedStateStr && savedRoomId && savedMyPlayerName && savedMyPlayerIndex !== null) {
      try {
        const parsedState = JSON.parse(savedStateStr);
        const parsedLobbyPlayers = savedLobbyPlayers ? JSON.parse(savedLobbyPlayers) : [];
        const isHostPlayer = savedIsHost === 'true';
        const playerIdx = Number(savedMyPlayerIndex);
        const limit = Number(savedMaxPlayersLimit) || 4;

        // Re-establish connection
        const conn = new signalR.HubConnectionBuilder().withUrl("/unoHub").build();
        connectionRef.current = conn;

        if (isHostPlayer) {
          conn.on("JoinRoom", (data) => {
            setLobbyPlayers(prev => {
              if (prev.length >= limit) return prev;
              if (prev.some(p => p.name === data.name)) return prev;
              const updated = [...prev, {
                name: data.name,
                color: data.color,
                isHuman: true
              }];
              conn.invoke("RoomInfoUpdate", {
                roomId: savedRoomId,
                lobbyPlayers: updated,
                maxPlayersLimit: limit
              });
              return updated;
            });
          });
        } else {
          conn.on("RoomInfoUpdate", (data) => {
            if (data.roomId === savedRoomId) {
              setLobbyPlayers(data.lobbyPlayers);
              setMaxPlayersLimit(data.maxPlayersLimit);
            }
          });
          conn.on("GameStarted", (payload) => {
            if (payload.roomId === savedRoomId) {
              const idx = payload.players.findIndex(p => p.name === savedMyPlayerName);
              if (idx !== -1) {
                setMyPlayerIndex(idx);
              }
              setGameState({
                phase: 'playing',
                players: payload.players,
                drawPile: payload.drawPile,
                discardPile: payload.discardPile,
                currentColor: payload.currentColor,
                currentPlayer: payload.currentPlayer,
                direction: payload.direction,
                hasDrawnThisTurn: false,
                inputDisabled: false,
                unoCallRequired: false,
                unoCalled: false,
                pendingWild: null,
                soundOn: true
              });
            }
          });
        }

        conn.on("MovePlayed", (data) => {
          if (data.roomId === savedRoomId) {
            applyMoveAction(data.action);
          }
        });

        conn.on("PlayerLeft", (data) => {
          if (data.roomId === savedRoomId) {
            handleOpponentLeft(data.playerIdx, data.playerName);
          }
        });

        conn.start().then(() => {
          showToast('Reconnected to room successfully!', 'success');
        });

        // Set states
        setMyRoomId(savedRoomId);
        setMyPlayerName(savedMyPlayerName);
        setMyPlayerIndex(playerIdx);
        setIsHost(isHostPlayer);
        setLobbyPlayers(parsedLobbyPlayers);
        setMaxPlayersLimit(limit);
        setGameState(parsedState);
        return;
      } catch (err) {
        console.error("Error restoring session:", err);
      }
    }

    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setJoiningRoomId(room);
    }
  }, []);

  // Session Sync Effect
  useEffect(() => {
    if (gameState.phase === 'playing' || gameState.phase === 'gameOver' || gameState.phase === 'results') {
      sessionStorage.setItem('uno_game_state', JSON.stringify(gameState));
      sessionStorage.setItem('uno_room_id', myRoomId || '');
      sessionStorage.setItem('uno_my_player_name', myPlayerName);
      sessionStorage.setItem('uno_my_player_index', String(myPlayerIndex));
      sessionStorage.setItem('uno_is_host', String(isHost));
      sessionStorage.setItem('uno_lobby_players', JSON.stringify(lobbyPlayers));
      sessionStorage.setItem('uno_max_players_limit', String(maxPlayersLimit));
    } else if (gameState.phase === 'lobby') {
      sessionStorage.removeItem('uno_game_state');
      sessionStorage.removeItem('uno_room_id');
      sessionStorage.removeItem('uno_my_player_name');
      sessionStorage.removeItem('uno_my_player_index');
      sessionStorage.removeItem('uno_is_host');
      sessionStorage.removeItem('uno_lobby_players');
      sessionStorage.removeItem('uno_max_players_limit');
    }
  }, [gameState, myRoomId, myPlayerName, myPlayerIndex, isHost, lobbyPlayers, maxPlayersLimit]);

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
    if (gameState.phase === 'playing') {
      const activePlayer = gameState.players[gameState.currentPlayer];
      if (activePlayer && !activePlayer.isHuman) {
        // Only host runs the AI and broadcasts the move
        const isHostTab = !myRoomId || isHost;
        if (isHostTab) {
          const delay = 1000 + Math.random() * 800;
          const timerId = setTimeout(() => {
            executeAiTurn();
          }, delay);
          return () => clearTimeout(timerId);
        }
      }
    }
  }, [gameState.phase, gameState.currentPlayer, isHost, myRoomId]);

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
    if (connectionRef.current) {
      connectionRef.current.stop();
      connectionRef.current = null;
    }
    setMyRoomId(null);
    setJoiningRoomId(null);
    setIsHost(false);
    setMyPlayerIndex(0);
    setMyPlayerName('You');

    const deck = shuffle(createDeck());
    const initialPlayers = [
      { name: 'You', hand: [], isHuman: true, color: '#ff3366' },
      { name: AI_NAMES[0], hand: [], isHuman: false, color: AI_COLORS[0] },
      { name: AI_NAMES[1], hand: [], isHuman: false, color: AI_COLORS[1] },
      { name: AI_NAMES[2], hand: [], isHuman: false, color: AI_COLORS[2] }
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
      hasDrawnThisTurn: false,
      inputDisabled: false,
      unoCallRequired: false,
      unoCalled: false,
      pendingWild: null,
      soundOn: gameState.soundOn
    });
  };

  const sendMove = (action) => {
    if (myRoomId && connectionRef.current) {
      connectionRef.current.invoke("MovePlayed", { roomId: myRoomId, action });
    }
  };

  const applyMoveAction = (action) => {
    switch (action.type) {
      case 'PLAY_CARD':
        executePlayCard(action.playerIdx, action.cardIndex, action.chosenColor);
        break;
      case 'DRAW_CARD':
        executeDrawCard(action.playerIdx);
        break;
      case 'PASS_TURN':
        executePassTurn(action.playerIdx);
        break;
      case 'CALL_UNO':
        executeCallUno(action.playerIdx);
        break;
      case 'DRAW_PENALTY':
        executeDrawPenalty(action.playerIdx);
        break;
      case 'AI_DRAW_AND_PASS':
        applyAiDrawAndPass(action.playerIdx);
        break;
      default:
        break;
    }
  };

  const applyAiDrawAndPass = (playerIdx) => {
    setGameState(prev => {
      let currentDrawPile = [...prev.drawPile];
      let currentDiscardPile = [...prev.discardPile];
      let nextPlayers = prev.players.map((p, idx) => idx === playerIdx ? { ...p, hand: [...p.hand] } : p);

      if (currentDrawPile.length === 0) {
        if (currentDiscardPile.length > 1) {
          const topCard = currentDiscardPile.pop();
          currentDrawPile = shuffle(currentDiscardPile);
          currentDiscardPile = [topCard];
        }
      }
      if (currentDrawPile.length > 0) {
        nextPlayers[playerIdx].hand.push(currentDrawPile.pop());
      }
      playSound('draw');
      const nextP = getNextPlayerIndex(playerIdx, prev.direction, prev.players.length);
      return {
        ...prev,
        players: nextPlayers,
        drawPile: currentDrawPile,
        discardPile: currentDiscardPile,
        currentPlayer: nextP
      };
    });
  };

  const handleOpponentLeft = (leftPlayerIdx, leftPlayerName) => {
    showToast(`${leftPlayerName} left the game! A bot has taken over.`, 'info');
    
    setGameState(prev => {
      if (!prev.players) return prev;
      const nextPlayers = prev.players.map((p, i) => 
        i === leftPlayerIdx ? { ...p, isHuman: false, name: `${p.name} (Bot)` } : p
      );
      
      // Host migration check
      if (leftPlayerIdx === 0) {
        const firstHumanIdx = nextPlayers.findIndex(p => p.isHuman);
        const savedMyIndex = Number(sessionStorage.getItem('uno_my_player_index') || myPlayerIndex);
        if (firstHumanIdx === savedMyIndex) {
          setIsHost(true);
          setTimeout(() => showToast("You are now the host of this room.", "info"), 100);
        }
      }
      
      return {
        ...prev,
        players: nextPlayers
      };
    });
  };

  const startGameMultiplayer = () => {
    const deck = shuffle(createDeck());
    const numPlayers = lobbyPlayers.length;
    const initialPlayers = lobbyPlayers.map(p => ({
      name: p.name,
      hand: [],
      isHuman: true,
      color: p.color
    }));

    // Deal 7 cards to each player
    for (let r = 0; r < 7; r++) {
      for (let p = 0; p < numPlayers; p++) {
        initialPlayers[p].hand.push(deck.pop());
      }
    }

    // Flip first discard card
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

    // Apply action effects for the first card
    if (firstCard.value === 'skip') {
      initialPlayer = getNextPlayerIndex(0, 1, numPlayers);
    } else if (firstCard.value === 'reverse') {
      initialDirection = -1;
    } else if (firstCard.value === 'draw2') {
      initialPlayers[0].hand.push(deck.pop(), deck.pop());
      initialPlayer = getNextPlayerIndex(0, 1, numPlayers);
    }

    const payload = {
      roomId: myRoomId,
      players: initialPlayers,
      drawPile: deck,
      discardPile: initialDiscardPile,
      currentColor: initialColor,
      currentPlayer: initialPlayer,
      direction: initialDirection
    };

    if (connectionRef.current) {
      connectionRef.current.invoke("GameStarted", payload);
    }

    setMyPlayerIndex(0);
    setGameState({
      phase: 'playing',
      players: initialPlayers,
      drawPile: deck,
      discardPile: initialDiscardPile,
      currentColor: initialColor,
      currentPlayer: initialPlayer,
      direction: initialDirection,
      hasDrawnThisTurn: false,
      inputDisabled: false,
      unoCallRequired: false,
      unoCalled: false,
      pendingWild: null,
      soundOn: gameState.soundOn
    });
  };

  const handleCreateRoom = (limit) => {
    const roomCode = Math.floor(10000 + Math.random() * 90000).toString();
    setMyRoomId(roomCode);
    setIsHost(true);
    setMaxPlayersLimit(limit);
    
    // Update browser URL
    window.history.pushState({}, document.title, window.location.pathname + '?room=' + roomCode);
    
    const hostPlayer = {
      name: 'You (Admin)',
      color: '#ff3366',
      isHuman: true
    };
    setLobbyPlayers([hostPlayer]);
    setMyPlayerName('You (Admin)');
    setMyPlayerIndex(0);

    const conn = new signalR.HubConnectionBuilder().withUrl("/unoHub").build();
    connectionRef.current = conn;

    conn.on("JoinRoom", (data) => {
      setLobbyPlayers(prev => {
        if (prev.length >= limit) return prev;
        if (prev.some(p => p.name === data.name)) return prev;
        const updated = [...prev, {
          name: data.name,
          color: data.color,
          isHuman: true
        }];
        
        conn.invoke("RoomInfoUpdate", {
          roomId: roomCode,
          lobbyPlayers: updated,
          maxPlayersLimit: limit
        });
        
        return updated;
      });
    });

    conn.on("MovePlayed", (data) => {
      if (data.roomId === roomCode) {
        applyMoveAction(data.action);
      }
    });

    conn.on("PlayerLeft", (data) => {
      if (data.roomId === roomCode) {
        handleOpponentLeft(data.playerIdx, data.playerName);
      }
    });

    conn.start().then(() => {
      showToast(`Room #${roomCode} created!`, 'success');
    });
  };

  const handleJoinRoom = (playerName) => {
    setMyPlayerName(playerName);

    const conn = new signalR.HubConnectionBuilder().withUrl("/unoHub").build();
    connectionRef.current = conn;

    conn.on("RoomInfoUpdate", (data) => {
      if (data.roomId === joiningRoomId) {
        setLobbyPlayers(data.lobbyPlayers);
        setMaxPlayersLimit(data.maxPlayersLimit);
        setMyRoomId(joiningRoomId);
        
        const idx = data.lobbyPlayers.findIndex(p => p.name === playerName);
        if (idx !== -1) {
          setMyPlayerIndex(idx);
        }
      }
    });

    conn.on("GameStarted", (payload) => {
      if (payload.roomId === joiningRoomId) {
        const idx = payload.players.findIndex(p => p.name === playerName);
        if (idx !== -1) {
          setMyPlayerIndex(idx);
        }
        setGameState({
          phase: 'playing',
          players: payload.players,
          drawPile: payload.drawPile,
          discardPile: payload.discardPile,
          currentColor: payload.currentColor,
          currentPlayer: payload.currentPlayer,
          direction: payload.direction,
          hasDrawnThisTurn: false,
          inputDisabled: false,
          unoCallRequired: false,
          unoCalled: false,
          pendingWild: null,
          soundOn: gameState.soundOn
        });
      }
    });

    conn.on("MovePlayed", (data) => {
      if (data.roomId === joiningRoomId) {
        applyMoveAction(data.action);
      }
    });

    conn.on("PlayerLeft", (data) => {
      if (data.roomId === joiningRoomId) {
        handleOpponentLeft(data.playerIdx, data.playerName);
      }
    });

    conn.start().then(() => {
      const colors = ['#00AEEF', '#00A651', '#FFF200', '#a855f7', '#10b981', '#f59e0b'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      conn.invoke("JoinRoom", {
        roomId: joiningRoomId,
        name: playerName,
        color: randomColor
      });
      
      showToast('Connecting to room...', 'info');
    });
  };

  const handleLeaveRoom = () => {
    if (gameState.phase === 'playing' || gameState.phase === 'gameOver') {
      if (connectionRef.current && myRoomId) {
        connectionRef.current.invoke("PlayerLeft", { roomId: myRoomId, playerIdx: myPlayerIndex, playerName: myPlayerName });
      }
    }
    if (connectionRef.current) {
      connectionRef.current.stop();
      connectionRef.current = null;
    }
    setMyRoomId(null);
    setJoiningRoomId(null);
    setIsHost(false);
    setLobbyPlayers([]);
    setMyPlayerIndex(0);
    setMyPlayerName('You');
    sessionStorage.removeItem('uno_game_state');
    sessionStorage.removeItem('uno_room_id');
    sessionStorage.removeItem('uno_my_player_name');
    sessionStorage.removeItem('uno_my_player_index');
    sessionStorage.removeItem('uno_is_host');
    sessionStorage.removeItem('uno_lobby_players');
    sessionStorage.removeItem('uno_max_players_limit');
    window.history.pushState({}, document.title, window.location.pathname);
  };

  const executeDrawCard = (playerIdx) => {
    setGameState(prev => {
      let currentDrawPile = [...prev.drawPile];
      let currentDiscardPile = [...prev.discardPile];
      let nextPlayers = prev.players.map((p, idx) => idx === playerIdx ? { ...p, hand: [...p.hand] } : p);

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
      nextPlayers[playerIdx].hand.push(drawnCard);
      playSound('draw');
      
      if (playerIdx === myPlayerIndex) {
        showToast(`Drew a card: ${drawnCard.color} ${drawnCard.value}`, 'info');
      } else {
        showToast(`${prev.players[playerIdx]?.name || 'Player'} drew a card`, 'info');
      }

      const topCard = currentDiscardPile[currentDiscardPile.length - 1];
      const isPlayable = canPlay(drawnCard, prev.currentColor, topCard);

      if (!isPlayable) {
        // Automatically pass after 1.5s
        setTimeout(() => {
          setGameState(latest => {
            const nextP = getNextPlayerIndex(latest.currentPlayer, latest.direction, latest.players.length);
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

  const executePassTurn = (playerIdx) => {
    setGameState(prev => {
      const nextP = getNextPlayerIndex(prev.currentPlayer, prev.direction, prev.players.length);
      return {
        ...prev,
        currentPlayer: nextP,
        hasDrawnThisTurn: false,
        inputDisabled: false
      };
    });
  };

  const executeCallUno = (playerIdx) => {
    setGameState(prev => ({
      ...prev,
      unoCalled: true,
      unoCallRequired: false
    }));
    const playerName = prev.players[playerIdx]?.name || 'Player';
    showToast(`${playerIdx === myPlayerIndex ? 'You' : playerName} called UNO!`, 'success');
    playSound('uno');
    if (window.spawnBurstParticles) {
      window.spawnBurstParticles(window.innerWidth / 2, window.innerHeight * 0.6, '#FFD700', 25);
    }
  };

  const executeDrawPenalty = (playerIdx) => {
    setGameState(prev => {
      let drawPileCopy = [...prev.drawPile];
      let discardPileCopy = [...prev.discardPile];
      let playersCopy = prev.players.map((p, idx) => idx === playerIdx ? { ...p, hand: [...p.hand] } : p);
      const drawRes = drawCardsHelper(playerIdx, 2, playersCopy, drawPileCopy, discardPileCopy);
      return {
        ...prev,
        players: drawRes.players,
        drawPile: drawRes.drawPile,
        discardPile: drawRes.discardPile,
        unoCallRequired: false
      };
    });
  };

  const handleDrawClick = () => {
    if (gameState.currentPlayer !== myPlayerIndex || gameState.phase !== 'playing' || gameState.inputDisabled) return;
    if (gameState.hasDrawnThisTurn) {
      showToast('You can only draw once per turn!', 'warn');
      return;
    }
    executeDrawCard(myPlayerIndex);
    sendMove({ type: 'DRAW_CARD', playerIdx: myPlayerIndex });
  };

  const handlePassClick = () => {
    if (gameState.currentPlayer !== myPlayerIndex || gameState.phase !== 'playing' || gameState.inputDisabled || !gameState.hasDrawnThisTurn) return;
    executePassTurn(myPlayerIndex);
    sendMove({ type: 'PASS_TURN', playerIdx: myPlayerIndex });
  };

  const canPlayAny = (hand, activeColor, topCard) => {
    return hand.some(c => canPlay(c, activeColor, topCard));
  };

  const handleCardClick = (index) => {
    if (gameState.currentPlayer !== myPlayerIndex || gameState.phase !== 'playing' || gameState.inputDisabled) return;
    const card = gameState.players[myPlayerIndex].hand[index];
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
    executePlayCard(myPlayerIndex, index);
    sendMove({ type: 'PLAY_CARD', playerIdx: myPlayerIndex, cardIndex: index });
  };

  const handlePickColor = (color) => {
    if (gameState.pendingWild !== null) {
      const idx = gameState.pendingWild;
      setGameState(prev => ({ ...prev, pendingWild: null }));
      executePlayCard(myPlayerIndex, idx, color);
      sendMove({ type: 'PLAY_CARD', playerIdx: myPlayerIndex, cardIndex: idx, chosenColor: color });
    }
  };

  const callUno = () => {
    if (gameState.unoCallRequired && gameState.currentPlayer === myPlayerIndex) {
      executeCallUno(myPlayerIndex);
      sendMove({ type: 'CALL_UNO', playerIdx: myPlayerIndex });
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

      let nextPlayers = prev.players.map((p, idx) => idx === playerIdx ? { ...p, hand } : p);

      // Check UNO
      if (hand.length === 1) {
        if (playerIdx === myPlayerIndex) {
          setTimeout(() => {
            setGameState(latest => {
              if (latest.unoCallRequired && !latest.unoCalled) {
                showToast('Forgot to call UNO! Draw 2 cards', 'warn');
                executeDrawPenalty(playerIdx);
                sendMove({ type: 'DRAW_PENALTY', playerIdx });
              }
              return latest;
            });
          }, 3000);
        } else if (!player.isHuman) {
          setTimeout(() => showToast(`${player.name} calls UNO!`, 'info'), 500);
        }
      }

      // Check Win
      if (hand.length === 0) {
        setTimeout(() => triggerEndGame(playerIdx, nextPlayers), 800);
        return {
          ...prev,
          phase: 'gameOver',
          players: nextPlayers,
          discardPile: updatedDiscardPile,
          currentColor: nextColor
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
        const nextPIndex = getNextPlayerIndex(playerIdx, card.value === 'reverse' ? -prev.direction : prev.direction, prev.players.length);
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
        const nextPIndex = getNextPlayerIndex(playerIdx, prev.direction, prev.players.length);
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
      let nextP = getNextPlayerIndex(playerIdx, nextDirection, prev.players.length);
      if (skipNext) {
        nextP = getNextPlayerIndex(nextP, nextDirection, prev.players.length);
      }

      return {
        ...prev,
        players: nextPlayers,
        drawPile: updatedDrawPile,
        discardPile: updatedDiscardPile,
        currentColor: nextColor,
        currentPlayer: nextP,
        direction: nextDirection,
        hasDrawnThisTurn: false,
        inputDisabled: false,
        unoCallRequired: hand.length === 1 && playerIdx === myPlayerIndex,
        unoCalled: false
      };
    });
  };

  const triggerEndGame = (winnerIdx, finalPlayers) => {
    const isHumanWin = winnerIdx === myPlayerIndex;

    const rewardCoins = isHumanWin ? 150 : 30;
    setCoins(prev => prev + rewardCoins);

    setGameState(prev => ({
      ...prev,
      phase: 'results',
      players: finalPlayers
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
          const nextP = getNextPlayerIndex(pi, prev.direction, prev.players.length);
          if (myRoomId) {
            sendMove({ type: 'AI_DRAW_AND_PASS', playerIdx: pi });
          }
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
            if (myRoomId) {
              sendMove({ type: 'PLAY_CARD', playerIdx: pi, cardIndex: nextPlayers[pi].hand.length - 1, chosenColor });
            }
          }, 600);
        } else {
          setTimeout(() => {
            setGameState(latest => {
              const nextP = getNextPlayerIndex(latest.currentPlayer, latest.direction, latest.players.length);
              if (myRoomId) {
                sendMove({ type: 'AI_DRAW_AND_PASS', playerIdx: pi });
              }
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
      if (myRoomId) {
        sendMove({ type: 'PLAY_CARD', playerIdx: pi, cardIndex: chosen.index, chosenColor });
      }
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
  const humanHand = gameState.players[myPlayerIndex]?.hand || [];
  const topDiscardCard = gameState.discardPile[gameState.discardPile.length - 1];
  const isMyTurn = gameState.currentPlayer === myPlayerIndex && gameState.phase === 'playing';

  return (
    <>
      {gameState.phase === 'lobby' && (
        <Lobby
          onStartGame={startGame}
          coins={coins}
          gems={gems}
          onAddCoins={addCoins}
          showToast={showToast}
          myRoomId={myRoomId}
          isHost={isHost}
          lobbyPlayers={lobbyPlayers}
          maxPlayersLimit={maxPlayersLimit}
          joiningRoomId={joiningRoomId}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          onStartMultiplayerGame={startGameMultiplayer}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {(gameState.phase === 'playing' || gameState.phase === 'gameOver') && (
        <div id="game" className="screen">
          <div className="game-table">
            <div className="game-top">
              <button className="game-exit" onClick={myRoomId ? handleLeaveRoom : exitGame} aria-label="Exit game">
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

            <Opponents players={gameState.players} currentPlayer={gameState.currentPlayer} myPlayerIndex={myPlayerIndex} />

            <div className="center-area">
              <div className="pile">
                <div className="draw-pile" id="drawPile" onClick={handleDrawClick} aria-label="Draw card">
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
                  <div className="your-avatar" style={{ backgroundColor: gameState.players[myPlayerIndex]?.color || 'var(--accent)' }}>
                    {myPlayerName[0]}
                  </div>
                  <span className="your-name">{myPlayerName}</span>
                  <span className="your-cards-count" id="yourCardCount">
                    {humanHand.length} card{humanHand.length !== 1 ? 's' : ''}
                  </span>
                  {gameState.hasDrawnThisTurn && isMyTurn && canPlayAny(humanHand, gameState.currentColor, topDiscardCard) && (
                    <button 
                      className="daily-claim" 
                      style={{ padding: '4px 10px', background: 'var(--accent)', color: '#fff', fontSize: '11px', marginLeft: '10px', height: 'auto', border: 'none', borderRadius: '12px' }}
                      onClick={handlePassClick}
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
          onPlayAgain={myRoomId ? (isHost ? startGameMultiplayer : () => showToast('Waiting for host to restart...', 'info')) : startGame}
          myPlayerIndex={myPlayerIndex}
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
