let wasmModule = null;
let selectedMainMenu = null;
let selectedLevel = null;
let gameData = [];
let level = 0;
let currentProblem = null;
let gameState = 'ready';
let gameStartTime = 0;
let userClass = '';
let solvedProblems = new Set();
let usedHintOrAnswer = false;

async function initWasm() {
    try {
        const wasm = await import('./pkg/korean_game_wasm.js');
        await wasm.default();
        wasmModule = wasm;
        console.log('WASM 초기화:', wasm.get_version());
        
        if (!wasm.verify_location()) {
            document.body.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">⚠️ 인증되지 않은 위치입니다.<br>이 페이지는 허가된 위치에서만 실행할 수 있습니다.</div>';
            throw new Error('Unauthorized location');
        }
        
        return true;
    } catch (error) {
        console.error('WASM 로드 실패:', error);
        alert('시스템을 초기화할 수 없습니다.');
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
        
        const mainMenuTitle = document.getElementById('mainMenuTitle');
        if (mainMenuTitle) {
            mainMenuTitle.textContent = `${userClass} 학습 모드 선택`;
        }
        
        loadSolvedProblems();
        
        return true;
    } catch (error) {
        console.error('로그인 확인 실패:', error);
        window.location.href = '../munjein.html';
        return false;
    }
}

function loadSolvedProblems() {
    try {
        const saved = localStorage.getItem(`solved_${userClass}`);
        if (saved) {
            solvedProblems = new Set(JSON.parse(saved));
        }
    } catch (e) {
        console.error('해결한 문제 로드 실패:', e);
    }
}

function saveSolvedProblems() {
    try {
        localStorage.setItem(`solved_${userClass}`, JSON.stringify([...solvedProblems]));
    } catch (e) {
        console.error('해결한 문제 저장 실패:', e);
    }
}

function resetSolvedProblems() {
    if (confirm('모든 학습 기록을 초기화하시겠습니까?')) {
        solvedProblems.clear();
        saveSolvedProblems();
        alert('학습 기록이 초기화되었습니다.');
        backToMainMenu();
    }
}

window.logout = function() {
    if (wasmModule) {
        try {
            wasmModule.delete_cookie('studentName');
            wasmModule.delete_cookie('studentClass');
            wasmModule.delete_cookie('studentPassword');
        } catch (e) {
            console.error('로그아웃 오류:', e);
        }
    }
    window.location.href = '../munjein.html?logout=true'; 
};

window.selectMainMenu = function(menu) {
    selectedMainMenu = menu;
    
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('levelSelector').classList.remove('hidden');
    
    document.getElementById('levelTitle').textContent = `${userClass} ${menu}`;
    
    const levelButtonsContainer = document.getElementById('levelButtons');
    levelButtonsContainer.innerHTML = '';
    
    for (let i = 1; i <= 12; i++) {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.textContent = `${i}과`;
        btn.onclick = () => selectLevel(menu, String(i).padStart(2, '0'));
        levelButtonsContainer.appendChild(btn);
    }
};

window.backToMainMenu = function() {
    document.getElementById('levelSelector').classList.add('hidden');
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    selectedMainMenu = null;
    selectedLevel = null;
    gameData = [];
    resetGame();
};

async function loadEncryptedData(category, levelNum) {
    try {
        const fileName = `${userClass}/${category}/${levelNum}_encrypted.dat`;
        const response = await fetch(`./data/${fileName}`);
        const encryptedBytes = new Uint8Array(await response.arrayBuffer());
        
        const decryptedJson = wasmModule.decrypt_xor(encryptedBytes);
        const fullData = JSON.parse(decryptedJson);
        
        return fullData;
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        throw error;
    }
}

window.selectLevel = async function(category, levelNum) {
    selectedLevel = levelNum;

    try {
        const data = await loadEncryptedData(category, levelNum);
        
        const unsolvedData = data.filter(item => !solvedProblems.has(item.id));
        
        if (unsolvedData.length === 0) {
            if (confirm('모든 문제를 해결했습니다! 학습 기록을 초기화하시겠습니까?')) {
                resetSolvedProblems();
            }
            return;
        }
        
        gameData = unsolvedData;
        
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        
        resetGame();
    } catch (error) {
        alert(`데이터 파일을 불러올 수 없습니다: ${category}/${levelNum}`);
        console.error(error);
    }
};

window.startGame = function() {
    if (gameData.length === 0) return;
    
    gameState = 'playing';
    gameStartTime = Date.now();
    usedHintOrAnswer = false;
    
    loadProblem();
    
    const currentProblem = gameData[level];
    
    // jimuns 모드 확인
    if (isJimunsMode(currentProblem)) {
        document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkJimunsAnswer()">정답 확인</button><button class="btn btn-stop" onclick="stopGameManually()">▢ 게임 중단</button>';
    } else if (currentProblem.number && currentProblem.number.length > 0) {
        document.getElementById('buttons').innerHTML = '<button class="btn btn-stop" onclick="stopGameManually()">▢ 게임 중단</button>';
    } else {
        document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkAnswer()">정답 확인</button><button class="btn btn-stop" onclick="stopGameManually()">▢ 게임 중단</button>';
    }
};

// [추가] 문제 번호 드롭다운 업데이트 함수
function updateProblemDropdown() {
    const select = document.getElementById('problemSelect');
    if (!select) return;
    select.innerHTML = '';
    gameData.forEach((_, index) => {
        const opt = new Option(index + 1, index);
        if (index === level) opt.selected = true;
        select.add(opt);
    });
}

// [추가] 특정 문제로 바로 점프하는 함수
window.jumpToProblem = function() {
    const select = document.getElementById('problemSelect');