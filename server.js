const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io", // ยืนยันว่า path ถูกต้อง
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.use(express.static(path.join(__dirname, 'public')));


// =======================================================
//   VVV  โค้ด LOGIC ของเกมที่คุณเขียนไว้ (ไม่ต้องแก้ไข) VVV
// =======================================================

// Game rooms storage: ใช้ Map เพื่อเก็บข้อมูลห้องเกมทั้งหมด
const gameRooms = new Map();

// --- Class สำหรับจัดการตรรกะของห้องเกม ---
class GameRoom {
  constructor(roomId, hostSocket) {
    this.id = roomId;
    this.players = new Map();
    this.gameState = 'waiting'; // สถานะ: waiting, selecting-poison, playing, finished
    this.totalSweets = 0;
    this.poisonPositions = {}; // { player1: index, player2: index }
    this.eatenSweets = []; // เปลี่ยนเป็น Array เพื่อให้ JSON ส่งง่าย
    this.currentPlayer = 1;
    this.selectionPhase = 1; // 1 หรือ 2
    this.playerEatenCount = { player1: 0, player2: 0 };
    this.startTime = Date.now();

    // เพิ่ม Host เข้าเป็นผู้เล่นคนที่ 1
    this.addPlayer(hostSocket, 1);
  }

  addPlayer(socket, playerNumber = null) {
    if (this.players.size >= 2) return false;

    const playerId = playerNumber || (this.players.size + 1);
    const player = {
      id: playerId,
      socket: socket,
      name: `ผู้เล่นคนที่ ${playerId}`
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
    this.totalSweets = Math.floor(Math.random() * 8) + 5; // สุ่ม 5-12 ชิ้น
  }

  resetGame() {
    this.gameState = 'waiting';
    this.totalSweets = 0;
    this.poisonPositions = {};
    this.eatenSweets = [];
    this.currentPlayer = 1;
    this.selectionPhase = 1;
    this.playerEatenCount = { player1: 0, player2: 0 };
  }

  // ฟังก์ชันสร้าง Object สถานะเกมเพื่อส่งให้ Client
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
        isMe: p.socket.id === playerSocket.id
      })),
      currentPlayer: this.currentPlayer,
      selectionPhase: this.selectionPhase,
      eatenSweets: this.eatenSweets,
      playerEatenCount: this.playerEatenCount,
      myPlayerId: player?.id
    };
  }
}

