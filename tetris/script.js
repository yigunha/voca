let wasmModule = null;

const CONFIG = {
    GRID_ROWS: 8,
    GRID_COLS: 9,
    FALL_SPEED: 600,
    GRAVITY_SPEED: 150,
    SPAWN_DELAY_MIN: 800,
    SPAWN_DELAY_MAX: 1500,
    WRONG_ANSWERS_PER_CORRECT: 3,
    BLOCK_SPAWN_INTERVAL_MIN: 400,
    BLOCK_SPAWN_INTERVAL_MAX: 1000,
};

const FIXED_JOSA_BLOCKS = ['은', '는', '이', '가', '을', '를', '에', '만', ' '];

// 전역 변수
let selectedMainMenu = null;
let selectedLevel = null;
let gameData = [];
let level = 0;
let grid = [];
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
let rowQueue = []; // 행별 블록 대기열
let activeRowCount = 0; // 현재 활성화된 행 수

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// ==========================================
// 1. 초기화 및 유틸리티 함수
// ==========================================

async function initWasm() {
    try {
        const wasm = await import('./pkg/korean_game_wasm.js');
        await wasm.default();
        wasmModule = wasm;
        console.log('WASM 초기화:', wasm.get_version());
        if (!wasm.verify_location()) {
            document.body.innerHTML = '<div style="color: white; text-align: center; padding: 50px;">⚠️ 인증되지 않은 위치입니다.</div>';
            throw new Error('Unauthorized location');
        }
        return true;
    } catch (error) {
        console.error('WASM 로드 실패:', error);
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
        const fullClass = wasmModule.get_cookie('studentClass');
        userClass = fullClass.substring(0, 2);
        const mainMenuTitle = document.getElementById('mainMenuTitle');
        if (mainMenuTitle) mainMenuTitle.textContent = `${userClass} 학습 모드 선택`;
        loadSolvedProblems();
        return true;
    } catch (error) {
        window.location.href = '../munpup.html';
        return false;
    }
}

function loadSolvedProblems() {
    try {
        const saved = localStorage.getItem(`solved_${userClass}`);
        if (saved) solvedProblems = new Set(JSON.parse(saved));
    } catch (e) {}
}

function saveSolvedProblems() {
    try {
        localStorage.setItem(`solved_${userClass}`, JSON.stringify([...solvedProblems]));
    } catch (e) {}
}

window.logout = function() {
    if (wasmModule) {
        try {
            wasmModule.delete_cookie('studentName');
            wasmModule.delete_cookie('studentClass');
            wasmModule.delete_cookie('studentPassword');
        } catch (e) {}
    }
    window.location.href = '../munpup.html?logout=true';
};

function playClickSound() {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch(e) {}
}

// ==========================================
// 2. 데이터 파싱 및 게임 로직 코어
// ==========================================

function parseAnswer(answer) {
    const blocks = [];
    const bracketRegex = /\[([^\]]+)\]/g;
    const bracketContents = [];
    let match;
    while ((match = bracketRegex.exec(answer)) !== null) {
        bracketContents.push(match[1]);
    }
    const remaining = answer.replace(/\[([^\]]+)\]/g, '');
    const spaceSplit = remaining.split(/\s+/).filter(part => part !== '');
    const allParts = [];
    spaceSplit.forEach(part => {
        const slashSplit = part.split('/').filter(p => p !== '');
        allParts.push(...slashSplit);
    });
    const filteredParts = allParts.filter(part => !FIXED_JOSA_BLOCKS.includes(part));
    blocks.push(...bracketContents, ...filteredParts);
    
    return {
        blocks: blocks,
        correctAnswer: answer.replace(/[\[\]\/]/g, '')
    };
}

