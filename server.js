// server.js

// =================================================================
// ส่วนที่ 1: Import โมดูลที่จำเป็นทั้งหมด
// =================================================================
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // <<-- จุดสำคัญที่แก้ไขไปล่าสุด
const { v4: uuidv4 } = require('uuid'); // <<-- สำหรับสร้าง ID ห้อง

// =================================================================
// ส่วนที่ 2: ตั้งค่า Express และ Socket.IO Server
// =================================================================
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  // path ต้องตรงกับที่ Client เรียกใช้
  path: "/socket.io",
  cors: {
    origin: "*", // อนุญาตการเชื่อมต่อจากทุกที่
    methods: ["GET", "POST"]
  }
});

// =================================================================
// ส่วนที่ 3: Express Middleware
// =================================================================
// บอกให้ Express เสิร์ฟไฟล์ static (HTML, CSS, JS) จากโฟลเดอร์ 'public'
// นี่คือสิ่งที่ทำให้หน้าเว็บของเราแสดงขึ้นมาได้
app.use(express.static(path.join(__dirname, 'public')));

// =================================================================
// ส่วนที่ 4: ส่วนจัดการสถานะของเกม (Game State)
// =================================================================
const rooms = {}; // Object ที่ใช้เก็บข้อมูลห้องเกมทั้งหมด

// ตัวอย่าง Class สำหรับจัดการข้อมูลในห้อง (ควรเอาโค้ดของคุณมาใส่)
class GameRoom {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = []; // เก็บข้อมูลผู้เล่น
        this.gameState = 'waiting'; // สถานะของเกม: waiting, playing, finished
        // ... เพิ่ม property อื่นๆ ที่เกมของคุณต้องใช้ ...
    }
    
    // ... เพิ่ม Method อื่นๆ สำหรับจัดการเกม ...
    addPlayer(socketId) {
        if (this.players.length >= 2) return null; // ห้องเต็ม

        const playerInfo = {
            socketId: socketId,
            name: `Player-${socketId.substring(0, 4)}`,
            id: this.players.length + 1, // ผู้เล่นคนที่ 1 หรือ 2
            isReady: false
        };
        this.players.push(playerInfo);
        return playerInfo;
    }
}

// ฟังก์ชันสำหรับสร้าง Room ID แบบสุ่ม 6 ตัวอักษร
const createRoomId = () => {
    return uuidv4().substring(0, 6).toUpperCase();
};


// =================================================================
// ส่วนที่ 5: Logic หลักของ Socket.IO (หัวใจของเกมออนไลน์)
// =================================================================
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- จัดการห้อง: สร้างห้อง ---
    socket.on('create-room', () => {
        try {
            const roomId = createRoomId();
            rooms[roomId] = new GameRoom(roomId);
            
            const playerInfo = rooms[roomId].addPlayer(socket.id);
            if (playerInfo) {
                socket.join(roomId);
                // ส่งข้อมูลห้องกลับไปให้คนที่สร้าง
                io.to(socket.id).emit('room-created', { roomId, playerInfo, roomState: rooms[roomId] });
                console.log(`Room [${roomId}] created by ${socket.id}`);
            }
        } catch (error) {
            console.error(`[ERROR] create-room: ${error.message}`);
            socket.emit('error-message', 'เกิดข้อผิดพลาดในการสร้างห้อง');
        }
    });

    // --- จัดการห้อง: เข้าห้อง ---
    socket.on('join-room', (roomId) => {
        try {
            const room = rooms[roomId];
            if (!room) {
                return socket.emit('error-message', 'ไม่พบห้องนี้');
            }
            if (room.players.length >= 2) {
                return socket.emit('error-message', 'ห้องเต็มแล้ว');
            }

            const playerInfo = room.addPlayer(socket.id);
            if (playerInfo) {
                socket.join(roomId);
                console.log(`User ${socket.id} joined room [${roomId}]`);
                // อัปเดตข้อมูลห้องให้ทุกคนที่อยู่ในห้องนั้นทราบ
                io.to(roomId).emit('room-state-update', room);
            }

        } catch (error) {
            console.error(`[ERROR] join-room: ${error.message}`);
            socket.emit('error-message', 'เกิดข้อผิดพลาดในการเข้าห้อง');
        }
    });

    // --- จัดการการออกจากเกม ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // ควรจะมี Logic ค้นหาว่าผู้เล่นคนนี้อยู่ห้องไหน แล้วแจ้งให้อีกฝั่งทราบ
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                console.log(`User ${socket.id} removed from room [${roomId}]`);
                // แจ้งผู้เล่นที่เหลือในห้องว่ามีคนออกไปแล้ว
                io.to(roomId).emit('player-disconnected', { socketId: socket.id });
                io.to(roomId).emit('room-state-update', room);

                // ถ้ารห้องว่างแล้วก็ลบห้องทิ้ง
                if (room.players.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room [${roomId}] is now empty and has been deleted.`);
                }
                break; // ออกจาก loop เมื่อเจอห้องแล้ว
            }
        }
    });

    // !!! เพิ่ม Event Listener อื่นๆ ของเกมคุณที่นี่ !!!
    // เช่น socket.on('toggle-ready', ...)
    // เช่น socket.on('player-action', ...)

});

// =================================================================
// ส่วนที่ 6: Export 'app' เพื่อให้ Vercel นำไปใช้งาน
// =================================================================
// ไม่ต้องใช้ server.listen(...) เพราะ Vercel จะจัดการให้เอง
module.exports = app;