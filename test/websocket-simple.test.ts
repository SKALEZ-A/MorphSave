import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

describe('WebSocket Basic Functionality', () => {
  let httpServer: HTTPServer;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;

  beforeAll((done) => {
    httpServer = new HTTPServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    httpServer.listen(() => {
      const port = (httpServer.address() as any)?.port;
      clientSocket = Client(`http://localhost:${port}`);
      
      ioServer.on('connection', (socket) => {
        socket.emit('welcome', 'Hello from server');
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    ioServer.close();
    httpServer.close();
    clientSocket.close();
  });

  it('should connect successfully', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should receive welcome message', (done) => {
    clientSocket.on('welcome', (message) => {
      expect(message).toBe('Hello from server');
      done();
    });
  });

  it('should emit and receive custom events', (done) => {
    const testData = { message: 'test', timestamp: Date.now() };
    
    ioServer.on('connection', (socket) => {
      socket.on('test_event', (data) => {
        socket.emit('test_response', { received: data, processed: true });
      });
    });

    clientSocket.on('test_response', (data) => {
      expect(data.received).toEqual(testData);
      expect(data.processed).toBe(true);
      done();
    });

    clientSocket.emit('test_event', testData);
  });

  it('should handle room joining', (done) => {
    const roomName = 'test-room';
    
    ioServer.on('connection', (socket) => {
      socket.on('join_room', (room) => {
        socket.join(room);
        socket.emit('joined_room', { room, success: true });
      });
    });

    clientSocket.on('joined_room', (data) => {
      expect(data.room).toBe(roomName);
      expect(data.success).toBe(true);
      done();
    });

    clientSocket.emit('join_room', roomName);
  });

  it('should broadcast to rooms', (done) => {
    const roomName = 'broadcast-room';
    const broadcastMessage = 'Hello room!';
    
    // Create second client
    const secondClient = Client(`http://localhost:${(httpServer.address() as any)?.port}`);
    
    secondClient.on('connect', () => {
      // Both clients join the room
      clientSocket.emit('join_room', roomName);
      secondClient.emit('join_room', roomName);
      
      // Wait a bit for room joining to complete
      setTimeout(() => {
        ioServer.to(roomName).emit('room_broadcast', broadcastMessage);
      }, 100);
    });

    let receivedCount = 0;
    const checkComplete = () => {
      receivedCount++;
      if (receivedCount === 2) {
        secondClient.close();
        done();
      }
    };

    clientSocket.on('room_broadcast', (message) => {
      expect(message).toBe(broadcastMessage);
      checkComplete();
    });

    secondClient.on('room_broadcast', (message) => {
      expect(message).toBe(broadcastMessage);
      checkComplete();
    });
  });
});