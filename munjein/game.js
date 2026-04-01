let wasmModule = null;
let selectedMainMenu = null;
let selectedLevel = null;
let gameData = [];
let level = 0; 
let currentProblem = null;
let gameState = 'ready';
let userClass = '';
let solvedProblems = new Set();

async function initWasm() {
    try {
        const wasm = await import('./pkg/korean_game_wasm.js');
        await wasm.default();
        wasmModule = wasm;
        if (!wasm.verify_location()) return false;
        return true;
    } catch (e) { return false; }
}

function checkLogin() {
    if (!wasmModule) return false;
    try {
        if (!wasmModule.check_login_status()) { window.location.href = '../munjein.html'; return false; }
        const fullClass = wasmModule.get_cookie('studentClass');
        userClass = fullClass.substring(0, 2);
        document.getElementById('mainMenuTitle').textContent = `${userClass} 학습 모드 선택`;
        const saved = localStorage.getItem(`solved_${userClass}`);
        if (saved) solvedProblems = new Set(JSON.parse(saved));
        return true;
    } catch (e) { return false; }
}

window.selectMainMenu = function(menu) {
    selectedMainMenu = menu;
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('levelSelector').classList.remove('hidden');
    document.getElementById('levelTitle').textContent = `${userClass} ${menu}`;
    const container = document.getElementById('levelButtons');
    container.innerHTML = '';
    for (let i = 1; i <= 12; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.textContent = `${i}과`;
        btn.onclick = () => selectLevel(menu, String(i).padStart(2, '0'));
        container.appendChild(btn);
    }
};

async function selectLevel(category, levelNum) {
    selectedLevel = levelNum;
    try {
        const fileName = `${userClass}/${category}/${levelNum}_encrypted.dat`;
        const response = await fetch(`./data/${fileName}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        gameData = JSON.parse(wasmModule.decrypt_xor(bytes));
        
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        
        level = 0; 
        updateProblemDropdown(); 
        resetGame();
    } catch (e) { alert('데이터 로드 실패'); }
}

// 문제 번호 드롭다운 갱신
function updateProblemDropdown() {
    const select = document.getElementById('problemSelect');
    select.innerHTML = '';
    gameData.forEach((_, index) => {
        const opt = new Option(index + 1, index);
        opt.selected = (index === level);
        select.add(opt);
    });
    document.getElementById('totalNum').textContent = gameData.length;
}

// 특정 문제로 이동
window.jumpToProblem = function() {
    const select = document.getElementById('problemSelect');
    level = parseInt(select.value);
    hideAudioPlayer();
    loadProblem();
    if(gameState === 'ready') startGame();
};

window.startGame = function() {
    gameState = 'playing';
    loadProblem();
    document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkAnswer()">확인</button><button class="btn btn-stop" onclick="stopGameManually()">중단</button>';
};

function loadProblem() {
    currentProblem = gameData[level];
    document.getElementById('sentence').innerHTML = currentProblem.sentence.replace(/\|([^|]+)\|/g, '<span class="blank">정답 입력</span>');
    
    if (currentProblem.sentence.includes('[') || currentProblem.currentAudio) showAudioPlayer();
    else hideAudioPlayer();
    
    updateProblemDropdown(); 
}

function showAudioPlayer() {
    const player = document.getElementById('audioPlayer');
    const audio = document.getElementById('audioElement');
    audio.src = `./data_mp3/${currentProblem.id}.mp3`; 
    player.classList.remove('hidden');
    audio.onloadedmetadata = () => {
        const d = audio.duration;
        document.getElementById('audioStartTime').max = d;
        document.getElementById('audioEndTime').max = d;
        document.getElementById('audioEndTime').value = d;
        document.getElementById('endTimeDisplay').textContent = d.toFixed(1);
        updateAudioSpeed(); 
    };
}

function hideAudioPlayer() {
    document.getElementById('audioPlayer').classList.add('hidden');
    document.getElementById('audioElement').pause();
}

window.playAudio = () => document.getElementById('audioElement').play();
window.stopAudio = () => {
    const a = document.getElementById('audioElement');
    a.pause();
    a.currentTime = parseFloat(document.getElementById('audioStartTime').value);
};

window.updateAudioSpeed = () => {
    document.getElementById('audioElement').playbackRate = parseFloat(document.getElementById('speedSelect').value);
};

window.updateStartTime = () => {
    const a = document.getElementById('audioElement');
    const v = parseFloat(document.getElementById('audioStartTime').value);
    document.getElementById('startTimeDisplay').textContent = v.toFixed(1);
    a.currentTime = v;
};

window.updateEndTime = () => {
    document.getElementById('endTimeDisplay').textContent = parseFloat(document.getElementById('audioEndTime').value).toFixed(1);
};

window.toggleAudioLoop = () => {
    const b = document.getElementById('audioLoopBtn');
    b.classList.toggle('active');
    b.textContent = b.classList.contains('active') ? '🔁 반복 ON' : '🔁 반복 OFF';
};

window.checkAnswer = function() {
    const userAns = document.getElementById('answerInput').value.trim();
    const isCorrect = currentProblem.answer.includes(userAns);
    const msg = document.getElementById('message');
    msg.textContent = isCorrect ? '🎉 정답!' : '❌ 오답!';
    msg.className = `message ${isCorrect ? 'success' : 'fail'} show`;
    setTimeout(() => {
        msg.classList.remove('show');
        if (isCorrect) {
            if (level < gameData.length - 1) { level++; loadProblem(); }
            else { alert('완료!'); backToMainMenu(); }
        }
    }, 1000);
};

window.backToMainMenu = function() {
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    gameState = 'ready';
    hideAudioPlayer();
};

window.stopGameManually = () => { gameState = 'stopped'; hideAudioPlayer(); backToMainMenu(); };

window.addEventListener('load', async () => {
    if (await initWasm() && checkLogin()) {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('gameContent').classList.remove('hidden');
    }
    const audio = document.getElementById('audioElement');
    audio.addEventListener('timeupdate', () => {
        const s = parseFloat(document.getElementById('audioStartTime').value);
        const e = parseFloat(document.getElementById('audioEndTime').value);
        if (audio.currentTime >= e) {
            if (document.getElementById('audioLoopBtn').classList.contains('active')) {
                audio.currentTime = s;
                audio.play();
            } else {
                audio.pause();
                audio.currentTime = s;
            }
        }
    });
});