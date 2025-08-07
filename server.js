const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const gameRooms = new Map();

class GameRoom {
  constructor(roomId, hostSocket) {
    this.id = roomId;
    this.players = new Map();
    this.gameState = 'waiting'; // waiting, selecting-poison, playing, finished
    this.totalSweets = 0;
    this.poisonPositions = {};
    this.eatenSweets = new Set();
    this.currentPlayer = 1;
    this.selectionPhase = 1;
    this.playerEatenCount = { player1: 0, player2: 0 };
    this.startTime = Date.now();
    
    // Add host as player 1
    this.addPlayer(hostSocket, 1);
  }

  addPlayer(socket, playerNumber = null) {
    if (this.players.size >= 2) return false;
    
    const playerId = playerNumber || (this.players.size + 1);
    const player = {
      id: playerId,
      socket: socket,
      name: `ผู้เล่นคนที่ ${playerId}`,
      ready: false,
      poisonSelected: false
    };
    
    this.players.set(socket.id, player);
    socket.join(this.id);
    
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      return player;
    }
    return null;
  }

  getPlayer(socketId) {
    return this.players.get(socketId);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }

  isRoomFull() {
    return this.players.size >= 2;
  }

  canStartGame() {
    return this.players.size === 2 && this.gameState === 'waiting';
  }

  generateSweetCount() {
    this.totalSweets = Math.floor(Math.random() * 8) + 5; // 5-12 pieces
  }

  resetGame() {
    this.gameState = 'waiting';
    this.totalSweets = 0;
    this.poisonPositions = {};
    this.eatenSweets = new Set();
    this.currentPlayer = 1;
    this.selectionPhase = 1;
    this.playerEatenCount = { player1: 0, player2: 0 };
    
    // Reset player states
    this.players.forEach(player => {
      player.ready = false;
      player.poisonSelected = false;
    });
  }

  getGameStateForPlayer(playerSocket) {
    const player = this.getPlayer(playerSocket.id);
    const players = this.getAllPlayers();
    
    return {
      roomId: this.id,
      gameState: this.gameState,
      totalSweets: this.totalSweets,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        isMe: p.socket.id === playerSocket.id
      })),
      currentPlayer: this.currentPlayer,
      selectionPhase: this.selectionPhase,
      eatenSweets: Array.from(this.eatenSweets),
      playerEatenCount: this.playerEatenCount,
      myPlayerId: player?.id
    };
  }
}

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create new game room
  socket.on('create-room', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new GameRoom(roomId, socket);
    gameRooms.set(roomId, room);
    
    console.log(`Room created: ${roomId}`);
    
    callback({
      success: true,
      roomId: roomId,
      gameState: room.getGameStateForPlayer(socket)
    });

    // Send room update to all players
    io.to(roomId).emit('room-update', room.getGameStateForPlayer(socket));
  });

  // Join existing room
  socket.on('join-room', (data, callback) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    
    if (!room) {
      callback({ success: false, error: 'ไม่พบห้องเกม' });
      return;
    }

    if (room.isRoomFull()) {
      callback({ success: false, error: 'ห้องเกมเต็มแล้ว' });
      return;
    }

    const player = room.addPlayer(socket, 2);
    if (player) {
      console.log(`Player joined room ${roomId}: ${socket.id}`);
      
      callback({
        success: true,
        roomId: roomId,
        gameState: room.getGameStateForPlayer(socket)
      });

      // Notify all players about room update
      io.to(roomId).emit('room-update', room.getGameStateForPlayer(socket));
    } else {
      callback({ success: false, error: 'ไม่สามารถเข้าร่วมห้องได้' });
    }
  });

  // Start game
  socket.on('start-game', (callback) => {
    const room = findRoomBySocket(socket.id);
    if (!room || !room.canStartGame()) {
      callback({ success: false, error: 'ไม่สามารถเริ่มเกมได้' });
      return;
    }

    room.generateSweetCount();
    room.gameState = 'selecting-poison';
    room.selectionPhase = 1;
    
    console.log(`Game started in room ${room.id}, sweets: ${room.totalSweets}`);
    
    callback({ success: true });
    
    // Notify all players
    io.to(room.id).emit('game-started', {
      totalSweets: room.totalSweets,
      gameState: room.getGameStateForPlayer(socket)
    });
  });

  // Select poison
  socket.on('select-poison', (data, callback) => {
    const { poisonIndex } = data;
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);
    
    if (!room || !player || room.gameState !== 'selecting-poison') {
      callback({ success: false, error: 'ไม่สามารถเลือกยาพิษได้' });
      return;
    }

    // Check if it's this player's turn to select
    if (player.id !== room.selectionPhase) {
      callback({ success: false, error: 'ยังไม่ถึงตาของคุณ' });
      return;
    }

    room.poisonPositions[`player${player.id}`] = poisonIndex;
    player.poisonSelected = true;
    
    console.log(`Player ${player.id} selected poison at index ${poisonIndex}`);
    
    callback({ success: true });

    // Move to next selection phase or start playing
    if (room.selectionPhase === 1) {
      room.selectionPhase = 2;
      io.to(room.id).emit('poison-selection-next', {
        nextPlayer: 2,
        gameState: room.getGameStateForPlayer(socket)
      });
    } else {
      // Both players selected, start playing
      room.gameState = 'playing';
      room.currentPlayer = 1;
      
      io.to(room.id).emit('game-playing', {
        gameState: room.getGameStateForPlayer(socket)
      });
    }
  });

  // Select sweet to eat
  socket.on('select-sweet', (data, callback) => {
    const { sweetIndex } = data;
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);
    
    if (!room || !player || room.gameState !== 'playing') {
      callback({ success: false, error: 'ไม่สามารถเลือกขนมได้' });
      return;
    }

    // Check if it's this player's turn
    if (player.id !== room.currentPlayer) {
      callback({ success: false, error: 'ยังไม่ถึงตาของคุณ' });
      return;
    }

    // Check if sweet is already eaten
    if (room.eatenSweets.has(sweetIndex)) {
      callback({ success: false, error: 'ขนมชิ้นนี้ถูกกินแล้ว' });
      return;
    }

    room.eatenSweets.add(sweetIndex);
    room.playerEatenCount[`player${player.id}`]++;
    
    console.log(`Player ${player.id} selected sweet ${sweetIndex}`);
    
    // Check for poison
    const currentPlayerPoison = room.poisonPositions[`player${room.currentPlayer}`];
    const opponentPoison = room.poisonPositions[`player${room.currentPlayer === 1 ? 2 : 1}`];
    
    if (sweetIndex === currentPlayerPoison || sweetIndex === opponentPoison) {
      // Game over!
      room.gameState = 'finished';
      const winner = room.currentPlayer === 1 ? 2 : 1;
      
      callback({ success: true, gameOver: true });
      
      io.to(room.id).emit('game-over', {
        winner: winner,
        loser: room.currentPlayer,
        poisonIndex: sweetIndex,
        poisonPositions: room.poisonPositions,
        gameState: room.getGameStateForPlayer(socket),
        summary: {
          totalSweets: room.totalSweets,
          eatenCount: room.playerEatenCount,
          gameTime: Date.now() - room.startTime
        }
      });
    } else {
      // Continue game, switch player
      room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
      
      callback({ success: true, gameOver: false });
      
      io.to(room.id).emit('sweet-eaten', {
        eatenIndex: sweetIndex,
        nextPlayer: room.currentPlayer,
        gameState: room.getGameStateForPlayer(socket)
      });
    }
  });

  // Player ready
  socket.on('player-ready', (callback) => {
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);
    
    if (room && player) {
      player.ready = !player.ready;
      
      callback({ success: true });
      
      io.to(room.id).emit('room-update', room.getGameStateForPlayer(socket));
    } else {
      callback({ success: false });
    }
  });

  // Restart game
  socket.on('restart-game', (callback) => {
    const room = findRoomBySocket(socket.id);
    
    if (room) {
      room.resetGame();
      room.startTime = Date.now();
      
      callback({ success: true });
      
      io.to(room.id).emit('game-restarted', {
        gameState: room.getGameStateForPlayer(socket)
      });
    } else {
      callback({ success: false });
    }
  });

  // Chat message
  socket.on('chat-message', (data) => {
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);
    
    if (room && player) {
      const message = {
        playerId: player.id,
        playerName: player.name,
        message: data.message,
        timestamp: Date.now()
      };
      
      io.to(room.id).emit('chat-message', message);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    const room = findRoomBySocket(socket.id);
    if (room) {
      const player = room.removePlayer(socket.id);
      if (player) {
        console.log(`Player ${player.id} left room ${room.id}`);
        
        // Notify remaining players
        io.to(room.id).emit('player-disconnected', {
          playerId: player.id,
          playerName: player.name,
          gameState: room.getGameStateForPlayer(socket)
        });

        // Remove empty rooms
        if (room.players.size === 0) {
          gameRooms.delete(room.id);
          console.log(`Room ${room.id} deleted (empty)`);
        }
      }
    }
  });
});

// Helper function to find room by socket ID
function findRoomBySocket(socketId) {
  for (const room of gameRooms.values()) {
    if (room.players.has(socketId)) {
      return room;
    }
  }
  return null;
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🍪 Poison Cookie Game Server running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
});

// Clean up empty rooms every 5 minutes
setInterval(() => {
  let cleaned = 0;
  for (const [roomId, room] of gameRooms.entries()) {
    if (room.players.size === 0) {
      gameRooms.delete(roomId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} empty rooms`);
  }
}, 5 * 60 * 1000);