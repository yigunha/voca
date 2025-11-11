let wasmModule = null;
let selectedLevel = null;
let gameData = [];
let level = 0;
let currentProblem = null;
let gameState = 'ready';
let gameStartTime = 0;
let randomCheckEnabled = true; // 랜덤 체크 기본값 ON

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
            window.location.href = '../munpup.html';
            return false;
        }
        
        wasmModule.refresh_cookies();
        return true;
    } catch (error) {
        console.error('로그인 확인 실패:', error);
        window.location.href = '../munpup.html';
        return false;
    }
}

window.logout = function() {
    if (wasmModule) {
        wasmModule.delete_cookie('studentName');
        wasmModule.delete_cookie('studentClass');
        wasmModule.delete_cookie('studentPassword');
    }
    window.location.href = '../munpup.html?logout=true';
};

async function loadEncryptedData(levelName) {
    try {
        const response = await fetch(`./data/${levelName}_encrypted.dat`);
        const encryptedBytes = new Uint8Array(await response.arrayBuffer());
        
        const decryptedJson = wasmModule.decrypt_xor(encryptedBytes);
        const fullData = JSON.parse(decryptedJson);
        
        return fullData;
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        throw error;
    }
}

window.selectLevel = async function(levelName) {
    selectedLevel = levelName;
    
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.target.classList.add('selected');

    try {
        // 랜덤 체크박스 상태 확인
        const randomCheckbox = document.getElementById('randomCheckbox');
        randomCheckEnabled = randomCheckbox.checked;
        
        const data = await loadEncryptedData(levelName);
        gameData = selectRandomProblems(data);
        
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        
        // 게임 화면의 랜덤 버튼 상태 업데이트
        updateRandomButton();
        
        resetGame();
    } catch (error) {
        alert(`데이터 파일을 불러올 수 없습니다: ${levelName}`);
        console.error(error);
    }
};

function selectRandomProblems(data) {
    // 각 그룹에서 첫 번째 문제만 선택 (나중에 그룹 내 랜덤은 자동 적용 예정)
    let selectedProblems = data.map(group => group.problems[0]);
    
    if (randomCheckEnabled) {
        // 랜덤 ON: 그룹 순서를 랜덤하게 섞음
        return shuffleArray(selectedProblems);
    } else {
        // 랜덤 OFF: 원본 순서 그대로
        return selectedProblems;
    }
}

