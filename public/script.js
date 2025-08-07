class PoisonSweetGame {
    constructor() {
        this.sweetEmoji = '🍪'; // ใช้ขนมแค่อันเดียว
        this.totalSweets = 0;
        this.currentPlayer = 1;
        this.poisonPositions = { player1: -1, player2: -1 };
        this.selectionPhase = 1; // 1 = player1 selecting, 2 = player2 selecting, 3 = game started
        this.eatenSweets = new Set();
        this.gameEnded = false;
        this.playerEatenCount = { player1: 0, player2: 0 };
        
        // สถิติเกม
        this.gameStats = {
            totalGames: parseInt(localStorage.getItem('totalGames') || '0'),
            player1Wins: parseInt(localStorage.getItem('player1Wins') || '0'),
            player2Wins: parseInt(localStorage.getItem('player2Wins') || '0')
        };
        
        this.initializeEventListeners();
        this.updateStatsDisplay();
        this.showMainMenu();
    }

    initializeEventListeners() {
        document.getElementById('start-game').addEventListener('click', () => this.startNewGame());
        document.getElementById('how-to-play').addEventListener('click', () => this.showInstructions());
        document.getElementById('back-to-menu').addEventListener('click', () => this.showMainMenu());
        document.getElementById('randomize-count').addEventListener('click', () => this.randomizeCookieCount());
        document.getElementById('proceed-to-selection').addEventListener('click', () => this.showPoisonSelection());
        document.getElementById('ready-to-select').addEventListener('click', () => this.hidePrivacyScreen());
        document.getElementById('confirm-poison').addEventListener('click', () => this.confirmPoisonSelection());
        document.getElementById('play-again').addEventListener('click', () => this.startNewGame());
        document.getElementById('back-to-main').addEventListener('click', () => this.showMainMenu());
    }

    updateStatsDisplay() {
        document.getElementById('total-games').textContent = this.gameStats.totalGames;
        document.getElementById('player1-wins').textContent = this.gameStats.player1Wins;
        document.getElementById('player2-wins').textContent = this.gameStats.player2Wins;
    }

    saveStats() {
        localStorage.setItem('totalGames', this.gameStats.totalGames.toString());
        localStorage.setItem('player1Wins', this.gameStats.player1Wins.toString());
        localStorage.setItem('player2Wins', this.gameStats.player2Wins.toString());
    }

    showMainMenu() {
        this.hideAllScreens();
        document.getElementById('main-menu').classList.remove('hidden');
    }

    showInstructions() {
        this.hideAllScreens();
        document.getElementById('instructions').classList.remove('hidden');
    }

    startNewGame() {
        this.resetGame();
        this.hideAllScreens();
        document.getElementById('game-setup').classList.remove('hidden');
        this.randomizeCookieCount();
    }

    randomizeCookieCount() {
        // สุ่มจำนวนขนม 5-12 ชิ้น
        this.totalSweets = Math.floor(Math.random() * 8) + 5;
        document.getElementById('cookie-count').textContent = this.totalSweets;
        
                // อัพเดท animation
        this.updateCookieRain();
    }

    updateCookieRain() {
        const cookieRain = document.querySelector('.cookie-rain');
        cookieRain.innerHTML = '';
        const displayCount = Math.min(this.totalSweets, 8);
        for (let i = 0; i < displayCount; i++) {
            const span = document.createElement('span');
            span.textContent = this.sweetEmoji;
            span.style.setProperty('--i', i);
            cookieRain.appendChild(span);
        }
    }

    showPoisonSelection() {
        this.hideAllScreens();
        document.getElementById('poison-selection').classList.remove('hidden');
        this.updateSelectionDisplay();
        this.showPrivacyScreen();
        this.createPoisonGrid();
    }

    showPrivacyScreen() {
        document.getElementById('privacy-screen').classList.remove('hidden');
        document.getElementById('privacy-player').textContent = this.selectionPhase;
    }

    hidePrivacyScreen() {
        document.getElementById('privacy-screen').classList.add('hidden');
    }

    updateSelectionDisplay() {
        const avatar = document.getElementById('current-selector');
        const title = document.getElementById('selection-title');
        
        avatar.querySelector('.player-number').textContent = this.selectionPhase;
        title.textContent = `ผู้เล่นคนที่ ${this.selectionPhase} - เลือกขนมยาพิษ`;
        
        // เปลี่ยนสีของ avatar
        if (this.selectionPhase === 1) {
            avatar.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        } else {
            avatar.style.background = 'linear-gradient(135deg, #ff4757, #c44569)';
        }
    }

    createPoisonGrid() {
        const grid = document.getElementById('poison-grid');
        grid.innerHTML = '';
        
        for (let i = 0; i < this.totalSweets; i++) {
            const sweet = document.createElement('div');
            sweet.className = 'sweet';
            sweet.innerHTML = this.sweetEmoji;
            sweet.dataset.index = i;
            sweet.addEventListener('click', () => this.selectPoison(i));
            grid.appendChild(sweet);
        }
        
        document.getElementById('confirm-poison').disabled = true;
    }

    selectPoison(index) {
        // Clear previous selection
        document.querySelectorAll('#poison-grid .sweet').forEach(sweet => {
            sweet.classList.remove('selected');
        });
        
        // Select new sweet
        document.querySelector(`#poison-grid .sweet[data-index="${index}"]`).classList.add('selected');
        
        if (this.selectionPhase === 1) {
            this.poisonPositions.player1 = index;
        } else {
            this.poisonPositions.player2 = index;
        }
        
        document.getElementById('confirm-poison').disabled = false;
    }

    confirmPoisonSelection() {
        if (this.selectionPhase === 1) {
            this.selectionPhase = 2;
            this.updateSelectionDisplay();
            this.showPrivacyScreen();
            this.createPoisonGrid();
        } else {
            this.startGamePlay();
        }
    }

    startGamePlay() {
        this.hideAllScreens();
        document.getElementById('game-screen').classList.remove('hidden');
        
        this.createGameGrid();
        this.updateGameDisplay();
        this.updateDangerMeter();
    }

    createGameGrid() {
        const grid = document.getElementById('game-grid');
        grid.innerHTML = '';
        
        for (let i = 0; i < this.totalSweets; i++) {
            const sweet = document.createElement('div');
            sweet.className = 'sweet';
            sweet.innerHTML = this.sweetEmoji;
            sweet.dataset.index = i;
            sweet.addEventListener('click', () => this.selectSweet(i));
            grid.appendChild(sweet);
        }
    }

    selectSweet(index) {
        if (this.gameEnded || this.eatenSweets.has(index)) return;
        
        this.eatenSweets.add(index);
        this.playerEatenCount[`player${this.currentPlayer}`]++;
        
        // Mark as eaten with animation
        const sweet = document.querySelector(`#game-grid .sweet[data-index="${index}"]`);
        sweet.classList.add('eaten');
        
        // เล่นเสียงเอฟเฟกต์ (ถ้ามี)
        this.playEatSound();
        
        // Check if current player hit their own poison or opponent's poison
        const currentPlayerPoison = this.poisonPositions[`player${this.currentPlayer}`];
        const opponentPoison = this.poisonPositions[`player${this.currentPlayer === 1 ? 2 : 1}`];
        
        if (index === currentPlayerPoison || index === opponentPoison) {
            setTimeout(() => {
                this.endGame(this.currentPlayer, index);
            }, 500);
        } else {
            // Switch player
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            this.updateGameDisplay();
            this.updateDangerMeter();
        }
    }

    playEatSound() {
        // สร้างเสียงแบบง่ายๆ ด้วย Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            // ไม่สามารถเล่นเสียงได้
        }
    }

    updateGameDisplay() {
        const currentPlayerElement = document.getElementById('current-player');
        const remainingElement = document.getElementById('remaining');
        const turnIndicator = document.getElementById('turn-indicator');
        
        currentPlayerElement.textContent = `ผู้เล่นคนที่ ${this.currentPlayer}`;
        remainingElement.textContent = this.totalSweets - this.eatenSweets.size;
        
        // Update turn indicator avatar
        const avatar = turnIndicator.querySelector('.player-avatar .player-number');
        avatar.textContent = this.currentPlayer;
        
        // Update player status cards
        document.querySelectorAll('.player').forEach((player, index) => {
            const playerNum = index + 1;
            if (playerNum === this.currentPlayer) {
                player.classList.add('active');
            } else {
                player.classList.remove('active');
            }
            
            // Update eaten count
            const eatenCountSpan = player.querySelector('.eaten-count span');
            eatenCountSpan.textContent = this.playerEatenCount[`player${playerNum}`];
        });
    }

    updateDangerMeter() {
        const dangerFill = document.getElementById('danger-fill');
        const remaining = this.totalSweets - this.eatenSweets.size;
        const dangerPercent = ((this.totalSweets - remaining) / this.totalSweets) * 100;
        
        dangerFill.style.width = `${dangerPercent}%`;
        
        // เพิ่มเอฟเฟกต์เมื่ออันตรายสูง
        if (dangerPercent > 70) {
            dangerFill.style.animation = 'pulse 0.5s infinite';
        } else {
            dangerFill.style.animation = 'none';
        }
    }

    endGame(loser, poisonIndex) {
        this.gameEnded = true;
        const winner = loser === 1 ? 2 : 1;
        
        // อัพเดทสถิติ
        this.gameStats.totalGames++;
        this.gameStats[`player${winner}Wins`]++;
        this.saveStats();
        
        // Show poison sweet with dramatic effect
        const poisonSweet = document.querySelector(`#game-grid .sweet[data-index="${poisonIndex}"]`);
        poisonSweet.classList.add('poison-revealed');
        
        // เล่นเสียงแพ้
        this.playGameOverSound();
        
        // Update player status
        this.updatePlayerStatus(loser, 'dead');
        this.updatePlayerStatus(winner, 'winner');
        
        setTimeout(() => {
            this.showResults(winner, loser, poisonIndex);
        }, 2000);
    }

    playGameOverSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);
        } catch (e) {
            // ไม่สามารถเล่นเสียงได้
        }
    }

    updatePlayerStatus(playerNum, status) {
        const player = document.querySelector(`.player${playerNum}`);
        const statusElement = player.querySelector('.status');
        
        if (status === 'dead') {
            statusElement.innerHTML = '💀 โดนยาพิษ';
            statusElement.style.color = '#ff4757';
            player.classList.add('dead');
        } else if (status === 'winner') {
            statusElement.innerHTML = '🏆 ชนะ!';
            statusElement.style.color = '#2ed573';
            player.classList.add('winner');
        }
    }

    showResults(winner, loser, poisonIndex) {
        this.hideAllScreens();
        document.getElementById('result-screen').classList.remove('hidden');
        
        const winnerText = document.getElementById('winner-text');
        const poisonReveal = document.getElementById('poison-reveal');
        const gameSummary = document.getElementById('game-summary');
        const resultIcon = document.querySelector('.result-icon');
        
        // เปลี่ยนไอคอนผลลัพธ์
        if (winner === 1) {
            resultIcon.textContent = '🏆';
        } else {
            resultIcon.textContent = '🎉';
        }
        
        winnerText.innerHTML = `
            <div style="color: #2ed573; margin-bottom: 10px;">🎉 ผู้เล่นคนที่ ${winner} ชนะ! 🎉</div>
            <div style="color: #ff4757; font-size: 1.5rem;">💀 ผู้เล่นคนที่ ${loser} โดนยาพิษ 💀</div>
        `;
        
        poisonReveal.innerHTML = `
            ขนมยาพิษคือ: ${this.sweetEmoji} 
            <strong>(ตำแหน่งที่ ${poisonIndex + 1} จาก ${this.totalSweets})</strong>
        `;
        
        gameSummary.innerHTML = `
            <div style="display: flex; justify-content: space-around; margin-bottom: 15px;">
                <div>
                    <strong>ผู้เล่นคนที่ 1</strong><br>
                    กินไป: ${this.playerEatenCount.player1} ชิ้น
                </div>
                <div>
                    <strong>ผู้เล่นคนที่ 2</strong><br>
                    กินไป: ${this.playerEatenCount.player2} ชิ้น
                </div>
            </div>
            <div style="padding-top: 15px; border-top: 1px solid #ddd;">
                <strong>ความน่าจะเป็นที่จะโดนยาพิษ:</strong> 
                ${((2 / this.totalSweets) * 100).toFixed(1)}%
            </div>
        `;
        
        this.updateStatsDisplay();
    }

    resetGame() {
        this.currentPlayer = 1;
        this.poisonPositions = { player1: -1, player2: -1 };
        this.selectionPhase = 1;
        this.eatenSweets.clear();
        this.gameEnded = false;
        this.playerEatenCount = { player1: 0, player2: 0 };
        this.totalSweets = 0;
        
        // รีเซ็ตสถานะของผู้เล่น
        document.querySelectorAll('.player').forEach(player => {
            player.classList.remove('active', 'dead', 'winner');
            const statusElement = player.querySelector('.status');
            statusElement.innerHTML = '🟢 รอดู';
            statusElement.style.color = '';
        });
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // ซ่อน privacy screen ด้วย
        document.getElementById('privacy-screen').classList.add('hidden');
    }
}

// เริ่มเกมเมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    new PoisonSweetGame();
});

// เพิ่มการจัดการ Service Worker สำหรับ PWA (ถ้าต้องการ)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// เพิ่ม CSS Animation สำหรับ pulse
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);