// --- จัดการการเชื่อมต่อ Socket ทั้งหมด ---
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // สร้างห้องเกมใหม่
  socket.on('create-room', (callback) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const room = new GameRoom(roomId, socket);
    gameRooms.set(roomId, room);

    console.log(`Room created: ${roomId}`);

    callback({
      success: true,
      roomId: roomId,
      gameState: room.getGameStateForPlayer(socket)
    });
  });

  // เข้าร่วมห้องที่มีอยู่
  socket.on('join-room', (data, callback) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);

    if (!room) return callback({ success: false, error: 'ไม่พบห้องเกม' });
    if (room.isRoomFull()) return callback({ success: false, error: 'ห้องเกมเต็มแล้ว' });

    const player = room.addPlayer(socket, 2);
    if (player) {
      console.log(`Player ${socket.id} joined room ${roomId}`);
      callback({ success: true, gameState: room.getGameStateForPlayer(socket) });
      // แจ้งทุกคนในห้องให้ update
      io.to(roomId).emit('room-update', room.getGameStateForPlayer(socket));
    } else {
      callback({ success: false, error: 'ไม่สามารถเข้าร่วมห้องได้' });
    }
  });

  // เริ่มเกม
  socket.on('start-game', (callback) => {
    const room = findRoomBySocket(socket.id);
    if (!room || !room.canStartGame()) return;

    room.generateSweetCount();
    room.gameState = 'selecting-poison';
    room.selectionPhase = 1;

    console.log(`Game started in room ${room.id}, sweets: ${room.totalSweets}`);

    // แจ้งทุกคนในห้องว่าเกมเริ่มแล้ว
    io.to(room.id).emit('game-started', {
      totalSweets: room.totalSweets,
      gameState: room.getGameStateForPlayer(socket)
    });
  });

  // เลือกยาพิษ
  socket.on('select-poison', (data) => {
    const { poisonIndex } = data;
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);

    if (!room || !player || room.gameState !== 'selecting-poison' || player.id !== room.selectionPhase) return;

    room.poisonPositions[`player${player.id}`] = poisonIndex;
    console.log(`Player ${player.id} selected poison at index ${poisonIndex}`);

    if (room.selectionPhase === 1) {
      room.selectionPhase = 2;
      io.to(room.id).emit('poison-selection-next', { gameState: room.getGameStateForPlayer(socket) });
    } else {
      room.gameState = 'playing';
      room.currentPlayer = 1; // เริ่มที่ผู้เล่น 1 เสมอ
      io.to(room.id).emit('game-playing', { gameState: room.getGameStateForPlayer(socket) });
    }
  });

  // เลือกขนมที่จะกิน
  socket.on('select-sweet', (data) => {
    const { sweetIndex } = data;
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);

    if (!room || !player || room.gameState !== 'playing' || player.id !== room.currentPlayer || room.eatenSweets.includes(sweetIndex)) return;

    room.eatenSweets.push(sweetIndex);
    room.playerEatenCount[`player${player.id}`]++;
    console.log(`Player ${player.id} ate sweet ${sweetIndex}`);

    // ตรวจสอบว่ากินยาพิษหรือไม่
    const ownPoison = room.poisonPositions[`player${player.id}`];
    const opponentPoison = room.poisonPositions[`player${player.id === 1 ? 2 : 1}`];

    if (sweetIndex === ownPoison || sweetIndex === opponentPoison) {
      room.gameState = 'finished';
      io.to(room.id).emit('game-over', {
        winner: player.id === 1 ? 2 : 1,
        loser: player.id,
        poisonIndex: sweetIndex,
        poisonPositions: room.poisonPositions,
      });
    } else {
      room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
      io.to(room.id).emit('sweet-eaten', { gameState: room.getGameStateForPlayer(socket) });
    }
  });

  // เล่นอีกครั้ง
  socket.on('restart-game', () => {
    const room = findRoomBySocket(socket.id);
    const player = room?.getPlayer(socket.id);
    // ให้เฉพาะ Host (ผู้เล่น 1) เท่านั้นที่สั่ง restart ได้
    if (!room || !player || player.id !== 1) return;

    room.resetGame();
    console.log(`Room ${room.id} restarted.`);
    io.to(room.id).emit('game-restarted', room.getGameStateForPlayer(socket));
  });

  // จัดการเมื่อผู้เล่นหลุดการเชื่อมต่อ
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const room = findRoomBySocket(socket.id);
    if (room) {
      const player = room.removePlayer(socket.id);
      if (player) {
        if (room.players.size > 0) {
          // แจ้งผู้เล่นที่เหลืออยู่
          io.to(room.id).emit('player-disconnected', {
            playerId: player.id,
            gameState: room.getGameStateForPlayer(socket) // ส่งสถานะล่าสุด
          });
        } else {
          // ถ้าห้องว่างแล้ว ก็ลบห้องทิ้ง
          gameRooms.delete(room.id);
          console.log(`Room ${room.id} deleted (empty).`);
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
// =======================================================
//   ^^^  โค้ด LOGIC ของเกมที่คุณเขียนไว้ (ไม่ต้องแก้ไข) ^^^
// =======================================================


// --- ส่วนที่จำเป็นสำหรับให้ Vercel ทำงาน ---
// Vercel จะไม่ใช้ server.listen() แต่จะใช้ app ที่ export ไปแทน
// เราจะเก็บ server.listen ไว้เพื่อให้ยังรันบนเครื่องตัวเอง (localhost) ได้
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🍪 Server running on http://localhost:${PORT}`);
  });
}

// --- Export `app` เพื่อให้ Vercel นำไปใช้งาน ---
module.exports = app;