// Fisher-Yates 셔플 알고리즘
function shuffleArray(array) {
    const shuffled = [...array]; // 원본 배열 복사
    for (let i = shuffled.length - 1; i > 0; i--) {
        const seed = wasmModule.generate_seed();
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// 게임 중 랜덤 토글 함수
window.toggleRandomInGame = function() {
    randomCheckEnabled = !randomCheckEnabled;
    updateRandomButton();
};

// 랜덤 버튼 상태 업데이트 함수
function updateRandomButton() {
    const btn = document.getElementById('randomToggleBtn');
    if (btn) {
        if (randomCheckEnabled) {
            btn.textContent = '랜덤 ON';
            btn.classList.remove('off');
        } else {
            btn.textContent = '랜덤 OFF';
            btn.classList.add('off');
        }
    }
}

window.startGame = function() {
    if (gameData.length === 0) return;
    
    gameState = 'playing';
    gameStartTime = Date.now();
    
    loadProblem();
    
    document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkAnswer()">정답 확인</button><button class="btn btn-stop" onclick="stopGameManually()">■ 게임 중단</button>';
};

function loadProblem() {
    currentProblem = gameData[level];
    
    document.getElementById('sentence').innerHTML = currentProblem.sentence.replace(/\(_+\)/g, '<span class="blank">정답을 쓰세요</span>');
    
    const optDesc = document.getElementById('optDescription');
    if (currentProblem.opt) {
        optDesc.textContent = currentProblem.opt;
        optDesc.style.display = 'block';
    } else {
        optDesc.style.display = 'none';
    }
    
    const optionsGrid = document.getElementById('optionsGrid');
    optionsGrid.innerHTML = '';
    if (currentProblem.options && currentProblem.options.length > 0) {
        currentProblem.options.forEach((option, index) => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.textContent = `${index + 1}) ${option}`;
            optionsGrid.appendChild(div);
        });
    }
    
    const conditionText = document.getElementById('conditionText');
    if (currentProblem.condition) {
        conditionText.textContent = currentProblem.condition;
        conditionText.style.display = 'block';
    } else {
        conditionText.style.display = 'none';
    }
    
    document.getElementById('answerInput').value = '';
    document.getElementById('answerInput').focus();
    document.getElementById('hintDisplay').classList.remove('show');
    document.getElementById('correctAnswerDisplay').classList.remove('show');
    document.getElementById('levelNum').textContent = level + 1;
}

window.toggleHint = function() {
    const hintDisplay = document.getElementById('hintDisplay');
    const correctDisplay = document.getElementById('correctAnswerDisplay');
    
    correctDisplay.classList.remove('show');
    
    if (hintDisplay.classList.contains('show')) {
        hintDisplay.classList.remove('show');
    } else {
        hintDisplay.textContent = `💡 힌트: ${currentProblem.hint}`;
        hintDisplay.classList.add('show');
    }
};

window.toggleCorrectAnswer = function() {
    const correctDisplay = document.getElementById('correctAnswerDisplay');
    const hintDisplay = document.getElementById('hintDisplay');
    
    hintDisplay.classList.remove('show');
    
    if (correctDisplay.classList.contains('show')) {
        correctDisplay.classList.remove('show');
    } else {
        correctDisplay.textContent = `✅ 정답: ${currentProblem.answer.join(' 또는 ')}`;
        correctDisplay.classList.add('show');
    }
};

window.checkAnswer = function() {
    if (gameState !== 'playing') return;
    
    const userAnswer = document.getElementById('answerInput').value.trim();
    
    if (!userAnswer) {
        alert('답을 입력해주세요.');
        return;
    }
    
    const isCorrect = currentProblem.answer.some(ans => 
        userAnswer.toLowerCase() === ans.toLowerCase()
    );
    
    const messageEl = document.getElementById('message');
    
    if (isCorrect) {
        const elapsedSeconds = Math.floor((Date.now() - gameStartTime) / 1000);
        
        messageEl.textContent = '🎉 정답입니다!';
        messageEl.className = 'message success show';
        
        // 정답일 때: 0.5초 후 자동으로 다음 문제로 이동
        setTimeout(() => {
            messageEl.classList.remove('show');
            
            if (level < gameData.length - 1) {
                level++;
                gameStartTime = Date.now();
                loadProblem();
            } else {
                // 게임 완료 시: 클릭으로만 닫기
                let studentName = '학생';
                try {
                    studentName = wasmModule.get_cookie('studentName');
                } catch (e) {}
                
                messageEl.innerHTML = `🏆 ${studentName}<br>축하합니다!`;
                messageEl.className = 'message success show';
                gameState = 'complete';
                
                messageEl.onclick = () => {
                    messageEl.classList.remove('show');
                    messageEl.onclick = null;
                    showButtons();
                };
            }
        }, 500);
    } else {
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        
        // 오답일 때: 클릭으로 닫기
        messageEl.onclick = () => {
            messageEl.classList.remove('show');
            messageEl.onclick = null;
        };
    }
};

window.stopGameManually = function() {
    gameState = 'stopped';
    showButtons();
};

function showButtons() {
    const buttonsEl = document.getElementById('buttons');
    buttonsEl.innerHTML = `
        <button class="btn btn-reset" onclick="backToLevelSelect()">레벨 선택</button>
        <button class="btn btn-start" onclick="startGame()">▶ 다시 시도</button>
        <button class="btn btn-stop" onclick="logout()">로그아웃</button>
    `;
}

function resetGame() {
    level = 0;
    gameState = 'ready';
    
    document.getElementById('levelNum').textContent = '1';
    document.getElementById('buttons').innerHTML = '<button class="btn btn-start" onclick="startGame()">▶ 게임 시작</button>';
    document.getElementById('answerInput').value = '';
    document.getElementById('hintDisplay').classList.remove('show');
    document.getElementById('correctAnswerDisplay').classList.remove('show');
    document.getElementById('contentSection').classList.remove('hidden');
}

window.backToLevelSelect = function() {
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('levelSelector').classList.remove('hidden');
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    selectedLevel = null;
    gameData = [];
    resetGame();
};

// 키보드 이벤트 리스너 추가 (엔터로 정답 확인)
document.addEventListener('keydown', function(event) {
    // 게임이 진행 중일 때만
    if (gameState !== 'playing') return;
    
    // 입력창에 포커스가 있을 때
    const answerInput = document.getElementById('answerInput');
    if (document.activeElement === answerInput) {
        // 엔터키만
        if (event.key === 'Enter') {
            event.preventDefault();
            checkAnswer();
        }
    }
});

window.addEventListener('load', async () => {
    const wasmReady = await initWasm();
    if (!wasmReady) return;
    
    if (!checkLogin()) return;
    
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('gameContent').classList.remove('hidden');
});