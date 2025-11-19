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

// jimuns 모드 확인 함수
function isJimunsMode(problem) {
    return problem.jimuns && problem.answers && problem.hints && 
           Array.isArray(problem.answers) && Array.isArray(problem.hints);
}

// 공백 보존 함수 (B 프로그램에서 가져옴)
function preserveWhitespace(text) {
    return text
        .split('\n')
        .map(line => {
            return line.replace(/^( +)/, (match) => '&nbsp;'.repeat(match.length));
        })
        .join('<br>');
}

function loadProblem() {
    currentProblem = gameData[level];
    usedHintOrAnswer = false;
    
    currentProblem.currentPicture = null;
    currentProblem.currentAudio = null;
    currentProblem.currentPassage = null;
    
    // jimuns 모드 처리
    if (isJimunsMode(currentProblem)) {
        loadJimunsProblem();
        return;
    }
    
    // 기존 sentence 모드 처리
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
    
    // number 타입 처리
    const numberGrid = document.getElementById('numberGrid');
    const answerInputSection = document.getElementById('answerInputSection');
    
    if (currentProblem.number && currentProblem.number.length > 0) {
        const circleNumbers = ['⓪', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
        
        numberGrid.innerHTML = '';
        currentProblem.number.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.className = 'number-btn';
            btn.innerHTML = `<span class="number-circle">${circleNumbers[index]}</span> ${item}`;
            btn.onclick = () => checkNumberAnswer(item);
            numberGrid.appendChild(btn);
        });
        
        numberGrid.classList.remove('hidden');
        answerInputSection.classList.add('hidden');
    } else {
        numberGrid.classList.add('hidden');
        answerInputSection.classList.remove('hidden');
        document.getElementById('answerInput').value = '';
        document.getElementById('answerInput').focus();
    }
    
    // 기존 모드에서는 answer-section 표시
    document.getElementById('answerSection').style.display = 'block';
    document.getElementById('jimunsContainer').classList.add('hidden');
    document.getElementById('contentSection').classList.remove('hidden');
    
    document.getElementById('hintDisplay').classList.remove('show');
    document.getElementById('correctAnswerDisplay').classList.remove('show');
    document.getElementById('comparisonDisplay').classList.remove('show');
    document.getElementById('levelNum').textContent = level + 1;
    document.getElementById('totalNum').textContent = gameData.length;
    
    window.hidePicture();
    window.hidePassage();
}