function binPackBlocks(blocks) {
    // 1. 블록들을 크기 순으로 정렬 (큰 것부터)
    const sortedBlocks = [...blocks].sort((a, b) => b.length - a.length);
    
    const rows = [];
    
    for (const block of sortedBlocks) {
        const blockLen = block.length;
        
        // 2. 가장 적합한 행 찾기 (Best Fit)
        let bestRowIndex = -1;
        let minRemainingSpace = CONFIG.GRID_COLS + 1;
        
        for (let i = 0; i < rows.length; i++) {
            const currentLength = rows[i].reduce((sum, b) => sum + b.length, 0);
            const remainingSpace = CONFIG.GRID_COLS - currentLength;
            
            // 블록이 들어갈 수 있고, 남은 공간이 최소인 행 선택
            if (blockLen <= remainingSpace && remainingSpace < minRemainingSpace) {
                bestRowIndex = i;
                minRemainingSpace = remainingSpace;
            }
        }
        
        // 3. 적합한 행이 있으면 추가, 없으면 새 행 생성
        if (bestRowIndex !== -1) {
            rows[bestRowIndex].push(block);
        } else {
            rows.push([block]);
        }
    }
    
    // 4. 각 행 내부의 블록들을 랜덤하게 섞기
    rows.forEach(row => {
        for (let i = row.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [row[i], row[j]] = [row[j], row[i]];
        }
    });
    
    // 5. 각 행에 랜덤 딜레이 추가하여 반환
    return rows.map((row, rowIndex) => ({
        blocks: row,
        rowIndex: rowIndex,
        spawnDelay: Math.random() * 800
    }));
}

function getFakeBlocks(currentLevel) {
    const fakeBlocks = [];
    gameData.forEach((game, idx) => {
        if (idx !== currentLevel) {
            const parseResult = parseAnswer(game.answer);
            fakeBlocks.push(...parseResult.blocks);
        }
    });
    return fakeBlocks.filter(block => !FIXED_JOSA_BLOCKS.includes(block));
}

function getBlockColor(blockText) {
    const color = wasmModule.get_block_color(blockText);
    return { bg: color, text: '#000000' };
}

function findBestLane(blockText) {
    const blockLen = blockText.length;
    const maxLane = CONFIG.GRID_COLS - blockLen;
    
    let bestLane = 0;
    let maxDropRow = -100;
    let maxContactScore = -1;

    const colHeights = Array(CONFIG.GRID_COLS).fill(CONFIG.GRID_ROWS);

    for (let c = 0; c < CONFIG.GRID_COLS; c++) {
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            if (grid[r][c] !== null) {
                colHeights[c] = r;
                break;
            }
        }
    }

    fallingBlocks.forEach(fb => {
        for (let i = 0; i < fb.cells.length; i++) {
            const c = fb.lane + i;
            if (c < CONFIG.GRID_COLS) {
                const obstacleRow = Math.max(0, fb.position);
                colHeights[c] = Math.min(colHeights[c], obstacleRow);
            }
        }
    });

    for (let lane = 0; lane <= maxLane; lane++) {
        let maxRowForThisLane = CONFIG.GRID_ROWS;

        for (let i = 0; i < blockLen; i++) {
            const col = lane + i;
            maxRowForThisLane = Math.min(maxRowForThisLane, colHeights[col]);
        }

        const actualRow = maxRowForThisLane - 1;

        if (actualRow < -1) continue;

        let currentContactScore = 0;
        const landingSurfaceRow = actualRow + 1;
        
        for (let i = 0; i < blockLen; i++) {
            const col = lane + i;
            if (landingSurfaceRow === colHeights[col]) {
                currentContactScore++;
            }
        }

        if (actualRow > maxDropRow) {
            maxDropRow = actualRow;
            maxContactScore = currentContactScore;
            bestLane = lane;
        } else if (actualRow === maxDropRow) {
            if (currentContactScore > maxContactScore) {
                maxContactScore = currentContactScore;
                bestLane = lane;
            }
        }
    }
    
    if (maxDropRow < -1) return null;

    return bestLane;
}

// ==========================================
// 3. 게임 진행 로직
// ==========================================

function prepareInitialBlocks(correctBlocks) {
    let pool = [...correctBlocks];
    
    const fakes = getFakeBlocks(level);
    const availableFakes = fakes.filter(f => !pool.includes(f) && !usedFakeBlocks.includes(f)).slice(0, 3);
    
    pool.push(...availableFakes);
    usedFakeBlocks.push(...availableFakes);
    
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    return binPackBlocks(pool);
}

