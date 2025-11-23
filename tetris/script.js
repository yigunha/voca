import init, {
    // --- Auth & Crypto (auth.rs, crypto.rs) ---
    authenticate_student,
    decrypt_xor_base64,
    get_cookie,
    set_cookie,
    refresh_cookies,
    clear_all_cookies,
    check_login_status,

    // --- Core Utilities (lib.rs) ---
    get_version,
    verify_location,
    verify_answer,
    create_answer_hash,
    create_game_token,
    verify_game_token,
    verify_timing,
    can_undo,
    increment_undo,
    reset_undo_count,
    get_undo_count,
    can_use_bomb,
    reset_bomb_usage,
    generate_seed,

    // --- Game Engine (engine.rs) - 에러 수정: 모두 최상위에서 직접 가져옴 ---
    GameEngine, // 👈 GameEngine Class
    parse_answer_rs,
    generate_initial_sequence,
    generate_next_block,
    get_block_color,
} from "./pkg/korean_game_wasm.js";

let wasmModule = null;
let gameEngine = null; // 👈 Rust GameEngine 인스턴스

const CONFIG = {
    GRID_ROWS: 8,
    GRID_COLS: 9,
    FALL_SPEED: 600,
    GRAVITY_SPEED: 150,
    SPAWN_DELAY_MIN: 800,
    SPAWN_DELAY_MAX: 1500,
};

let selectedMainMenu = null;
let selectedLevel = null;
let gameData = [];
let level = 0;
let grid = []; // 👈 이제 Rust의 gameEngine 내부 상태를 반영하는 뷰 모델
let fallingBlocks = [];
let spaceA = [];
let spaceB = [];
let availableBlocks = [];
let alreadySentBlocks = [];
let usedFakeBlocks = [];
let userAnswer = "";
let answerHistory = [];
let correctAnswer = "";
let gameState = 'ready';
let speed = CONFIG.FALL_SPEED;
let fallInterval = null;
let spawnTimeout = null;
let blockIdCounter = 0;
let gravityInterval = null;
let gameStartTime = 0;
let mistakeCount = 0;
let currentLevelBombCount = 0;
let userClass = '';
let solvedProblems = new Set();
let usedTargetInCurrentProblem = false;
let nextSpawnLane = 0;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// =========================================================================
// Wasm 초기화 및 인증
// =========================================================================

async function initWasm() {
    try {
        const wasm = await init();
        wasmModule = wasm;

        if (!wasmModule.verify_location()) {
            console.error("Location verification failed. Code might be running in an unauthorized domain.");
            alert("보안 검증 실패: 허용되지 않은 위치에서 코드가 실행되었습니다. 웹사이트 주소를 확인해 주세요.");
            return false;
        }

       gameEngine = new GameEngine(CONFIG.GRID_ROWS, CONFIG.GRID_COLS);
        
        console.log(`Wasm Module Loaded (v${wasmModule.get_version()})`);
        return true;
    } catch (e) {
        console.error("Error loading Wasm module:", e);
        return false;
    }
}

function checkLogin() {
    try {
        // Rust 함수 호출 (lib.rs/auth.rs에 있음)
        if (wasmModule.check_login_status()) { 
            userClass = wasmModule.get_cookie('studentClass');
            return true;
        }
    } catch (e) {
        console.log("Login check failed:", e);
    }
    return false;
}

// =========================================================================
// 데이터 처리 (Wasm 엔진 호출)
// =========================================================================

/**
 * 암호화된 JSON 데이터를 복호화하여 반환합니다.
 */
async function loadAndDecryptData(base64Data) {
    try {
        const decryptedJsonString = wasmModule.decrypt_xor_base64(base64Data);
        return JSON.parse(decryptedJsonString);
    } catch (e) {
        console.error("Decryption or parsing failed:", e);
        return null;
    }
}

/**
 * Rust 엔진을 사용하여 정답 텍스트를 파싱하고 정답 목록을 가져옵니다.
 * @returns {{blocks: string[], correctAnswer: string}}
 */
function parseAnswer(answerText) {
    try {
        // 👈 에러 수정: wasmModule.parse_answer_rs 호출
        const parsed = wasmModule.parse_answer_rs(answerText); 
        return parsed;
    } catch (e) {
        console.error("Failed to parse answer in Rust:", e);
        return { blocks: [], correctAnswer: answerText };
    }
}