function loadJimunsProblem() {
    const jimunsText = currentProblem.jimuns;
    const questionParts = jimunsText.split('|     |');  // 공백 5개
    
    // opt 처리 - contentSection에 표시
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
    
    // jimuns 컨텐츠 생성
    let jimunsHTML = '';
    for (let i = 0; i < questionParts.length; i++) {
        const textPart = preserveWhitespace(questionParts[i]);
        jimunsHTML += `<span class="jimuns-text">${textPart}</span>`;
        
        if (i < currentProblem.answers.length) {
            const correctAnswer = currentProblem.answers[i] || "";
            const hintText = currentProblem.hints[i] || '';
            
            jimunsHTML += `
                <span class="input-wrapper" data-index="${i}" style="position: relative; display: inline;">
                    <span class="visual-display" data-index="${i}" 
                          style="display: inline;
                                 padding: 2px 6px; 
                                 background: #1f2937; 
                                 border: 2px solid #60a5fa; 
                                 border-radius: 4px; 
                                 cursor: pointer; 
                                 color: #9ca3af;
                                 word-break: break-all;">
                        <span class="user-input-overlay" style="color: #6b7280; font-weight: normal; font-size: 0.9em; opacity: 0.7;">정답${i + 1}</span>
                    </span>
                    <div class="real-input-group" data-index="${i}" style="display:none; position: fixed; z-index: 10000; background: #374151; padding: 8px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); width: calc(100% - 40px); max-width: 460px;">
                        <button class="answer-btn" data-index="${i}" title="정답 보기" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; background: #10b981; color: white; border: none; cursor: pointer; font-size: 1em; display: flex; align-items: center; justify-content: center;">💡</button>
                        <input type="text" 
                               class="answerInput" 
                               placeholder="정답 ${i + 1}" 
                               data-index="${i}"
                               style="flex: 1; padding: 6px 8px; background: #1f2937; color: #f3f4f6; border: 2px solid #93c5fd; border-radius: 4px; font-size: 1em; height: 32px;">
                        <button class="description-btn" data-index="${i}" title="힌트 보기" style="width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; background: #3b82f6; color: white; border: none; cursor: pointer; font-size: 1em; display: flex; align-items: center; justify-content: center;">❓</button>
                        <div class="answer-hint" data-index="${i}" style="display: none; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 4px; background: white; border: 1px solid #28a745; border-radius: 8px; padding: 6px 12px; color: #28a745; font-weight: bold; white-space: nowrap; z-index: 10001;"></div>
                        <div class="description-hint" data-index="${i}" style="display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; background: white; border: 1px solid #007bff; border-radius: 8px; padding: 8px 12px; color: #444; white-space: normal; max-width: 250px; z-index: 10001;">${hintText}</div>
                    </div>
                </span>
            `;
        }
    }
    
    // sentence는 숨김
    document.getElementById('sentence').style.display = 'none';

    // jimuns 컨텐츠를 jimunsContainer에 표시
    const jimunsContainer = document.getElementById('jimunsContainer');
    jimunsContainer.innerHTML = jimunsHTML;
    jimunsContainer.classList.remove('hidden');
    
    // 시각 표시 클릭 이벤트
    jimunsContainer.querySelectorAll('.visual-display').forEach(display => {
        display.addEventListener('click', (event) => {
            event.stopPropagation();
            const index = display.dataset.index;
            const wrapper = display.closest('.input-wrapper');
            const realInputGroup = wrapper.querySelector('.real-input-group');
            const input = realInputGroup.querySelector('.answerInput');
            
            // 다른 입력창들 모두 숨김
            jimunsContainer.querySelectorAll('.real-input-group').forEach(group => {
                group.style.display = 'none';
            });
            
            // 클릭한 위치 근처에 입력창 표시
            const rect = display.getBoundingClientRect();
            realInputGroup.style.display = 'flex';
            realInputGroup.style.gap = '6px';
            realInputGroup.style.alignItems = 'center';
            realInputGroup.style.left = '50%';
            realInputGroup.style.top = (rect.bottom + 5) + 'px';
            realInputGroup.style.transform = 'translateX(-50%)';
            input.focus();
        });
    });
    
    // 입력창 이벤트
    const allInputs = jimunsContainer.querySelectorAll(".answerInput");
    allInputs.forEach((input) => {
        // Enter 키
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                const inputIndex = parseInt(input.dataset.index);
                const wrapper = input.closest('.input-wrapper');
                const visualDisplay = wrapper.querySelector('.visual-display');
                const overlay = visualDisplay.querySelector('.user-input-overlay');
                const realInputGroup = wrapper.querySelector('.real-input-group');
                
                // 값 업데이트 + 스타일 변경
                if (input.value) {
                    overlay.textContent = input.value;
                    overlay.style.color = '#f3f4f6';
                    overlay.style.fontWeight = 'bold';
                    overlay.style.fontSize = '1em';
                    overlay.style.opacity = '1';
                } else {
                    overlay.textContent = '정답' + (inputIndex + 1);
                    overlay.style.color = '#6b7280';
                    overlay.style.fontWeight = 'normal';
                    overlay.style.fontSize = '0.9em';
                    overlay.style.opacity = '0.7';
                }
                
                // 입력창 숨김
                realInputGroup.style.display = 'none';
                
                // 마지막이면 정답 확인, 아니면 다음 입력창
                if (inputIndex === allInputs.length - 1) {
                    checkJimunsAnswer();
                } else {
                    const nextWrapper = jimunsContainer.querySelector(`.input-wrapper[data-index="${inputIndex + 1}"]`);
                    if (nextWrapper) {
                        const nextDisplay = nextWrapper.querySelector('.visual-display');
                        nextDisplay.click();
                    }
                }
            }
        });
        
        // 포커스 아웃 (다른 곳 클릭)
        input.addEventListener("blur", () => {
            setTimeout(() => {
                const inputIndex = parseInt(input.dataset.index);
                const wrapper = input.closest('.input-wrapper');
                const visualDisplay = wrapper.querySelector('.visual-display');
                const overlay = visualDisplay.querySelector('.user-input-overlay');
                const realInputGroup = wrapper.querySelector('.real-input-group');
                
                // 값 업데이트 + 스타일 변경
                if (input.value) {
                    overlay.textContent = input.value;
                    overlay.style.color = '#f3f4f6';
                    overlay.style.fontWeight = 'bold';
                    overlay.style.fontSize = '1em';
                    overlay.style.opacity = '1';
                } else {
                    overlay.textContent = '정답' + (inputIndex + 1);
                    overlay.style.color = '#6b7280';
                    overlay.style.fontWeight = 'normal';
                    overlay.style.fontSize = '0.9em';
                    overlay.style.opacity = '0.7';
                }
                
                // 입력창 숨김
                realInputGroup.style.display = 'none';
            }, 200);
        });
    });
    
    // 정답/힌트 버튼 이벤트
    jimunsContainer.querySelectorAll('.answer-btn').forEach(button => {
        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const index = event.target.dataset.index;
            toggleJimunsAnswer(index);
        });
    });
    
    jimunsContainer.querySelectorAll('.description-btn').forEach(button => {
        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const index = event.target.dataset.index;
            toggleJimunsHint(index);
        });
    });
    
    // jimuns 모드에서는 기존 UI 요소들 완전히 숨기기
    document.getElementById('numberGrid').classList.add('hidden');
    document.getElementById('answerInputSection').classList.add('hidden');
    document.getElementById('answerSection').style.display = 'none';
    
    document.getElementById('pictureBtn').classList.add('hidden');
    document.getElementById('passageBtn').classList.add('hidden');
    document.getElementById('audioToggleBtn').classList.add('hidden');
    
    document.getElementById('levelNum').textContent = level + 1;
    document.getElementById('totalNum').textContent = gameData.length;
}



