window.startGame = function() {
    if (gameData.length === 0) return;
    
    const currentGame = gameData[level];
    const parseResult = parseAnswer(currentGame.answer);
    const blocks = parseResult.blocks;
    correctAnswer = parseResult.correctAnswer;
    
    spaceA = [];
    spaceB = [];
    fallingBlocks = [];
    usedFakeBlocks = [];
    alreadySentBlocks = [];
    userAnswer = "";
    answerHistory = [];
    grid = Array(CONFIG.GRID_ROWS).fill(null).map(() => Array(CONFIG.GRID_COLS).fill(null));
    rowQueue = [];
    activeRowCount = 0;
    
    gameState = 'playing';
    blockIdCounter = 0;
    gameStartTime = Date.now();
    mistakeCount = 0;
    currentLevelBombCount = 0;
    usedTargetInCurrentProblem = false;
    nextSpawnLane = 0;
    
    wasmModule.reset_undo_count();
    wasmModule.reset_bomb_usage();
    
    document.getElementById('description').textContent = '문장: ' + currentGame.description;
    document.getElementById('target').textContent = '목표: ' + correctAnswer.split('').map(c => c === " " ? "□" : c).join('');
    document.getElementById('target').classList.remove('show');
    document.getElementById('message').textContent = '';
    document.getElementById('buttons').innerHTML = '<button class="btn btn-stop" onclick="stopGameManually()">■ 게임 중단</button>';
    
    rowQueue = prepareInitialBlocks(blocks);
    console.log("초기 배치 (행별):", rowQueue);

    stopGame();
    updateDisplay();
    
    spawnRowBlocks();
    
    startFalling();
    startGravity();
};










function spawnRowBlocks() {
    if (gameState !== 'playing') return;
    if (rowQueue.length === 0) return;
    if (activeRowCount >= 5) return;
    
    const rowData = rowQueue.shift();
    activeRowCount++;
    
    console.log(`${rowData.rowIndex + 1}번째 행 스폰 시작 (${rowData.blocks.length}개 블록, 대기: ${rowQueue.length}행)`);
    
    // 이 행의 총 길이 계산
    const totalLength = rowData.blocks.reduce((sum, block) => sum + block.length, 0);
    const emptySpace = CONFIG.GRID_COLS - totalLength;
    
    // 빈 칸이 있으면 랜덤하게 시작 위치 결정
    let startOffset = 0;
    if (emptySpace > 0) {
        startOffset = Math.floor(Math.random() * (emptySpace + 1));
        console.log(`  → 빈칸 ${emptySpace}개, 랜덤 오프셋: ${startOffset}칸`);
    }
    
    // 블록별 위치 계산
    const blockPositions = [];
    let currentLane = startOffset;
    
    rowData.blocks.forEach((blockText) => {
        const blockLen = blockText.length;
        blockPositions.push({
            text: blockText,
            lane: currentLane,
            length: blockLen
        });
        currentLane += blockLen;
    });
    
    // 블록 순서를 랜덤하게 섞기 (떨어지는 순서)
    const shuffledBlocks = [...blockPositions];
    for (let i = shuffledBlocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledBlocks[i], shuffledBlocks[j]] = [shuffledBlocks[j], shuffledBlocks[i]];
    }
    
    // 랜덤 순서로 블록 스폰
    let cumulativeDelay = 0;
    shuffledBlocks.forEach((blockData, index) => {
        // 랜덤 간격 생성
        const randomInterval = Math.floor(
            Math.random() * (CONFIG.BLOCK_SPAWN_INTERVAL_MAX - CONFIG.BLOCK_SPAWN_INTERVAL_MIN)
        ) + CONFIG.BLOCK_SPAWN_INTERVAL_MIN;
        
        cumulativeDelay += randomInterval;
        
        setTimeout(() => {
            if (gameState !== 'playing') return;
            
            const cells = blockData.text.split('');
            
            const newBlock = {
                text: blockData.text,
                cells: cells,
                position: -1,
                lane: blockData.lane,
                id: blockIdCounter++,
                color: getBlockColor(blockData.text),
                rowGroup: rowData.rowIndex
            };
            
            fallingBlocks.push(newBlock);
            updateDisplay();
            
            // 마지막 블록이 스폰되면 다음 행 스폰 시도
            if (index === shuffledBlocks.length - 1) {
                setTimeout(() => {
                    if (gameState === 'playing' && rowQueue.length > 0 && activeRowCount < 5) {
                        spawnRowBlocks();
                    }
                }, 500);
            }
        }, cumulativeDelay);
    });
}
























