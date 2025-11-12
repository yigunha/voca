let wasmModule = null;
let selectedMainMenu = null;
let selectedLevel = null;
let gameData = [];
let level = 0;
let currentProblem = null;
let gameState = 'ready';
let gameStartTime = 0;
let randomCheckEnabled = true;
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
        backToLevelSelect();
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
    document.getElementById('mainMenu').classList.remove('hidden');
    selectedMainMenu = null;
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
        
        gameData = selectRandomProblems(unsolvedData);
        
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        
        updateRandomButton();
        resetGame();
    } catch (error) {
        alert(`데이터 파일을 불러올 수 없습니다: ${category}/${levelNum}`);
        console.error(error);
    }
};

function selectRandomProblems(data) {
    if (randomCheckEnabled) {
        return shuffleArray(data);
    } else {
        return data;
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const seed = wasmModule.generate_seed();
        const j = seed % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

window.toggleRandomInGame = function() {
    randomCheckEnabled = !randomCheckEnabled;
    updateRandomButton();
};

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
    usedHintOrAnswer = false;
    
    loadProblem();
    
    document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkAnswer()">정답 확인</button><button class="btn btn-stop" onclick="stopGameManually()">■ 게임 중단</button>';
};

function loadProblem() {
    currentProblem = gameData[level];
    usedHintOrAnswer = false;
    
    currentProblem.currentPicture = null;
    currentProblem.currentAudio = null;
    
    let sentenceHtml = currentProblem.sentence.replace(/\|([^|]+)\|/g, (match, content) => {
        content = content.trim();
        
        if (content.startsWith('<') && content.endsWith('>')) {
            const pictureName = content.slice(1, -1);
            currentProblem.currentPicture = pictureName;
            return '<span class="blank">그림을 보세요</span>';
        }
        
        if (content.startsWith('[') && content.endsWith(']')) {
            const audioName = content.slice(1, -1);
            currentProblem.currentAudio = audioName;
            return '<span class="blank">소리를 들으세요</span>';
        }
        
        return '<span class="blank">정답을 쓰세요</span>';
    });
    
    document.getElementById('sentence').innerHTML = sentenceHtml;
    
    const pictureBtn = document.getElementById('pictureBtn');
    if (currentProblem.currentPicture) {
        pictureBtn.classList.remove('hidden');
    } else {
        pictureBtn.classList.add('hidden');
    }
    
    // 오디오가 있으면 자동으로 플레이어 표시 (듣기 버튼은 숨김)
    const audioToggleBtn = document.getElementById('audioToggleBtn');
    if (currentProblem.currentAudio) {
        audioToggleBtn.classList.add('hidden');  // 듣기 버튼 숨김
        showAudioPlayer();  // 오디오 플레이어 자동 표시
    } else {
        audioToggleBtn.classList.add('hidden');
        hideAudioPlayer();
    }
    
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
    document.getElementById('totalNum').textContent = gameData.length;
    
    hidePicture();
}

window.togglePicture = function() {
    const overlay = document.getElementById('pictureOverlay');
    if (overlay.classList.contains('hidden')) {
        showPicture();
    } else {
        hidePicture();
    }
};

function showPicture() {
    if (!currentProblem || !currentProblem.currentPicture) return;
    
    const overlay = document.getElementById('pictureOverlay');
    const img = document.getElementById('pictureImage');
    
    img.src = `./data_picture/${currentProblem.currentPicture}.jpeg`;
    img.onerror = function() {
        console.error('이미지 로드 실패:', currentProblem.currentPicture);
        alert('이미지를 불러올 수 없습니다.');
        hidePicture();
    };
    overlay.classList.remove('hidden');
}

function hidePicture() {
    const overlay = document.getElementById('pictureOverlay');
    overlay.classList.add('hidden');
}

// 오디오 관련 함수
window.toggleAudioPlayer = function() {
    const player = document.getElementById('audioPlayer');
    if (player.classList.contains('hidden')) {
        showAudioPlayer();
    } else {
        hideAudioPlayer();
    }
};

function showAudioPlayer() {
    if (!currentProblem || !currentProblem.currentAudio) return;
    
    const player = document.getElementById('audioPlayer');
    const audio = document.getElementById('audioElement');
    
    // 오디오 소스 설정
    audio.src = `./data_mp3/${currentProblem.currentAudio}.mp3`;
    
    // 반복 재생 초기 설정 (버튼 상태에 따라)
    const loopBtn = document.getElementById('audioLoopBtn');
    audio.loop = false;  // 기본 loop는 사용하지 않음
    
    // 시작 위치 초기화
    const startTimeSlider = document.getElementById('audioStartTime');
    startTimeSlider.value = 0;
    document.getElementById('startTimeDisplay').textContent = '0.0초';
    
    player.classList.remove('hidden');
    
    // 메타데이터 로드 후 슬라이더 최대값 설정
    audio.addEventListener('loadedmetadata', function() {
        startTimeSlider.max = Math.floor(audio.duration * 10) / 10;
    }, { once: true });
    
    // 반복 재생 이벤트 리스너 추가 (시작 위치로 돌아가기)
    audio.addEventListener('ended', function audioEndedHandler() {
        const loopBtn = document.getElementById('audioLoopBtn');
        if (loopBtn.classList.contains('active')) {
            const startTime = parseFloat(document.getElementById('audioStartTime').value);
            audio.currentTime = startTime;
            audio.play();
        }
    });
    
    // 자동 재생하지 않음 - 사용자가 재생 버튼을 눌러야 함
}

function hideAudioPlayer() {
    const player = document.getElementById('audioPlayer');
    const audio = document.getElementById('audioElement');
    
    audio.pause();
    audio.currentTime = 0;
    player.classList.add('hidden');
}

window.playAudio = function() {
    const audio = document.getElementById('audioElement');
    const startTime = parseFloat(document.getElementById('audioStartTime').value);
    
    audio.currentTime = startTime;
    audio.play();
};

window.pauseAudio = function() {
    const audio = document.getElementById('audioElement');
    audio.pause();
};

window.stopAudio = function() {
    const audio = document.getElementById('audioElement');
    audio.pause();
    
    const startTime = parseFloat(document.getElementById('audioStartTime').value);
    audio.currentTime = startTime;
};

window.toggleAudioLoop = function() {
    const loopBtn = document.getElementById('audioLoopBtn');
    
    loopBtn.classList.toggle('active');
    
    // 버튼 텍스트 업데이트
    if (loopBtn.classList.contains('active')) {
        loopBtn.textContent = '🔁 반복 ON';
    } else {
        loopBtn.textContent = '🔁 반복 OFF';
    }
};

window.updateStartTime = function() {
    const audio = document.getElementById('audioElement');
    const startTime = parseFloat(document.getElementById('audioStartTime').value);
    
    document.getElementById('startTimeDisplay').textContent = startTime.toFixed(1) + '초';
    
    // 슬라이더 이동 시 바로 재생 위치 반영
    const isPlaying = !audio.paused;
    audio.currentTime = startTime;
    
    // 재생 중이었다면 계속 재생
    if (isPlaying) {
        audio.play();
    }
};

window.toggleHint = function() {
    const hintDisplay = document.getElementById('hintDisplay');
    const correctDisplay = document.getElementById('correctAnswerDisplay');
    
    correctDisplay.classList.remove('show');
    
    if (hintDisplay.classList.contains('show')) {
        hintDisplay.classList.remove('show');
    } else {
        hintDisplay.textContent = `💡 힌트: ${currentProblem.hint}`;
        hintDisplay.classList.add('show');
        usedHintOrAnswer = true;
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
        usedHintOrAnswer = true;
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
        if (!usedHintOrAnswer) {
            solvedProblems.add(currentProblem.id);
            saveSolvedProblems();
        }
        
        messageEl.textContent = '🎉 정답입니다!';
        messageEl.className = 'message success show';
        
        setTimeout(() => {
            messageEl.classList.remove('show');
            
            if (level < gameData.length - 1) {
                level++;
                gameStartTime = Date.now();
                loadProblem();
            } else {
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
        
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 500);
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
    
    // 초기화 추가
    document.getElementById('sentence').innerHTML = '';
    document.getElementById('optDescription').style.display = 'none';
    document.getElementById('optionsGrid').innerHTML = '';
    document.getElementById('conditionText').style.display = 'none';
    
    document.getElementById('levelNum').textContent = '1';
    document.getElementById('totalNum').textContent = gameData.length;
    document.getElementById('buttons').innerHTML = '<button class="btn btn-start" onclick="startGame()">▶ 게임 시작</button>';
    document.getElementById('answerInput').value = '';
    document.getElementById('hintDisplay').classList.remove('show');
    document.getElementById('correctAnswerDisplay').classList.remove('show');
    document.getElementById('contentSection').classList.remove('hidden');
    
    // 미디어 요소 숨김 및 초기화
    hidePicture();
    hideAudioPlayer();
    
    // 버튼들도 숨김
    document.getElementById('pictureBtn').classList.add('hidden');
    document.getElementById('audioToggleBtn').classList.add('hidden');
    
    // 메시지 숨김
    document.getElementById('message').classList.remove('show');
}

window.backToLevelSelect = function() {
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('levelSelector').classList.remove('hidden');
    selectedLevel = null;
    gameData = [];
    resetGame();
};

document.addEventListener('keydown', function(event) {
    if (gameState !== 'playing') return;
    
    const answerInput = document.getElementById('answerInput');
    if (document.activeElement === answerInput) {
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