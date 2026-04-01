let wasmModule = null;
let selectedMainMenu = null;
let selectedLevel = null;
let gameData = [];
let level = 0;
let currentProblem = null;
let gameState = 'ready';
let userClass = '';
let solvedProblems = new Set();
let usedHintOrAnswer = false;

async function initWasm() {
    try {
        const wasm = await import('./pkg/korean_game_wasm.js');
        await wasm.default();
        wasmModule = wasm;
        if (!wasm.verify_location()) {
            document.body.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">⚠️ 인증되지 않은 위치입니다.</div>';
            throw new Error('Unauthorized');
        }
        return true;
    } catch (error) {
        console.error('WASM 실패:', error);
        return false;
    }
}

function checkLogin() {
    if (!wasmModule) return false;
    try {
        if (!wasmModule.check_login_status()) {
            window.location.href = '../munjein.html'; 
            return false;
        }
        wasmModule.refresh_cookies();
        const fullClass = wasmModule.get_cookie('studentClass');
        userClass = fullClass.substring(0, 2);
        document.getElementById('mainMenuTitle').textContent = `${userClass} 학습 모드 선택`;
        loadSolvedProblems();
        return true;
    } catch (e) {
        window.location.href = '../munjein.html';
        return false;
    }
}

function loadSolvedProblems() {
    const saved = localStorage.getItem(`solved_${userClass}`);
    if (saved) solvedProblems = new Set(JSON.parse(saved));
}

function saveSolvedProblems() {
    localStorage.setItem(`solved_${userClass}`, JSON.stringify([...solvedProblems]));
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

window.backToMainMenu = function() {
    document.getElementById('levelSelector').classList.add('hidden');
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    resetGame();
};

async function selectLevel(category, levelNum) {
    selectedLevel = levelNum;
    try {
        const fileName = `${userClass}/${category}/${levelNum}_encrypted.dat`;
        const response = await fetch(`./data/${fileName}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const data = JSON.parse(wasmModule.decrypt_xor(bytes));
        
        gameData = data.filter(item => !solvedProblems.has(item.id));
        if (gameData.length === 0) {
            alert('이미 모든 문제를 완료했습니다!');
            return;
        }
        
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        updateLessonDropdown();
        resetGame();
    } catch (e) {
        alert('데이터 로드 실패');
    }
}

window.changeLesson = () => {
    const val = document.getElementById('lessonSelect').value;
    if (val !== selectedLevel) selectLevel(selectedMainMenu, val);
};

function updateLessonDropdown() {
    const select = document.getElementById('lessonSelect');
    select.innerHTML = '';
    for(let i=1; i<=12; i++){
        const val = String(i).padStart(2, '0');
        const opt = new Option(`${i}과`, val);
        opt.selected = (val === selectedLevel);
        select.add(opt);
    }
}

window.startGame = function() {
    gameState = 'playing';
    loadProblem();
    document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkAnswer()">확인</button><button class="btn btn-stop" onclick="stopGameManually()">중단</button>';
};

function loadProblem() {
    currentProblem = gameData[level];
    usedHintOrAnswer = false;
    
    // 기본 Sentence 처리
    document.getElementById('sentence').innerHTML = currentProblem.sentence.replace(/\|([^|]+)\|/g, '<span class="blank">정답 입력</span>');
    
    // 오디오 설정
    if (currentProblem.sentence.includes('[') || currentProblem.currentAudio) {
        showAudioPlayer();
    } else {
        hideAudioPlayer();
    }
    
    document.getElementById('levelNum').textContent = level + 1;
    document.getElementById('totalNum').textContent = gameData.length;
}

function showAudioPlayer() {
    const player = document.getElementById('audioPlayer');
    const audio = document.getElementById('audioElement');
    // 실제 데이터 구조에 맞춰 오디오 경로 설정 필요
    audio.src = `./data_mp3/${currentProblem.id}.mp3`; 
    player.classList.remove('hidden');
    
    audio.onloadedmetadata = () => {
        const duration = audio.duration;
        document.getElementById('audioStartTime').max = duration;
        document.getElementById('audioEndTime').max = duration;
        document.getElementById('audioEndTime').value = duration;
        document.getElementById('endTimeDisplay').textContent = duration.toFixed(1) + 's';
    };
}

function hideAudioPlayer() {
    document.getElementById('audioPlayer').classList.add('hidden');
    document.getElementById('audioElement').pause();
}

window.playAudio = () => document.getElementById('audioElement').play();
window.stopAudio = () => {
    const audio = document.getElementById('audioElement');
    audio.pause();
    audio.currentTime = parseFloat(document.getElementById('audioStartTime').value);
};

window.updateAudioSpeed = () => {
    const audio = document.getElementById('audioElement');
    audio.playbackRate = parseFloat(document.getElementById('speedSelect').value);
};

window.updateStartTime = () => {
    const audio = document.getElementById('audioElement');
    const val = parseFloat(document.getElementById('audioStartTime').value);
    document.getElementById('startTimeDisplay').textContent = val.toFixed(1) + 's';
    audio.currentTime = val;
};

window.updateEndTime = () => {
    const val = parseFloat(document.getElementById('audioEndTime').value);
    document.getElementById('endTimeDisplay').textContent = val.toFixed(1) + 's';
};

window.toggleAudioLoop = () => {
    const btn = document.getElementById('audioLoopBtn');
    btn.classList.toggle('active');
    btn.textContent = btn.classList.contains('active') ? '🔁 반복 ON' : '🔁 반복 OFF';
};

function resetGame() {
    level = 0;
    gameState = 'ready';
    document.getElementById('buttons').innerHTML = '<button class="btn btn-start" onclick="startGame()">▶ 게임 시작</button>';
    hideAudioPlayer();
}

window.checkAnswer = function() {
    const userAns = document.getElementById('answerInput').value.trim();
    const isCorrect = currentProblem.answer.includes(userAns);
    const msg = document.getElementById('message');
    
    msg.textContent = isCorrect ? '🎉 정답!' : '❌ 오답!';
    msg.className = `message ${isCorrect ? 'success' : 'fail'} show`;
    
    setTimeout(() => {
        msg.classList.remove('show');
        if (isCorrect) {
            if (level < gameData.length - 1) {
                level++;
                loadProblem();
            } else {
                alert('모든 문제를 풀었습니다!');
                backToMainMenu();
            }
        }
    }, 1000);
};

window.addEventListener('load', async () => {
    if (await initWasm() && checkLogin()) {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('gameContent').classList.remove('hidden');
    }
    
    // A-B 구간 반복 로직
    const audio = document.getElementById('audioElement');
    audio.addEventListener('timeupdate', () => {
        const start = parseFloat(document.getElementById('audioStartTime').value);
        const end = parseFloat(document.getElementById('audioEndTime').value);
        const loop = document.getElementById('audioLoopBtn').classList.contains('active');
        
        if (audio.currentTime >= end) {
            if (loop) {
                audio.currentTime = start;
                audio.play();
            } else {
                audio.pause();
                audio.currentTime = start;
            }
        }
    });
});