function checkRowCompletion() {
    const activeRows = new Set(fallingBlocks.map(fb => fb.rowGroup).filter(rg => rg >= 0));
    const previousCount = activeRowCount;
    activeRowCount = activeRows.size;
    
    console.log(`활성 행: ${activeRowCount}개 (이전: ${previousCount}개, 대기: ${rowQueue.length}행)`);
    
    if (previousCount > activeRowCount && rowQueue.length > 0 && gameState === 'playing') {
        console.log('→ 다음 행 스폰 트리거!');
        setTimeout(() => spawnRowBlocks(), 300);
    }
}

function spawnBlock() {
    return;
}

function refillSpaceB() {
    return;
}

function checkAndInjectMissingBlock() {
    const parseResult = parseAnswer(gameData[level].answer);
    const allCorrectBlocks = parseResult.blocks;
    
    let remainingAnswer = correctAnswer.slice(userAnswer.length);
    if (remainingAnswer.length === 0) return;
    
    let nextNeededBlock = null;
    for (const block of allCorrectBlocks) {
        if (remainingAnswer.startsWith(block)) {
            nextNeededBlock = block;
            break;
        }
    }
    
    if (!nextNeededBlock) return;
    
    const existsFalling = fallingBlocks.some(fb => fb.text === nextNeededBlock);
    const existsGrid = grid.some(row => row.some(c => c && c.blockText === nextNeededBlock));
    const existsInQueue = rowQueue.some(rowData => rowData.blocks.includes(nextNeededBlock));
    
    if (!existsFalling && !existsGrid && !existsInQueue) {
        console.log(`긴급 투입: [${nextNeededBlock}] 즉시 스폰`);
        
        const cells = nextNeededBlock.split('');
        const lane = findBestLane(nextNeededBlock);
        
        if (lane !== null) {
            const newBlock = {
                text: nextNeededBlock,
                cells: cells,
                position: -1,
                lane: lane,
                id: blockIdCounter++,
                color: getBlockColor(nextNeededBlock),
                rowGroup: -1
            };
            
            fallingBlocks.push(newBlock);
            updateDisplay();
        }
    }
}

function scheduleNextBlock() {
    return;
}

function startFalling() {
    fallInterval = setInterval(() => {
        if (gameState !== 'playing') return;
        fallingBlocks.forEach(block => {
            const nextBlock = { ...block, position: block.position + 1 };
            if (checkCollision(nextBlock)) {
                stackBlock(block);
                fallingBlocks = fallingBlocks.filter(b => b.id !== block.id);
                checkRowCompletion();
                checkAndInjectMissingBlock();
            } else {
                block.position++;
            }
        });
        updateDisplay();
    }, speed);
}

function startGravity() {
    gravityInterval = setInterval(() => {
        if (gameState !== 'playing') return;
        applyGravityStep();
    }, CONFIG.GRAVITY_SPEED);
}

function stopGame() {
    if (fallInterval) clearInterval(fallInterval);
    if (spawnTimeout) clearTimeout(spawnTimeout);
    if (gravityInterval) clearInterval(gravityInterval);
}

// ==========================================
// 4. 이벤트 핸들러 및 UI 업데이트
// ==========================================

function handleBlockClick(blockId) {
    if (gameState !== 'playing') return;
    const block = fallingBlocks.find(b => b.id === blockId);
    if (!block) return;
    
    playClickSound();
    processInput(block.text);
    fallingBlocks = fallingBlocks.filter(b => b.id !== blockId);
    checkRowCompletion();
    updateDisplay();
}

function handleCellClick(row, col) {
    if (gameState !== 'playing') return;
    const cell = grid[row][col];
    if (cell) {
        playClickSound();
        processInput(cell.blockText);
        
        const blockId = cell.id;
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                if (grid[r][c] && grid[r][c].id === blockId) {
                    grid[r][c] = null;
                }
            }
        }
        
        applyGravityStep();
        checkRowCompletion();
        updateDisplay();
    }
}

function handleFixedJosaClick(josaText) {
    if (gameState !== 'playing') return;
    playClickSound();
    const textToAdd = (josaText !== ' ') ? josaText + ' ' : josaText;
    processInput(textToAdd);
    updateDisplay();
}

function processInput(text) {
    answerHistory.push(text);
    userAnswer += text;
    checkAndInjectMissingBlock();
    if (userAnswer.length >= correctAnswer.length) {
        checkAnswer();
    }
}

