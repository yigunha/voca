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
    
    document.getElementById('buttons').innerHTML = '<button class="btn btn-submit" onclick="checkAnswer()">정답 확인</button><button class="btn btn-stop" onclick="stopGameManually()">■ 게임 중단</button>';
};

function loadProblem() {
    currentProblem = gameData[level];
    usedHintOrAnswer = false;
    
    currentProblem.currentPicture = null;
    currentProblem.currentAudio = null;
    currentProblem.currentPassage = null;
    
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
        
        if (content.startsWith('{') && content.endsWith('}')) {
            const passageName = content.slice(1, -1);
            currentProblem.currentPassage = passageName;
            return '<span class="blank">지문을 보세요</span>';
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
    
    const passageBtn = document.getElementById('passageBtn');
    if (currentProblem.currentPassage) {
        passageBtn.classList.remove('hidden');
    } else {
        passageBtn.classList.add('hidden');
    }
    
    const audioToggleBtn = document.getElementById('audioToggleBtn');
    if (currentProblem.currentAudio) {
        audioToggleBtn.classList.add('hidden');
        showAudioPlayer();
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
    document.getElementById('comparisonDisplay').classList.remove('show');
    document.getElementById('levelNum').textContent = level + 1;
    document.getElementById('totalNum').textContent = gameData.length;
    
    window.hidePicture();
    window.hidePassage();
}

window.togglePicture = function() {
    const overlay = document.getElementById('pictureOverlay');
    if (overlay.classList.contains('hidden')) {
        window.showPicture();
    } else {
        window.hidePicture();
    }
};

window.showPicture = function() {
    if (!currentProblem || !currentProblem.currentPicture) return;
    
    const overlay = document.getElementById('pictureOverlay');
    const img = document.getElementById('pictureImage');
    
    // 이전 핸들러 제거
    img.onerror = null;
    img.src = '';
    
    // .jpg로 먼저 시도
    const jpgPath = `./data_picture/${currentProblem.currentPicture}.jpg`;
    
    img.onerror = function() {
        // .jpg 실패시 .jpeg로 재시도
        const jpegPath = `./data_picture/${currentProblem.currentPicture}.jpeg`;
        
        // 두 번째 onerror 핸들러를 먼저 설정
        img.onerror = function() {
            console.error('이미지 로드 실패:', currentProblem.currentPicture);
            alert(`이미지를 불러올 수 없습니다.\n파일명: ${currentProblem.currentPicture}`);
            window.hidePicture();
        };
        
        // 핸들러 설정 후 src 변경
        img.src = jpegPath;
    };
    
    img.src = jpgPath;
    overlay.classList.remove('hidden');
}

window.hidePicture = function() {
    const overlay = document.getElementById('pictureOverlay');
    const img = document.getElementById('pictureImage');
    
    // 핸들러 제거
    img.onerror = null;
    img.src = '';
    
    overlay.classList.add('hidden');
};

window.togglePassage = function() {
    const overlay = document.getElementById('passageOverlay');
    if (overlay.classList.contains('hidden')) {
        window.showPassage();
    } else {
        window.hidePassage();
    }
};

window.showPassage = function() {
    if (!currentProblem || !currentProblem.currentPassage) return;
    
    const overlay = document.getElementById('passageOverlay');
    const content = document.getElementById('passageContent');
    
    content.textContent = currentProblem.currentPassage;
    
    overlay.classList.remove('hidden');
}

window.hidePassage = function() {
    const overlay = document.getElementById('passageOverlay');
    overlay.classList.add('hidden');
}

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
    
    audio.src = `./data_mp3/${currentProblem.currentAudio}.mp3`;
    
    const loopBtn = document.getElementById('audioLoopBtn');
    audio.loop = false;
    
    const startTimeSlider = document.getElementById('audioStartTime');
    startTimeSlider.value = 0;
    document.getElementById('startTimeDisplay').textContent = '0.0초';
    
    player.classList.remove('hidden');
    
    audio.addEventListener('loadedmetadata', function() {
        startTimeSlider.max = Math.floor(audio.duration * 10) / 10;
    }, { once: true });
    
    audio.addEventListener('ended', function audioEndedHandler() {
        const loopBtn = document.getElementById('audioLoopBtn');
        if (loopBtn.classList.contains('active')) {
            const startTime = parseFloat(document.getElementById('audioStartTime').value);
            audio.currentTime = startTime;
            audio.play();
        }
    });
}

function hideAudioPlayer() {
    const player = document.getElementById('audioPlayer');
    const audio = document.getElementById('audioElement');
    
    audio.pause();
    audio.currentTime = 0;
    
    audio.onended = null;
    
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
    
    const isPlaying = !audio.paused;
    audio.currentTime = startTime;
    
    if (isPlaying) {
        audio.play();
    }
};

window.toggleHint = function() {
    const hintDisplay = document.getElementById('hintDisplay');
    const correctDisplay = document.getElementById('correctAnswerDisplay');
    const comparisonDisplay = document.getElementById('comparisonDisplay');
    
    correctDisplay.classList.remove('show');
    comparisonDisplay.classList.remove('show');
    
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
        correctDisplay.textContent = `${currentProblem.answer[0]}`;
        correctDisplay.classList.add('show');
        usedHintOrAnswer = true;
    }
};

