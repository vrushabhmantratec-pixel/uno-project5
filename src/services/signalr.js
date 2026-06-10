class MockHubConnection {
  constructor(url) {
    this.url = url;
    this.handlers = {};
    this.channel = new BroadcastChannel('signalr_uno_hub');
    this.channel.onmessage = (event) => {
      const { method, args } = event.data;
      if (this.handlers[method]) {
        this.handlers[method].forEach(handler => handler(...args));
      }
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
    return new Promise(resolve => setTimeout(resolve, 300));
  }

  async stop() {
    this.channel.close();
  }

  invoke(method, ...args) {
    this.channel.postMessage({ method, args });
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