function handleUndo() {
    if (gameState !== 'playing' || answerHistory.length === 0) return;
    if (!wasmModule.can_undo()) {
        console.error('되돌리기는 게임당 20번까지만 가능합니다.');
        return;
    }
    wasmModule.increment_undo();

    const lastBlock = answerHistory.pop();
    userAnswer = userAnswer.slice(0, -lastBlock.length);
    
    const isFixedJosa = FIXED_JOSA_BLOCKS.includes(lastBlock.trim());
    if (!isFixedJosa) {
        const parseResult = parseAnswer(gameData[level].answer);
        if (parseResult.blocks.includes(lastBlock)) {
            console.log(`되돌리기: [${lastBlock}] 긴급 재투입`);
            
            const cells = lastBlock.split('');
            const lane = findBestLane(lastBlock);
            
            if (lane !== null) {
                const newBlock = {
                    text: lastBlock,
                    cells: cells,
                    position: -1,
                    lane: lane,
                    id: blockIdCounter++,
                    color: getBlockColor(lastBlock),
                    rowGroup: -1
                };
                
                fallingBlocks.push(newBlock);
            }
        }
    }
    
    updateDisplay();
    checkAndInjectMissingBlock();
}

function handleBomb() {
    if (gameState !== 'playing') return;
    currentLevelBombCount++;
    playClickSound();
    
    grid = Array(CONFIG.GRID_ROWS).fill(null).map(() => Array(CONFIG.GRID_COLS).fill(null));
    fallingBlocks = [];
    rowQueue = [];
    activeRowCount = 0;
    nextSpawnLane = 0;
    
    const parseResult = parseAnswer(gameData[level].answer);
    const allCorrectBlocks = parseResult.blocks;
    
    let remainingAnswer = correctAnswer.slice(userAnswer.length);
    let remainingBlocks = [];
    let tempAnswer = remainingAnswer;
    
    for (const block of allCorrectBlocks) {
        if (tempAnswer.startsWith(block)) {
            remainingBlocks.push(block);
            tempAnswer = tempAnswer.slice(block.length);
        }
    }
    
    const fakes = getFakeBlocks(level);
    const maxFakes = 3;
    const availableFakes = fakes.filter(f => !usedFakeBlocks.includes(f)).slice(0, maxFakes - usedFakeBlocks.length);
    remainingBlocks.push(...availableFakes);
    usedFakeBlocks.push(...availableFakes);
    
    rowQueue = prepareInitialBlocks(remainingBlocks);
    console.log('폭탄 사용 - 남은 블록으로 재구성:', rowQueue.length + '행');
    
    updateDisplay();
    setTimeout(() => {
        spawnRowBlocks();
    }, 300);
}

// ==========================================
// 5. 기타 필수 함수들
// ==========================================

function checkCollision(block) {
    const row = block.position;
    if (row < 0) return false;
    for (let i = 0; i < block.cells.length; i++) {
        const col = block.lane + i;
        if (col >= CONFIG.GRID_COLS) return false;
        const nextRow = row + 1;
        if (nextRow >= CONFIG.GRID_ROWS) return true;
        if (grid[nextRow][col] !== null) return true;
    }
    return false;
}

function stackBlock(block) {
    if (block.position < 0) {
        console.log("Game Over: 블록이 화면 밖에서 쌓였습니다.");
        document.getElementById('message').textContent = '⚠️ 공간 부족! 게임 오버.';
        document.getElementById('message').className = 'message fail show';
        gameState = 'stopped';
        stopGame();
        setTimeout(() => showButtons(), 2000);
        return; 
    }
    
    block.cells.forEach((cell, idx) => {
        const row = block.position;
        const col = block.lane + idx;
        if (row >= 0 && row < CONFIG.GRID_ROWS && col < CONFIG.GRID_COLS) {
            grid[row][col] = {
                char: cell,
                blockText: block.text,
                color: block.color,
                id: block.id,
                blockLength: block.cells.length,
                posInBlock: idx
            };
        }
    });
}