// jimuns 정답 토글 함수
function toggleJimunsAnswer(index) {
    const hint = document.querySelector(`.answer-hint[data-index="${index}"]`);
    const correctAnswer = currentProblem.answers[index] || "";
    
    // 먼저 현재 상태 저장
    const isVisible = (hint.style.display === 'block');
    
    // 그 다음 다른 것들 닫기
    closeAllJimunsDropdowns();
    closeAllJimunsHints();
    
    // 저장한 상태로 토글
    if (isVisible) {
        hint.innerHTML = "";
        hint.style.display = "none";
    } else {
        if (correctAnswer) {
            hint.innerHTML = '';
            const answerDiv = document.createElement('div');
            answerDiv.className = 'answer-current';
            answerDiv.textContent = correctAnswer;
            hint.appendChild(answerDiv);
            hint.style.display = "block";
            
            usedHintOrAnswer = true;
        }
    }
}

// jimuns 힌트 토글 함수
function toggleJimunsHint(index) {
    const hint = document.querySelector(`.description-hint[data-index="${index}"]`);
    
    closeAllJimunsDropdowns();
    closeAllJimunsHints(index);
    
    if (hint.style.display === 'block') {
        hint.style.display = 'none';
    } else {
        hint.style.display = 'block';
        usedHintOrAnswer = true;
    }
}

// 모든 jimuns 드롭다운 닫기
function closeAllJimunsDropdowns() {
    document.querySelectorAll('.jimuns-answer-dropdown').forEach(dd => dd.classList.remove('show'));
    document.querySelectorAll('.answer-hint').forEach(hint => {
        hint.innerHTML = "";
        hint.style.display = 'none';
    });
}

// 모든 jimuns 힌트 닫기
function closeAllJimunsHints(keepIndex = -1) {
    document.querySelectorAll('.description-hint').forEach(hint => {
        if (hint.dataset.index !== String(keepIndex)) {
            hint.style.display = 'none';
        }
    });
}