// 문자열 비교 함수 (띄어쓰기 포함)
function compareStrings(userAnswer, correctAnswer) {
    const maxLen = Math.max(userAnswer.length, correctAnswer.length);
    let result = '';
    
    for (let i = 0; i < maxLen; i++) {
        const userChar = userAnswer[i] || '';
        const correctChar = correctAnswer[i] || '';
        
        if (userChar === correctChar) {
            // 같은 문자
            if (userChar === ' ') {
                // 띄어쓰기가 맞을 때는 [] 표시
                result += `<span class="diff-space-correct">[ ]</span>`;
            } else {
                // 일반 문자가 맞을 때는 ✓ 표시
                result += `<span class="diff-correct">✓</span>`;
            }
        } else if (userChar && !correctChar) {
            // 사용자가 더 많이 입력함 (분홍색)
            if (userChar === ' ') {
                result += `<span class="diff-extra">[ ]</span>`;
            } else {
                result += `<span class="diff-extra">${userChar}</span>`;
            }
        } else if (!userChar && correctChar) {
            // 사용자가 덜 입력함 (파란색으로 누락 표시)
            if (correctChar === ' ') {
                result += `<span class="diff-missing">[ ]</span>`;
            } else {
                result += `<span class="diff-missing">[${correctChar}]</span>`;
            }
        } else {
            // 다른 문자 (빨간색)
            if (userChar === ' ') {
                result += `<span class="diff-wrong">[ ]</span>`;
            } else if (correctChar === ' ') {
                // 띄어쓰기를 잘못 입력했을 때
                result += `<span class="diff-wrong">${userChar}</span>`;
            } else {
                result += `<span class="diff-wrong">${userChar}</span>`;
            }
        }
    }
    
    return result;
}

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
    const comparisonDisplay = document.getElementById('comparisonDisplay');
    const correctDisplay = document.getElementById('correctAnswerDisplay');
    
    if (isCorrect) {
        if (!usedHintOrAnswer) {
            solvedProblems.add(currentProblem.id);
            saveSolvedProblems();
        }
        
        messageEl.textContent = '🎉 정답입니다!';
        messageEl.className = 'message success show';
        comparisonDisplay.classList.remove('show');
        correctDisplay.classList.remove('show');
        
        setTimeout(() => {
            messageEl.classList.remove('show');
            
            if (level < gameData.length - 1) {
                level++;
                gameStartTime = Date.now();
                loadProblem();
            } else {
                hideAudioPlayer();
                
                let studentName = '학생';
                try {
                    studentName = wasmModule.get_cookie('studentName');
                } catch (e) {}
                
                const completionInfo = `${userClass} ${selectedMainMenu} ${selectedLevel}과`;
                
                messageEl.innerHTML = `🏆 ${studentName}<br>${completionInfo}<br>축하합니다!`;
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
        // 틀렸을 때 usedHintOrAnswer를 true로 설정
        usedHintOrAnswer = true;
        
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        
        // 정답과 비교 (trim 하지 않고 원본 그대로 비교)
        const userAnswerFull = document.getElementById('answerInput').value;
        const correctAnswer = currentProblem.answer[0];
        const comparison = compareStrings(userAnswerFull, correctAnswer);
        
        comparisonDisplay.innerHTML = `
            <div style="margin-bottom: 8px;">${comparison}</div>
        `;
        comparisonDisplay.classList.add('show');
        
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 500);
    }
};

window.stopGameManually = function() {
    gameState = 'stopped';
    hideAudioPlayer();
    showButtons();
};

function showButtons() {
    const buttonsEl = document.getElementById('buttons');
    buttonsEl.innerHTML = `
        <button class="btn btn-reset" onclick="backToMainMenu()">닫기</button>
        <button class="btn btn-start" onclick="startGame()">▶ 다시 시도</button>
        <button class="btn btn-stop" onclick="logout()">로그아웃</button>
    `;
}

function resetGame() {
    level = 0;
    gameState = 'ready';
    
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
    document.getElementById('comparisonDisplay').classList.remove('show');
    document.getElementById('contentSection').classList.remove('hidden');
    
    window.hidePicture();
    window.hidePassage();
    hideAudioPlayer();
    
    document.getElementById('pictureBtn').classList.add('hidden');
    document.getElementById('passageBtn').classList.add('hidden');
    document.getElementById('audioToggleBtn').classList.add('hidden');
    
    document.getElementById('message').classList.remove('show');
}

window.backToLevelSelect = function() {
    hideAudioPlayer();
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