function applyGravityStep() {
    const blockIds = new Set();
    for(let r=0; r<CONFIG.GRID_ROWS; r++) {
        for(let c=0; c<CONFIG.GRID_COLS; c++) {
            if(grid[r][c]) blockIds.add(grid[r][c].id);
        }
    }
    
    let moved = false;
    const blocksToMove = [];
    
    blockIds.forEach(blockId => {
        const blockCells = [];
        let minRow = CONFIG.GRID_ROWS;
        
        for(let r=0; r<CONFIG.GRID_ROWS; r++) {
            for(let c=0; c<CONFIG.GRID_COLS; c++) {
                if(grid[r][c] && grid[r][c].id === blockId) {
                    blockCells.push({r, c, data: grid[r][c]});
                    minRow = Math.min(minRow, r);
                }
            }
        }
        if(blockCells.length === 0) return;

        const canFall = blockCells.every(cell => {
            const nextRow = cell.r + 1;
            return nextRow < CONFIG.GRID_ROWS && (!grid[nextRow][cell.c] || grid[nextRow][cell.c].id === blockId);
        });
        
        if(canFall) {
            blocksToMove.push(blockId);
            moved = true;
        }
    });
    
    blocksToMove.forEach(blockId => {
        const cellsToClear = [];
        const cellsToSet = [];
        
        for(let r=0; r<CONFIG.GRID_ROWS; r++) {
            for(let c=0; c<CONFIG.GRID_COLS; c++) {
                if (grid[r][c] && grid[r][c].id === blockId) {
                    cellsToClear.push({r, c});
                    cellsToSet.push({r: r + 1, c: c, data: grid[r][c]});
                }
            }
        }
        
        cellsToClear.forEach(cell => grid[cell.r][cell.c] = null);
        cellsToSet.forEach(cell => grid[cell.r][cell.c] = cell.data);
    });

    if(moved) {
        updateDisplay();
    }
}

function renderFixedJosa(gridEl) {
    const josaRow = document.createElement('div');
    josaRow.className = 'row fixed-josa-row';
    FIXED_JOSA_BLOCKS.forEach(josa => {
        const cell = document.createElement('div');
        cell.className = 'cell clickable block-cell block-single fixed-josa';
        const color = getBlockColor(josa);
        cell.style.backgroundColor = color.bg;
        cell.style.color = color.text;
        cell.textContent = josa === ' ' ? '' : josa;
        cell.onclick = () => handleFixedJosaClick(josa);
        josaRow.appendChild(cell);
    });
    const remaining = CONFIG.GRID_COLS - FIXED_JOSA_BLOCKS.length;
    for(let i=0; i<remaining; i++) josaRow.appendChild(document.createElement('div')).className = 'cell empty';
    gridEl.appendChild(josaRow);
}

function renderCell(el, char, color, id, idx, len, isFalling) {
    el.style.backgroundColor = color.bg;
    el.style.color = color.text;
    el.textContent = char === " " ? "" : char;
    el.classList.add('clickable', 'block-cell');
    
    if (len === 1) el.classList.add('block-single');
    else if (idx === 0) el.classList.add('block-start');
    else if (idx === len - 1) el.classList.add('block-end');
    else el.classList.add('block-middle');
    
    el.dataset.blockId = id;
    
    el.onmouseenter = () => highlightBlock(id, true);
    el.onmouseleave = () => highlightBlock(id, false);
}

function updateDisplay() {
    const gridEl = document.getElementById('grid');
    gridEl.innerHTML = '';
    
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
        const rowEl = document.createElement('div');
        rowEl.className = 'row';
        for (let col = 0; col < CONFIG.GRID_COLS; col++) {
            const cellEl = document.createElement('div');
            cellEl.className = 'cell';
            
            const fallingBlock = fallingBlocks.find(fb => fb.position === row && col >= fb.lane && col < fb.lane + fb.cells.length);
            
            if (fallingBlock) {
                const idx = col - fallingBlock.lane;
                renderCell(cellEl, fallingBlock.cells[idx], fallingBlock.color, fallingBlock.id, idx, fallingBlock.cells.length, true);
                cellEl.onclick = () => handleBlockClick(fallingBlock.id);
            } else if (grid[row][col]) {
                const cell = grid[row][col];
                renderCell(cellEl, cell.char, cell.color, cell.id, cell.posInBlock, cell.blockLength, false);
                cellEl.onclick = () => handleCellClick(row, col);
            } else {
                cellEl.classList.add('empty');
            }
            rowEl.appendChild(cellEl);
        }
        gridEl.appendChild(rowEl);
    }
    renderFixedJosa(gridEl);
    updateAnswerDisplay();
}


