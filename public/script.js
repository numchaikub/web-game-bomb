// === Poison Cookie Online Client Script (ฉบับสมบูรณ์พร้อม Logic) ===

document.addEventListener('DOMContentLoaded', () => {
    // --- การเชื่อมต่อกับ Server ---
    console.log("กำลังเชื่อมต่อกับเซิร์ฟเวอร์เกม...");
    const socket = io({
        path: "/socket.io"
    });

    // --- ตัวแปรเก็บสถานะของเกม ---
    let myPlayerInfo = null;
    let gameState = {};
    let selectedPoisonIndex = null;

    // --- DOM Elements ---
    const screens = {
        mainMenu: document.getElementById('main-menu'),
        roomScreen: document.getElementById('room-screen'),
        poisonSelection: document.getElementById('poison-selection'),
        gameScreen: document.getElementById('game-screen'),
        resultScreen: document.getElementById('result-screen'),
        instructions: document.getElementById('instructions'),
        loadingOverlay: document.getElementById('loading-overlay'),
        notification: document.getElementById('notification'),
    };

    const elements = {
        // Shared
        loadingText: document.getElementById('loading-text'),
        notificationText: document.getElementById('notification-text'),
        notificationClose: document.getElementById('notification-close'),
        // Main Menu
        connectionStatusDot: document.getElementById('connection-status'),
        connectionStatusText: document.getElementById('connection-text'),
        createRoomBtn: document.getElementById('create-room'),
        joinRoomBtn: document.getElementById('join-room'),
        roomCodeInput: document.getElementById('room-code'),
        howToPlayBtn: document.getElementById('how-to-play'),
        // Instructions
        backToMenuBtn: document.getElementById('back-to-menu'),
        // Room
        currentRoomIdText: document.getElementById('current-room-id'),
        copyRoomCodeBtn: document.getElementById('copy-room-code'),
        leaveRoomBtn: document.getElementById('leave-room'),
        player1Slot: document.getElementById('player-1-slot'),
        player2Slot: document.getElementById('player-2-slot'),
        readyBtn: document.getElementById('ready-btn'),
        startGameBtn: document.getElementById('start-game-btn'),
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        sendChatBtn: document.getElementById('send-chat'),
        // Poison Selection
        selectionTitle: document.getElementById('selection-title'),
        selectionSubtitle: document.getElementById('selection-subtitle'),
        poisonGrid: document.getElementById('poison-grid'),
        confirmPoisonBtn: document.getElementById('confirm-poison'),
        // Game Screen
        dangerFill: document.getElementById('danger-fill'),
        remainingText: document.getElementById('remaining'),
        turnIndicator: document.getElementById('turn-indicator'),
        currentPlayerName: document.getElementById('current-player-name'),
        turnStatus: document.getElementById('turn-status'),
        gameGrid: document.getElementById('game-grid'),
        player1CardName: document.getElementById('player1-name'),
        player2CardName: document.getElementById('player2-name'),
        // Result Screen
        winnerText: document.getElementById('winner-text'),
        poisonReveal: document.getElementById('poison-reveal'),
        gameSummary: document.getElementById('game-summary'),
        playAgainBtn: document.getElementById('play-again'),
        backToRoomBtn: document.getElementById('back-to-room'),
    };

    // ======================================
    // ===       UTILITY FUNCTIONS        ===
    // ======================================

    const showScreen = (screenName) => {
        Object.values(screens).forEach(screen => screen?.classList.add('hidden'));
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
        }
    };

    const showLoading = (show, text = 'กำลังโหลด...') => {
        if (elements.loadingText) elements.loadingText.textContent = text;
        screens.loadingOverlay?.classList.toggle('hidden', !show);
    };

    const showNotification = (text, duration = 3000) => {
        if (elements.notificationText) elements.notificationText.textContent = text;
        screens.notification?.classList.remove('hidden');
        setTimeout(() => screens.notification?.classList.add('hidden'), duration);
    };

    const createSweetElement = (index, type) => {
        const sweet = document.createElement('div');
        sweet.className = 'sweet';
        sweet.dataset.id = index;
        if (type === 'poison-selection') {
            sweet.onclick = () => handlePoisonSelect(index, sweet);
        } else if (type === 'game') {
            sweet.onclick = () => handleSweetClick(index);
        }
        return sweet;
    };

    // ======================================
    // ===      UI RENDERING LOGIC        ===
    // ======================================

    const renderRoom = (state) => {
        gameState = state;
        myPlayerInfo = state.players.find(p => p.isMe);

        elements.currentRoomIdText.textContent = state.roomId;

        // Render Player 1
        const player1 = state.players.find(p => p.id === 1);
        const p1SlotName = elements.player1Slot.querySelector('.player-name');
        const p1SlotStatus = elements.player1Slot.querySelector('.player-status');
        const p1ReadyIndicator = elements.player1Slot.querySelector('.ready-indicator');
        if (player1) {
            p1SlotName.textContent = player1.isMe ? `${player1.name} (คุณ)` : player1.name;
            p1SlotStatus.textContent = player1.isReady ? '✅ พร้อมแล้ว' : '⏳ กำลังรอ';
            p1ReadyIndicator.style.display = player1.isReady ? 'flex' : 'none';
        } else {
            p1SlotName.textContent = 'รอผู้เล่น...';
            p1SlotStatus.textContent = '⏳ ว่าง';
            p1ReadyIndicator.style.display = 'none';
        }

        // Render Player 2
        const player2 = state.players.find(p => p.id === 2);
        const p2SlotName = elements.player2Slot.querySelector('.player-name');
        const p2SlotStatus = elements.player2Slot.querySelector('.player-status');
        const p2ReadyIndicator = elements.player2Slot.querySelector('.ready-indicator');
        if (player2) {
            p2SlotName.textContent = player2.isMe ? `${player2.name} (คุณ)` : player2.name;
            p2SlotStatus.textContent = player2.isReady ? '✅ พร้อมแล้ว' : '⏳ กำลังรอ';
            p2ReadyIndicator.style.display = player2.isReady ? 'flex' : 'none';
        } else {
            p2SlotName.textContent = 'รอผู้เล่น...';
            p2SlotStatus.textContent = '⏳ ว่าง';
            p2ReadyIndicator.style.display = 'none';
        }

        // Update button states
        const bothPlayersReady = state.players.length === 2 && state.players.every(p => p.isReady);
        elements.readyBtn.disabled = state.players.length < 2;
        elements.readyBtn.textContent = myPlayerInfo?.isReady ? 'ยกเลิกพร้อม' : 'พร้อม';
        elements.startGameBtn.disabled = !(myPlayerInfo?.id === 1 && bothPlayersReady);

        showScreen('roomScreen');
    };

    const renderPoisonSelection = (state) => {
        gameState = state;
        myPlayerInfo = state.players.find(p => p.isMe);
        const isMyTurn = myPlayerInfo?.id === state.selectionPhase;

        elements.selectionTitle.textContent = isMyTurn ? 'ตาคุณ: เลือกขนมที่จะวางยาพิษ' : `รอคู่แข่งเลือกยาพิษ...`;
        elements.selectionSubtitle.textContent = isMyTurn ? 'เลือก 1 ชิ้น แล้วกดยืนยัน' : 'กรุณารอสักครู่';
        elements.poisonGrid.innerHTML = '';
        for (let i = 0; i < state.totalSweets; i++) {
            elements.poisonGrid.appendChild(createSweetElement(i, 'poison-selection'));
        }
        
        elements.confirmPoisonBtn.disabled = true;
        selectedPoisonIndex = null;
        showScreen('poisonSelection');
    };

    const renderGameBoard = (state) => {
        gameState = state;
        myPlayerInfo = state.players.find(p => p.isMe);
        const isMyTurn = myPlayerInfo?.id === state.currentPlayer;
        const remaining = state.totalSweets - state.eatenSweets.length;
        
        // Header
        elements.dangerFill.style.width = `${(state.eatenSweets.length / state.totalSweets) * 100}%`;
        elements.remainingText.textContent = remaining;
        elements.currentPlayerName.textContent = state.players.find(p => p.id === state.currentPlayer)?.name || '';
        elements.turnStatus.textContent = isMyTurn ? 'เลือกขนมที่จะกิน' : 'รอคู่แข่งเลือก...';
        elements.turnIndicator.querySelector(`.player-avatar[data-player="${myPlayerInfo.id}"]`)?.classList.toggle('active', isMyTurn);

        // Game Board
        elements.gameGrid.innerHTML = '';
        for (let i = 0; i < state.totalSweets; i++) {
            const sweet = createSweetElement(i, 'game');
            if (state.eatenSweets.includes(i)) {
                sweet.classList.add('eaten');
            } else if (isMyTurn) {
                sweet.classList.add('selectable');
            }
            elements.gameGrid.appendChild(sweet);
        }
        showScreen('gameScreen');
    };

    const renderResult = (data) => {
        elements.winnerText.textContent = `${data.winner.name} เป็นฝ่ายชนะ!`;
        elements.poisonReveal.textContent = `${data.loser.name} กินขนมยาพิษชิ้นที่ ${data.poisonIndex + 1}`;
        // Show/hide button based on host
        elements.playAgainBtn.style.display = myPlayerInfo?.id === 1 ? 'block' : 'none';
        showScreen('resultScreen');
    };
    
    // ======================================
    // ===    EVENT EMITTERS (Client->Server)  ===
    // ======================================

    const handleCreateRoom = () => socket.emit('create-room');
    const handleJoinRoom = () => {
        const roomId = elements.roomCodeInput.value.trim().toUpperCase();
        if (roomId.length === 6) { // Server logic is 6 chars now
            socket.emit('join-room', roomId);
        } else {
            showNotification('รหัสห้องต้องมี 6 ตัวอักษร');
        }
    };
    const handleLeaveRoom = () => socket.emit('leave-room');
    const handleToggleReady = () => socket.emit('toggle-ready');
    const handleStartGame = () => socket.emit('start-game');
    const handleConfirmPoison = () => {
        if (selectedPoisonIndex !== null) {
            socket.emit('select-poison', selectedPoisonIndex);
            showLoading(true, 'รอยืนยัน...');
        }
    };
    const handleSweetClick = (index) => socket.emit('select-sweet', index);
    const handlePlayAgain = () => socket.emit('play-again');
    const handleBackToRoom = () => socket.emit('back-to-room');
    const handleSendChat = () => {
        const message = elements.chatInput.value.trim();
        if (message) {
            socket.emit('send-chat', message);
            elements.chatInput.value = '';
        }
    };
    const handlePoisonSelect = (index, element) => {
        document.querySelectorAll('#poison-grid .sweet.selected').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        selectedPoisonIndex = index;
        elements.confirmPoisonBtn.disabled = false;
    };
    
    // ======================================
    // ===     DOM EVENT LISTENERS        ===
    // ======================================

    elements.createRoomBtn.addEventListener('click', handleCreateRoom);
    elements.joinRoomBtn.addEventListener('click', handleJoinRoom);
    elements.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
    elements.readyBtn.addEventListener('click', handleToggleReady);
    elements.startGameBtn.addEventListener('click', handleStartGame);
    elements.confirmPoisonBtn.addEventListener('click', handleConfirmPoison);
    elements.playAgainBtn.addEventListener('click', handlePlayAgain);
    elements.backToRoomBtn.addEventListener('click', handleBackToRoom);
    elements.sendChatBtn.addEventListener('click', handleSendChat);
    elements.chatInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleSendChat());
    elements.howToPlayBtn.addEventListener('click', () => showScreen('instructions'));
    elements.backToMenuBtn.addEventListener('click', () => showScreen('mainMenu'));
    elements.copyRoomCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(gameState.roomId)
            .then(() => showNotification('คัดลอกรหัสห้องแล้ว!'));
    });
    elements.notificationClose.addEventListener('click', () => screens.notification.classList.add('hidden'));

    // ======================================
    // ===    SOCKET EVENT HANDLERS (Server->Client) ===
    // ======================================

    socket.on('connect', () => {
        console.log('เชื่อมต่อสำเร็จ! Socket ID:', socket.id);
        elements.connectionStatusDot.classList.add('online');
        elements.connectionStatusText.textContent = 'ออนไลน์';
        showLoading(false);
    });

    socket.on('disconnect', () => {
        console.warn('การเชื่อมต่อหลุด!');
        elements.connectionStatusDot.classList.remove('online');
        elements.connectionStatusText.textContent = 'ออฟไลน์';
        showNotification('การเชื่อมต่อหลุด! กำลังพยายามเชื่อมต่อใหม่...');
        showScreen('mainMenu');
    });
    
    socket.on('connect_error', () => {
        console.error('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว');
        elements.connectionStatusDot.classList.remove('online');
        elements.connectionStatusText.textContent = 'เชื่อมต่อล้มเหลว';
    });

    socket.on('show-loading', ({ show, message }) => showLoading(show, message));
    socket.on('notification', (message) => showNotification(message));
    socket.on('room-state', (state) => renderRoom(state));
    socket.on('game-start-poison', (state) => renderPoisonSelection(state));
    socket.on('game-state-update', (state) => renderGameBoard(state));
    socket.on('game-over', (data) => renderResult(data));
    socket.on('go-to-main-menu', () => showScreen('mainMenu'));
    
    socket.on('chat-message', ({ playerName, message }) => {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        messageEl.innerHTML = `<span class="message-sender">${playerName}:</span> <span class="message-text">${message}</span>`;
        elements.chatMessages.appendChild(messageEl);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight; // Scroll to bottom
    });

    // --- Initial State ---
    showScreen('mainMenu');
});