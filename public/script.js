// === Poison Cookie Online Client Script ===

document.addEventListener('DOMContentLoaded', () => {
    // --- การเชื่อมต่อกับ Server ---
    console.log("กำลังเชื่อมต่อกับเซิร์ฟเวอร์เกม...");
    const socket = io({
        path: "/socket.io" // สำคัญมากสำหรับ Vercel
    });

    // --- ตัวแปรเก็บสถานะของเกม ---
    let myPlayerId = null;
    let currentRoomId = null;
    let gameState = {};

    // --- DOM Elements ---
    const screens = {
        mainMenu: document.getElementById('main-menu'),
        lobby: document.getElementById('lobby'),
        gameScreen: document.getElementById('game-screen'),
        resultScreen: document.getElementById('result-screen'),
        loading: document.getElementById('loading-overlay')
    };

    const elements = {
        // Main Menu
        createRoomBtn: document.getElementById('create-room-btn'),
        joinRoomBtn: document.getElementById('join-room-btn'),
        roomIdInput: document.getElementById('room-id-input'),
        // Lobby
        lobbyRoomId: document.getElementById('lobby-room-id'),
        lobbyPlayers: document.getElementById('lobby-players'),
        startGameBtn: document.getElementById('start-game-btn'),
        // Game
        gameStatus: document.getElementById('game-status'),
        sweetsContainer: document.getElementById('sweets-container'),
        // Result
        winnerText: document.getElementById('winner-text'),
        playAgainBtn: document.getElementById('play-again-btn'),
    };
    
    // --- ฟังก์ชันจัดการหน้าจอ ---
    const showScreen = (screenName) => {
        Object.values(screens).forEach(screen => screen.classList.add('hidden'));
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
        }
    };
    
    const showLoading = (show) => {
        screens.loading.style.display = show ? 'flex' : 'none';
    };

    // --- ฟังก์ชันวาดหน้าจอต่างๆ ---
    const renderLobby = () => {
        if (!gameState.roomId) return;
        currentRoomId = gameState.roomId;
        lobbyRoomId.textContent = `รหัสห้อง: ${currentRoomId}`;

        lobbyPlayers.innerHTML = '';
        gameState.players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'lobby-player';
            playerDiv.textContent = `ผู้เล่นคนที่ ${player.id} ${player.isMe ? '(คุณ)' : ''}`;
            lobbyPlayers.appendChild(playerDiv);
        });

        // Host (Player 1) สามารถกดเริ่มเกมได้เมื่อมีผู้เล่นครบ 2 คน
        if (myPlayerId === 1 && gameState.players.length === 2) {
            startGameBtn.disabled = false;
        } else {
            startGameBtn.disabled = true;
        }
        showScreen('lobby');
    };

    const renderGame = () => {
        sweetsContainer.innerHTML = '';
        const isMyTurn = gameState.currentPlayer === myPlayerId;

        // แสดงสถานะเกม (เลือกยาพิษ หรือ เล่น)
        if (gameState.gameState === 'selecting-poison') {
            const isMyTurnToSelect = gameState.selectionPhase === myPlayerId;
            gameStatus.textContent = isMyTurnToSelect ? 'ตาคุณ: เลือกขนมที่จะวางยาพิษ' : `รอผู้เล่นคนที่ ${gameState.selectionPhase} เลือกยาพิษ...`;
            
            // สร้างขนมให้เลือกวางยาพิษ
            for (let i = 0; i < gameState.totalSweets; i++) {
                const sweet = document.createElement('div');
                sweet.className = 'sweet';
                sweet.textContent = '🍪';
                if (isMyTurnToSelect) {
                    sweet.classList.add('selectable');
                    sweet.onclick = () => selectPoison(i);
                }
                sweetsContainer.appendChild(sweet);
            }

        } else if (gameState.gameState === 'playing') {
            gameStatus.textContent = isMyTurn ? 'ตาของคุณ: เลือกขนมที่จะกิน' : `รอผู้เล่นคนที่ ${gameState.currentPlayer} เลือก...`;

            // สร้างขนมให้เลือกกิน
            for (let i = 0; i < gameState.totalSweets; i++) {
                const sweet = document.createElement('div');
                sweet.className = 'sweet';
                sweet.textContent = '🍪';
                
                if (gameState.eatenSweets.includes(i)) {
                    sweet.classList.add('eaten');
                } else if (isMyTurn) {
                    sweet.classList.add('selectable');
                    sweet.onclick = () => selectSweet(i);
                }
                sweetsContainer.appendChild(sweet);
            }
        }
        showScreen('gameScreen');
    };

    const renderResult = (data) => {
        const { winner, loser, poisonPositions } = data;
        winnerText.textContent = `ผู้เล่นคนที่ ${winner} ชนะ! เพราะผู้เล่นคนที่ ${loser} กินยาพิษ`;
        
        // Host สามารถกดเล่นอีกครั้งได้
        playAgainBtn.style.display = (myPlayerId === 1) ? 'block' : 'none';

        showScreen('resultScreen');
    };


    // --- การส่ง Event ไปหา Server ---
    const createRoom = () => {
        showLoading(true);
        socket.emit('create-room', (response) => {
            showLoading(false);
            if (response.success) {
                gameState = response.gameState;
                myPlayerId = 1;
                renderLobby();
            } else {
                alert(`เกิดข้อผิดพลาด: ${response.error}`);
            }
        });
    };

    const joinRoom = () => {
        const roomId = roomIdInput.value.trim().toUpperCase();
        if (!roomId) {
            alert('กรุณาใส่รหัสห้อง');
            return;
        }
        showLoading(true);
        socket.emit('join-room', { roomId }, (response) => {
            showLoading(false);
            if (response.success) {
                gameState = response.gameState;
                myPlayerId = 2;
                renderLobby();
            } else {
                alert(`เกิดข้อผิดพลาด: ${response.error}`);
            }
        });
    };
    
    const startGame = () => {
        showLoading(true);
        socket.emit('start-game', (response) => {
            // Server จะส่ง 'game-started' กลับมาให้ทุกคนเอง
            // ไม่ต้องทำอะไรตรงนี้
            showLoading(false);
        });
    };
    
    const selectPoison = (index) => {
        showLoading(true);
        socket.emit('select-poison', { poisonIndex: index }, (response) => {
            showLoading(false);
            // Server จะส่ง event กลับมาอัพเดทเอง
        });
    };

    const selectSweet = (index) => {
        showLoading(true);
        socket.emit('select-sweet', { sweetIndex: index }, (response) => {
            showLoading(false);
            // Server จะส่ง event กลับมาอัพเดทเอง
        });
    };

    const restartGame = () => {
        showLoading(true);
        socket.emit('restart-game');
    }

    // --- การผูก Event Listeners ---
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', joinRoom);
    elements.startGameBtn.addEventListener('click', startGame);
    elements.playAgainBtn.addEventListener('click', restartGame);


    // --- การรับ Event จาก Server ---
    socket.on('connect', () => {
        console.log('เชื่อมต่อสำเร็จ! Socket ID:', socket.id);
        showLoading(false);
        showScreen('mainMenu');
    });

    socket.on('connect_error', (err) => {
        console.error('เชื่อมต่อล้มเหลว:', err.message);
        alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
        showLoading(false);
    });

    socket.on('disconnect', () => {
        alert('การเชื่อมต่อหลุด!');
        showScreen('mainMenu');
    });

    socket.on('room-update', (data) => {
        gameState = data;
        renderLobby();
    });

    socket.on('game-started', (data) => {
        gameState = data.gameState;
        renderGame();
    });

    socket.on('poison-selection-next', (data) => {
        gameState = data.gameState;
        renderGame();
    });

    socket.on('game-playing', (data) => {
        gameState = data.gameState;
        renderGame();
    });

    socket.on('sweet-eaten', (data) => {
        gameState = data.gameState;
        renderGame();
    });

    socket.on('game-over', (data) => {
        renderResult(data);
    });

    socket.on('game-restarted', (data) => {
        gameState = data.gameState;
        renderLobby();
    });

    socket.on('player-disconnected', (data) => {
        alert(`ผู้เล่นคนที่ ${data.playerId} ออกจากห้อง!`);
        gameState = data.gameState;
        renderLobby();
    });

    // เริ่มต้นแสดงหน้าเมนูหลัก
    showScreen('mainMenu');
});