// =========================================================================
// 게임 초기화/시작
// =========================================================================
window.selectLevel = async function(menu, levelNum) {
    const filePath = `data/${userClass}/${category}/${levelNum}_encrypted.dat`;

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load data for ${filePath}`);
        }
        const data = await response.text();
        gameData = await loadAndDecryptData(data);

        selectedLevel = levelNum;
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        resetGame();

    } catch (e) {
        console.error("Error setting up level:", e);
        alert(`레벨 ${levelNum} 데이터를 불러오는데 실패했습니다.`);
    }
}

function resetGame() {
    gameState = 'ready';
    stopGame();
    document.getElementById('levelNum').textContent = '1';
    document.getElementById('totalNum').textContent = gameData.length;
    document.getElementById('message').textContent = '';
    document.getElementById('buttons').innerHTML = '<button class="btn btn-start" onclick="startGame()">▶ 게임 시작</button>';
    
    // Rust 엔진 그리드 클리어
    if (gameEngine) {
        gameEngine.clear_grid();
    }
    grid = Array(CONFIG.GRID_ROWS).fill(null).map(() => Array(CONFIG.GRID_COLS).fill(null));
    
    fallingBlocks = [];
    blockIdCounter = 0;
    
    updateDisplay();
}

window.startGame = function() {
    if (gameState === 'ready' || gameState === 'stopped') {
        gameState = 'playing';
        gameStartTime = Date.now();
        level = 1;
        mistakeCount = 0;
        currentLevelBombCount = 0;
        wasmModule.reset_undo_count(); // 👈 Rust 함수 호출
        wasmModule.reset_bomb_usage(); // 👈 Rust 함수 호출
        loadProblem();
        showButtons();
    }
};

function loadProblem() {
    if (level > gameData.length) {
        showCompletionScreen();
        return;
    }

    const problem = gameData[level - 1];
    const parsedAnswer = parseAnswer(problem.answer);

    correctAnswer = parsedAnswer.correctAnswer;
    
    // 상태 초기화
    userAnswer = "";
    answerHistory = [];
    fallingBlocks = [];
    alreadySentBlocks = [];
    usedFakeBlocks = [];
    blockIdCounter = 0;
    usedTargetInCurrentProblem = false;
    nextSpawnLane = 0;
    
    // Rust 엔진 그리드 클리어
    if (gameEngine) {
        gameEngine.clear_grid();
    }
    grid = Array(CONFIG.GRID_ROWS).fill(null).map(() => Array(CONFIG.GRID_COLS).fill(null));
    
    document.getElementById('answerDisplay').innerHTML = '<span class="blink">|</span>';
    document.getElementById('target').textContent = correctAnswer;
    document.getElementById('message').textContent = problem.question;
    document.getElementById('levelNum').textContent = level;
    document.getElementById('target').classList.remove('show');

    // 👈 Rust 함수 호출 (난수 생성을 위해 generate_seed() 사용)
    const seed = wasmModule.generate_seed();
    
    try {
        // 👈 에러 수정: wasmModule.generate_initial_sequence 호출
        const initialSequenceJson = wasmModule.generate_initial_sequence(
            JSON.stringify(parsedAnswer.blocks),
            JSON.stringify(problem.fake_blocks),
            seed
        );
        const initialSequence = JSON.parse(initialSequenceJson);
        availableBlocks = initialSequence.blocks;
        usedFakeBlocks = initialSequence.used_fakes;
    } catch (e) {
        console.error("Failed to generate initial block sequence:", e);
        availableBlocks = parsedAnswer.blocks; // Fallback
    }

    // 게임 인터벌 재시작
    stopGame();
    speed = CONFIG.FALL_SPEED;
    fallInterval = setInterval(handleFall, speed);
    spawnTimeout = setTimeout(spawnBlock, CONFIG.SPAWN_DELAY_MIN);
    gravityInterval = setInterval(handleGravity, CONFIG.GRAVITY_SPEED);
    
    updateDisplay();
}

// =========================================================================
// 블록 생성/제어 (Wasm 엔진 호출)
// =========================================================================

function spawnBlock() {
    if (gameState !== 'playing' || availableBlocks.length === 0) {
        spawnTimeout = setTimeout(spawnBlock, CONFIG.SPAWN_DELAY_MAX);
        return;
    }
    
    const blockText = availableBlocks.shift();
    const len = blockText.length;
    // 👈 에러 수정: wasmModule.get_block_color 호출
    const color = wasmModule.get_block_color(blockText); 
    
    const seed = wasmModule.generate_seed();
    try {
        // 👈 에러 수정: wasmModule.generate_next_block 호출
        const nextBlockDataJson = wasmModule.generate_next_block(
            userAnswer,
            correctAnswer,
            JSON.stringify(alreadySentBlocks),
            JSON.stringify(parseAnswer(gameData[level - 1].answer).blocks),
            JSON.stringify(gameData[level - 1].fake_blocks),
            JSON.stringify(usedFakeBlocks),
            seed
        );
        const nextBlockData = JSON.parse(nextBlockDataJson);
        
        availableBlocks.push(...nextBlockData.blocks);
        usedFakeBlocks.push(...nextBlockData.used_fakes);
        
        if (parseAnswer(gameData[level - 1].answer).blocks.includes(blockText)) {
            alreadySentBlocks.push(blockText);
        }

    } catch (e) {
        console.error("Failed to generate next block:", e);
    }
    
    const block = {
        id: blockIdCounter++,
        text: blockText,
        len: len,
        row: -1, 
        col: nextSpawnLane,
        color: color,
        isFalling: true,
        isClicked: false,
    };

    if (gameEngine.check_collision(block.row + 1, block.col, block.len)) {
        gameOver();
        return;
    }

    fallingBlocks.push(block);
    
    nextSpawnLane = Math.floor(Math.random() * (CONFIG.GRID_COLS - 1));
    
    const delay = Math.random() * (CONFIG.SPAWN_DELAY_MAX - CONFIG.SPAWN_DELAY_MIN) + CONFIG.SPAWN_DELAY_MIN;
    spawnTimeout = setTimeout(spawnBlock, delay);
}

// =========================================================================
// 충돌/낙하 처리 (Wasm 엔진 호출)
// =========================================================================

function handleFall() {
    if (gameState !== 'playing') return;

    for (let i = fallingBlocks.length - 1; i >= 0; i--) {
        const block = fallingBlocks[i];
        if (!block.isFalling) continue;

        if (gameEngine.check_collision(block.row + 1, block.col, block.len)) {
            block.isFalling = false;
            
            gameEngine.stack_block(block.row, block.col, block.len, block.id);
            
            for (let c = block.col; c < block.col + block.len; c++) {
                if (block.row >= 0 && block.row < CONFIG.GRID_ROWS) {
                    grid[block.row][c] = block;
                }
            }
        } else {
            block.row++;
        }
    }
    
    updateDisplay();
}

function handleGravity() {
    if (gameState !== 'playing') return;

    let moved = false;
    
    for (let r = CONFIG.GRID_ROWS - 2; r >= 0; r--) {
        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
            if (grid[r][c] && !grid[r][c].isFalling && (r + 1 >= CONFIG.GRID_ROWS || !grid[r + 1][c])) {
                const block = grid[r][c];
                
                gameEngine.remove_block(block.id);
                
                for (let i = 0; i < block.len; i++) {
                    grid[r][block.col + i] = null;
                }
                
                block.row++;

                gameEngine.stack_block(block.row, block.col, block.len, block.id);
                
                for (let i = 0; i < block.len; i++) {
                    grid[block.row][block.col + i] = block;
                }
                
                moved = true;
            }
        }
    }

    if (moved) {
        updateDisplay();
    }
}

// =========================================================================
// 사용자 입력 처리
// =========================================================================

function handleBlockClick(blockId) {
    if (gameState !== 'playing') return;
    
    const clickedBlockIndex = fallingBlocks.findIndex(b => b.id === blockId);
    if (clickedBlockIndex === -1) return;
    
    const clickedBlock = fallingBlocks[clickedBlockIndex];

    userAnswer += clickedBlock.text;
    answerHistory.push(clickedBlock.text);
    
    clickedBlock.isFalling = false;
    
    gameEngine.remove_block(clickedBlock.id);
    
    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
            if (grid[r][c] && grid[r][c].id === blockId) {
                grid[r][c] = null;
            }
        }
    }

    fallingBlocks.splice(clickedBlockIndex, 1);

    updateAnswerDisplay();
    checkAnswer();
    updateDisplay();
}

window.handleUndo = function() {
    if (wasmModule.can_undo() && answerHistory.length > 0) {
        const lastBlock = answerHistory.pop();
        userAnswer = userAnswer.slice(0, -lastBlock.length);
        
        wasmModule.increment_undo(); 
        
        updateAnswerDisplay();
        updateDisplay();
    }
};

window.handleBomb = function() {
    if (wasmModule.can_use_bomb()) {
        if (currentLevelBombCount === 0) {
            for (let i = fallingBlocks.length - 1; i >= 0; i--) {
                const block = fallingBlocks[i];
                if (block.row < 1) { 
                    gameEngine.remove_block(block.id);
                    
                    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
                        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                            if (grid[r][c] && grid[r][c].id === block.id) {
                                grid[r][c] = null;
                            }
                        }
                    }
                    fallingBlocks.splice(i, 1);
                }
            }
            
            handleGravity(); 
            
            currentLevelBombCount++;
            
            document.getElementById('bombBtn').disabled = true;
            document.getElementById('bombBtn').textContent = '💣 사용 완료';
            
            updateDisplay();
        } else {
            alert('이번 문제에서는 폭탄을 이미 사용했습니다.');
        }
    }
};


// =========================================================================
// UI/헬퍼 함수 (로직 변경 없음)
// =========================================================================

function updateAnswerDisplay() {
    document.getElementById('answerDisplay').textContent = userAnswer;
    const currentText = document.getElementById('answerDisplay').textContent;
    document.getElementById('answerDisplay').innerHTML = currentText + '<span class="blink">|</span>';
}

function checkAnswer() {
    if (userAnswer.length > correctAnswer.length) {
        handleMistake("정답 길이 초과");
    } else if (userAnswer === correctAnswer) {
        handleCorrectAnswer();
    } else if (!correctAnswer.startsWith(userAnswer)) {
        handleMistake("오답");
    }
}

function handleMistake(reason) {
    gameState = 'stopped';
    stopGame();
    mistakeCount++;
    
    document.getElementById('message').textContent = `❌ ${reason} - 다시 시도! (실수 ${mistakeCount}회)`;
    
    document.getElementById('buttons').innerHTML = '<button class="btn btn-reset" onclick="resetLevel()">🔄 재시작</button>';
}

function handleCorrectAnswer() {
    gameState = 'solved';
    stopGame();
    
    const endTime = Date.now();
    const elapsedSeconds = Math.floor((endTime - gameStartTime) / 1000);
    
    const token = wasmModule.create_game_token(level, correctAnswer, endTime); 
    const isTokenValid = wasmModule.verify_game_token(level, correctAnswer, endTime, token);
    const isTimingValid = wasmModule.verify_timing(level, elapsedSeconds);
    
    if (isTokenValid && isTimingValid) {
        solvedProblems.add(level);
        document.getElementById('message').textContent = `✅ 정답! (${elapsedSeconds}초 소요)`;
        
        if (level < gameData.length) {
            document.getElementById('buttons').innerHTML = '<button class="btn btn-next" onclick="nextLevel()">➡️ 다음 문제</button>';
        } else {
            showCompletionScreen();
        }
    } else {
        document.getElementById('message').textContent = `🚨 치트 감지: 게임 결과를 전송할 수 없습니다.`;
        document.getElementById('buttons').innerHTML = '<button class="btn btn-reset" onclick="resetLevel()">재시작</button>';
    }
}

window.nextLevel = function() {
    level++;
    currentLevelBombCount = 0;
    wasmModule.reset_undo_count();
    wasmModule.reset_bomb_usage();
    loadProblem();
};

window.resetLevel = function() {
    currentLevelBombCount = 0;
    wasmModule.reset_undo_count();
    wasmModule.reset_bomb_usage();
    loadProblem();
};

function showCompletionScreen() {
    gameState = 'finished';
    stopGame();
    
    document.getElementById('message').textContent = `🏆 모든 문제를 해결했습니다! (${solvedProblems.size}/${gameData.length})`;
    document.getElementById('buttons').innerHTML = '<button class="btn btn-back" onclick="backToLevelSelect()">🏠 레벨 선택으로</button>';
}

function gameOver() {
    gameState = 'gameOver';
    stopGame();
    document.getElementById('message').textContent = `☠️ GAME OVER! (그리드가 가득 찼습니다)`;
    document.getElementById('buttons').innerHTML = '<button class="btn btn-reset" onclick="resetLevel()">🔄 재시작</button>';
}

function stopGame() {
    if (fallInterval) clearInterval(fallInterval);
    if (spawnTimeout) clearTimeout(spawnTimeout);
    if (gravityInterval) clearInterval(gravityInterval);
    fallInterval = null;
    spawnTimeout = null;
    gravityInterval = null;
}

function showButtons() {
    document.getElementById('buttons').innerHTML = `
        <button class="btn btn-pause" onclick="stopGameManually()">⏸ 일시 정지</button>
    `;
    document.getElementById('undoBtn').disabled = !wasmModule.can_undo();
    document.getElementById('bombBtn').disabled = !wasmModule.can_use_bomb() || currentLevelBombCount > 0;
    document.getElementById('undoBtn').textContent = `↶ (${20 - wasmModule.get_undo_count()})`;
}

function updateDisplay() {
    const gridEl = document.getElementById('grid');
    gridEl.innerHTML = '';
    
    const fullGrid = Array(CONFIG.GRID_ROWS).fill(null).map(() => Array(CONFIG.GRID_COLS).fill(null));

    for (const block of fallingBlocks) {
        if (!block.isFalling && block.row >= 0) {
            for (let i = 0; i < block.len; i++) {
                if (block.col + i < CONFIG.GRID_COLS) {
                    fullGrid[block.row][block.col + i] = block;
                }
            }
        }
    }
    
    for (const block of fallingBlocks) {
        if (block.isFalling) {
            for (let i = 0; i < block.len; i++) {
                if (block.row >= 0 && block.row < CONFIG.GRID_ROWS && block.col + i < CONFIG.GRID_COLS) {
                    fullGrid[block.row][block.col + i] = block;
                }
            }
        }
    }

    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
        for (let c = 0; c < CONFIG.GRID_COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            
            const block = fullGrid[r][c];

            if (block) {
                if (c === block.col) {
                    const blockEl = document.createElement('div');
                    blockEl.className = 'block';
                    blockEl.style.width = `${block.len * 40}px`; 
                    blockEl.style.backgroundColor = block.color;
                    blockEl.textContent = block.text;
                    blockEl.dataset.id = block.id;

                    if (!block.isFalling) {
                        blockEl.classList.add('clickable');
                        blockEl.onclick = () => handleBlockClick(block.id);
                    }
                    
                    cell.appendChild(blockEl);
                }
            } else {
                
            }

            gridEl.appendChild(cell);
        }
    }

    showButtons(); 
}

function initGridEventListener() {
    const gridEl = document.getElementById('grid');
    gridEl.addEventListener('click', (e) => {
        const blockEl = e.target.closest('.block.clickable');
        if (blockEl) {
            handleBlockClick(parseInt(blockEl.dataset.id));
        }
    });
}

window.logout = function() {
    if (confirm('로그아웃 하시겠습니까?')) {
        wasmModule.clear_all_cookies();
        window.location.href = '../munpup.html?logout=true';
    }
};

window.selectMainMenu = function(menu) {
    selectedMainMenu = menu;
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('levelSelector').classList.remove('hidden');
    document.getElementById('levelTitle').textContent = `${menu} 레벨 선택`;
    createLevelButtons(menu);
};

window.backToMainMenu = function() {
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('levelSelector').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
    stopGame();
};

function createLevelButtons(menu) {
    const container = document.getElementById('levelButtons');
    container.innerHTML = '';
    
    // 레벨 정보 배열 (표시 이름과 파일명)
    const levels = [
        { display: '인사하기', file: '인사하기' },
        { display: '자기소개', file: '자기소개' },
        { display: '가족', file: '가족' },
        { display: '취미', file: '취미' },
        { display: '음식', file: '음식' },
        { display: '쇼핑', file: '쇼핑' },
        { display: '교통', file: '교통' },
        { display: '날씨', file: '날씨' },
        { display: '여행', file: '여행' },
        { display: '건강', file: '건강' },
        { display: '직업', file: '직업' },
        { display: '12 과', file: '12' }
    ];
    
    levels.forEach((level, index) => {
        const button = document.createElement('button');
        button.className = 'level-btn';
        button.textContent = level.display;  // 표시 이름
        button.onclick = () => selectLevel(menu, level.file);  // 파일명 전달
        container.appendChild(button);
    });
}



// =========================================================================
// 시작
// =========================================================================

window.backToLevelSelect = function() {
    document.getElementById('gameArea').classList.add('hidden');
    document.getElementById('levelSelector').classList.remove('hidden');
    resetGame();
};

window.toggleTarget = function() {
    const target = document.getElementById('target');
    if (!target.classList.contains('show')) usedTargetInCurrentProblem = true;
    target.classList.toggle('show');
};

window.stopGameManually = function() {
    gameState = 'stopped';
    stopGame();
    showButtons();
};

window.addEventListener('load', async () => {
    // ⚠️ checkLogin() 전에 wasmModule.get_cookie()를 사용할 수 있도록
    // wasmModule 로딩 후 인증 로직을 실행합니다.
    if (await initWasm() && checkLogin()) {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('gameContent').classList.remove('hidden');
        initGridEventListener();
        
        document.getElementById('mainMenu').classList.remove('hidden'); 
    }
});