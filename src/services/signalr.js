const serializeCard = (card) => {
  if (!card) return null;
  return [card.id, card.color[0], card.value];
};

const deserializeCard = (arr) => {
  if (!arr) return null;
  const [id, colorCode, value] = arr;
  const colorMap = { r: 'red', b: 'blue', g: 'green', y: 'yellow', w: 'wild' };
  const color = colorMap[colorCode] || colorCode;
  return { id, color, value };
};

const serializeGamePayload = (p) => {
  if (!p) return null;
  return {
    ...p,
    players: p.players.map(pl => ({
      ...pl,
      hand: pl.hand.map(serializeCard)
    })),
    drawPile: p.drawPile.map(serializeCard),
    discardPile: p.discardPile.map(serializeCard)
  };
};

const deserializeGamePayload = (p) => {
  if (!p) return null;
  return {
    ...p,
    players: p.players.map(pl => ({
      ...pl,
      hand: pl.hand.map(deserializeCard)
    })),
    drawPile: p.drawPile.map(deserializeCard),
    discardPile: p.discardPile.map(deserializeCard)
  };
};

class MockHubConnection {
  constructor(url) {
    this.url = url;
    this.handlers = {};
    this.senderId = Math.random().toString(36).substring(2);
    this.roomId = null;
    this.socket = null;
    
    // Auto-detect room from URL
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      this.connectToTopic(room);
    }
  }

  connectToTopic(roomId) {
    if (this.socket) {
      this.socket.close();
    }
    this.roomId = roomId;
    this.socket = new WebSocket(`wss://ntfy.sh/uno-project5-${roomId}/ws`);
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "message") {
          const payload = JSON.parse(data.message);
          // Ignore our own messages
          if (payload.senderId === this.senderId) return;
          
          const { method, args } = payload;
          let finalArgs = args;
          if (method === "GameStarted" && args && args[0]) {
            finalArgs = [deserializeGamePayload(args[0])];
          }
          
          if (this.handlers[method]) {
            this.handlers[method].forEach(handler => handler(...finalArgs));
          }
        }
      } catch (e) {
        // Ignore JSON parsing errors for system messages
      }
    };
    
    this.socket.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  on(method, handler) {
    if (!this.handlers[method]) {
      this.handlers[method] = [];
    }
    this.handlers[method].push(handler);
  }

  off(method, handler) {
    if (!this.handlers[method]) return;
    if (handler) {
      this.handlers[method] = this.handlers[method].filter(h => h !== handler);
    } else {
      delete this.handlers[method];
    }
  }

  async start() {
    if (!this.roomId) {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room) {
        this.connectToTopic(room);
      }
    }
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  async stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  invoke(method, ...args) {
    let roomId = this.roomId;
    if (!roomId && args && args[0]) {
      if (typeof args[0] === 'string') {
        roomId = args[0];
      } else if (args[0].roomId) {
        roomId = args[0].roomId;
      }
      if (roomId) {
        this.connectToTopic(roomId);
      }
    }

    if (!roomId) {
      console.warn("SignalR invoke skipped: no roomId detected.", method, args);
      return Promise.resolve();
    }

    let finalArgs = args;
    if (method === "GameStarted" && args && args[0]) {
      finalArgs = [serializeGamePayload(args[0])];
    }

    const payload = {
      senderId: this.senderId,
      method,
      args: finalArgs
    };

    // Post message to ntfy topic
    fetch(`https://ntfy.sh/uno-project5-${roomId}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }).catch(err => {
      console.error("Failed to post message to ntfy:", err);
    });

    return Promise.resolve();
  }
}

class MockHubConnectionBuilder {
  constructor() {
    this.url = '';
  }
  withUrl(url) {
    this.url = url;
    return this;
  }
  build() {
    return new MockHubConnection(this.url);
  }
}

export const HubConnectionBuilder = MockHubConnectionBuilder;