function highlightBlock(id, on) {
    document.querySelectorAll(`[data-block-id="${id}"]`).forEach(el => 
        on ? el.classList.add('block-hover') : el.classList.remove('block-hover')
    );
}

function updateAnswerDisplay() {
    const display = document.getElementById('answerDisplay');
    display.innerHTML = userAnswer.split('').map(c => c === " " ? "□" : c).join('') + '<span class="blink">|</span>';
    document.getElementById('undoBtn').disabled = answerHistory.length === 0 || gameState !== 'playing';
    document.getElementById('bombBtn').disabled = gameState !== 'playing';
}

function checkAnswer() {
    const isCorrect = userAnswer === correctAnswer;
    const messageEl = document.getElementById('message');
    
    if (isCorrect) {
        if (!usedTargetInCurrentProblem && mistakeCount === 0) {
            solvedProblems.add(gameData[level].id);
            saveSolvedProblems();
        }
        messageEl.textContent = '🎉 정답입니다!';
        messageEl.className = 'message success show';
        gameState = 'success';
        stopGame();
        setTimeout(() => {
            messageEl.classList.remove('show');
            if (level < gameData.length - 1) {
                level++;
                document.getElementById('levelNum').textContent = level + 1;
                speed = Math.max(400, speed - 100);
                startGame();
            } else {
                messageEl.innerHTML = '🏆 학습 완료! 축하합니다!';
                messageEl.className = 'message success show';
                gameState = 'complete';
                setTimeout(() => showButtons(), 3000);
            }
        }, 2000);
    } else {
        mistakeCount++;
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        gameState = 'failed';
        stopGame();
        setTimeout(() => {
            messageEl.classList.remove('show');
            showButtons();
        }, 2000);
    }
}

function showButtons() {
    const buttonsEl = document.getElementById('buttons');
    buttonsEl.innerHTML = `
        <button class="btn btn-reset" onclick="backToLevelSelect()">레벨 선택</button>
        ${gameState === 'failed' || gameState === 'stopped' ? '<button class="btn btn-start" onclick="startGame()">▶ 다시 시도</button>' : ''}
        ${gameState === 'complete' ? '<button class="btn btn-reset" onclick="backToMainMenu()">메인 메뉴</button>' : ''}
        <button class="btn btn-stop" onclick="logout()">로그아웃</button>
    `;
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

async function loadEncryptedData(category, levelNum) {
    const fileName = `${userClass}/${category}/${levelNum}_encrypted.dat`;
    const response = await fetch(`./data/${fileName}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return JSON.parse(wasmModule.decrypt_xor(bytes));
}

window.selectLevel = async function(category, levelNum) {
    selectedLevel = levelNum;
    try {
        const data = await loadEncryptedData(category, levelNum);
        const converted = data.map((item, i) => ({
            id: `${userClass}_${category}_${levelNum}_Q${String(i+1).padStart(3,'0')}`,
            description: item.description, answer: item.answer, category
        }));
        const unsolved = converted.filter(i => !solvedProblems.has(i.id));
        if (unsolved.length === 0) {
            console.log('모든 문제를 해결했습니다! 초기화할까요?');
            return;
        }
        gameData = unsolved;
        document.getElementById('levelSelector').classList.add('hidden');
        document.getElementById('gameArea').classList.remove('hidden');
        resetGame();
    } catch (e) { console.error('데이터 로드 실패', e); }
};

function resetGame() {
    level = 0;
    gameState = 'ready';
    stopGame();
    document.getElementById('levelNum').textContent = '1';
    document.getElementById('totalNum').textContent = gameData.length;
    document.getElementById('message').textContent = '';
    document.getElementById('buttons').innerHTML = '<button class="btn btn-start" onclick="startGame()">▶ 게임 시작</button>';
    grid = Array(CONFIG.GRID_ROWS).fill(null).map(() => Array(CONFIG.GRID_COLS).fill(null));
    fallingBlocks = [];
    updateDisplay();
}

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
    if (await initWasm() && checkLogin()) {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('gameContent').classList.remove('hidden');
        document.getElementById('undoBtn').onclick = handleUndo;
        document.getElementById('bombBtn').onclick = handleBomb;
    }
});