window.checkJimunsAnswer = function() {
    if (gameState !== 'playing') return;
    
    const jimunsContainer = document.getElementById('jimunsContainer');
    const allWrappers = jimunsContainer.querySelectorAll('.input-wrapper');
    const messageEl = document.getElementById('message');
    
    let allCorrect = true;
    
    allWrappers.forEach((wrapper, index) => {
        const visualDisplay = wrapper.querySelector('.visual-display');
        const input = wrapper.querySelector('.answerInput');
        
        if (input.disabled) return;
        
        const userAnswer = input.value.trim();
        const correctAnswer = currentProblem.answers[index] || "";
        
        let isCorrect = (userAnswer.toLowerCase() === correctAnswer.toLowerCase());
        
        if (isCorrect && userAnswer !== "") {
            // 정답: 초록 테두리
            visualDisplay.style.borderColor = "#22c55e";
            visualDisplay.style.borderWidth = "3px";
            input.disabled = true;
        } else {
            // 오답: 빨간 테두리
            visualDisplay.style.borderColor = "#ef4444";
            visualDisplay.style.borderWidth = "3px";
            allCorrect = false;
        }
    });
    
    if (allCorrect) {
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
        usedHintOrAnswer = true;
        
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 500);
    }
};








window.checkNumberAnswer = function(selectedAnswer) {
    if (gameState !== 'playing') return;
    
    const isCorrect = currentProblem.answer.some(ans => 
        selectedAnswer.toLowerCase() === ans.toLowerCase()
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
        usedHintOrAnswer = true;
        
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, 500);
    }
};

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
    
    img.onerror = null;
    img.src = '';
    
    const jpgPath = `./data_picture/${currentProblem.currentPicture}.jpg`;
    
    img.onerror = function() {
        const jpegPath = `./data_picture/${currentProblem.currentPicture}.jpeg`;
        
        img.onerror = function() {
            console.error('이미지 로드 실패:', currentProblem.currentPicture);
            alert(`이미지를 불러올 수 없습니다.\n파일명: ${currentProblem.currentPicture}`);
            window.hidePicture();
        };
        
        img.src = jpegPath;
    };
    
    img.src = jpgPath;
    overlay.classList.remove('hidden');
}

window.hidePicture = function() {
    const overlay = document.getElementById('pictureOverlay');
    const img = document.getElementById('pictureImage');
    
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

function compareStrings(userAnswer, correctAnswer) {
    const maxLen = Math.max(userAnswer.length, correctAnswer.length);
    let result = '';
    
    for (let i = 0; i < maxLen; i++) {
        const userChar = userAnswer[i] || '';
        const correctChar = correctAnswer[i] || '';
        
        if (userChar === correctChar) {
            if (userChar === ' ') {
                result += `<span class="diff-space-correct">[ ]</span>`;
            } else {
                result += `<span class="diff-correct">✓</span>`;
            }
        } else if (userChar && !correctChar) {
            if (userChar === ' ') {
                result += `<span class="diff-extra">[ ]</span>`;
            } else {
                result += `<span class="diff-extra">${userChar}</span>`;
            }
        } else if (!userChar && correctChar) {
            if (correctChar === ' ') {
                result += `<span class="diff-missing">[ ]</span>`;
            } else {
                result += `<span class="diff-missing">[${correctChar}]</span>`;
            }
        } else {
            if (userChar === ' ') {
                result += `<span class="diff-wrong">[ ]</span>`;
            } else if (correctChar === ' ') {
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
        usedHintOrAnswer = true;
        
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        
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
    document.getElementById('sentence').style.display = 'block';
    document.getElementById('optDescription').style.display = 'none';
    document.getElementById('optionsGrid').innerHTML = '';
    document.getElementById('conditionText').style.display = 'none';
    document.getElementById('numberGrid').innerHTML = '';
    document.getElementById('numberGrid').classList.add('hidden');
    document.getElementById('answerInputSection').classList.remove('hidden');
    document.getElementById('jimunsContainer').innerHTML = '';
    document.getElementById('jimunsContainer').classList.add('hidden');
    document.getElementById('answerSection').style.display = 'block';
    
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