let wasmModule = null;

const CONFIG = {
    GRID_ROWS: 8,
    GRID_COLS: 9,
    FALL_SPEED: 100, 
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
let rowQueue = []; 
let activeRowCount = 0; 

// 화면 울렁임 원천 해제를 위한 고정 상태 변수
let isGridCompressed = false;
let compressedRowIndex = 0;

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
    const sortedBlocks = [...blocks].sort((a, b) => b.length - a.length);
    const rows = [];
    
    for (const block of sortedBlocks) {
        const blockLen = block.length;
        let bestRowIndex = -1;
        let minRemainingSpace = CONFIG.GRID_COLS + 1;
        
        for (let i = 0; i < rows.length; i++) {
            const currentLength = rows[i].reduce((sum, b) => sum + b.length, 0);
            const remainingSpace = CONFIG.GRID_COLS - currentLength;
            
            if (blockLen <= remainingSpace && remainingSpace < minRemainingSpace) {
                bestRowIndex = i;
                minRemainingSpace = remainingSpace;
            }
        }
        
        if (bestRowIndex !== -1) {
            rows[bestRowIndex].push(block);
        } else {
            rows.push([block]);
        }
    }
    
    rows.forEach(row => {
        for (let i = row.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [row[i], row[j]] = [row[j], row[i]];
        }
    });
    
    return rows.map((row, rowIndex) => ({
        blocks: row,
        rowIndex: rowIndex,
        spawnDelay: Math.random() * 800
    }));
}

function getFakeBlocks(currentLevel) {
    return []; 
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
// 3. 게임 진행 로직 (짜잔 즉시 완성 배치 시스템)
// ==========================================

function prepareInitialBlocks(correctBlocks) {
    let pool = [...correctBlocks];
    
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    return binPackBlocks(pool);
}

function instantlyPlaceBlocks() {
    rowQueue.forEach(rowData => {
        rowData.blocks.forEach(blockText => {
            const lane = findBestLane(blockText);
            if (lane !== null) {
                const blockLen = blockText.length;
                let maxRowForThisLane = CONFIG.GRID_ROWS;
                
                const colHeights = Array(CONFIG.GRID_COLS).fill(CONFIG.GRID_ROWS);
                for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
                        if (grid[r][c] !== null) {
                            colHeights[c] = r;
                            break;
                        }
                    }
                }
                
                for (let i = 0; i < blockLen; i++) {
                    maxRowForThisLane = Math.min(maxRowForThisLane, colHeights[lane + i]);
                }
                
                const targetRow = maxRowForThisLane - 1;
                if (targetRow >= 0) {
                    const cells = blockText.split('');
                    const blockId = blockIdCounter++;
                    const blockColor = getBlockColor(blockText);
                    
                    cells.forEach((cell, idx) => {
                        grid[targetRow][lane + idx] = {
                            char: cell,
                            blockText: blockText,
                            color: blockColor,
                            id: blockId,
                            blockLength: blockLen,
                            posInBlock: idx
                        };
                    });
                }
            }
        });
    });
    
    rowQueue = [];
    activeRowCount = 0;
    fallingBlocks = [];
    
    let highestActiveRow = CONFIG.GRID_ROWS;
    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
        if (grid[r].some(cell => cell !== null)) {
            highestActiveRow = r;
            break;
        }
    }
    compressedRowIndex = Math.max(0, highestActiveRow - 1);
    isGridCompressed = true;
    
    updateDisplay();
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
    
    isGridCompressed = false;
    compressedRowIndex = 0;
    
    gameState = 'playing';
    blockIdCounter = 0;
    gameStartTime = Date.now();
    mistakeCount = 0;
    currentLevelBombCount = 0;
    usedTargetInCurrentProblem = false;
    nextSpawnLane = 0;
    
    wasmModule.reset_undo_count();
    wasmModule.reset_bomb_usage();
    
    document.getElementById('description').textContent = currentGame.description;
    document.getElementById('target').textContent = correctAnswer.split('').map(c => c === " " ? "□" : c).join('');
    document.getElementById('target').classList.remove('show');
    document.getElementById('message').textContent = '';
    document.getElementById('buttons').innerHTML = '<button class="btn btn-stop" onclick="stopGameManually()">■ 게임 중단</button>';
    
    const gridEl = document.getElementById('grid');
    if (gridEl) gridEl.removeAttribute('data-init');

    rowQueue = prepareInitialBlocks(blocks);
    console.log("초기 배치 계산 완료:", rowQueue);

    stopGame();
    instantlyPlaceBlocks();
    
    startFalling();
    startGravity();
};

function spawnRowBlocks() { return; }
function checkRowCompletion() { return; }
function spawnBlock() { return; }
function refillSpaceB() { return; }

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
    const existsGrid = grid.some(row => row.some(c => c && c.blockText === nextNeededBlock));
    
    if (!existsGrid) {
        console.log(`긴급 복구 투입: [${nextNeededBlock}] 즉시 그리드 안착`);
        const lane = findBestLane(nextNeededBlock);
        if (lane !== null) {
            const blockLen = nextNeededBlock.length;
            let maxRowForThisLane = CONFIG.GRID_ROWS;
            const colHeights = Array(CONFIG.GRID_COLS).fill(CONFIG.GRID_ROWS);
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
                    if (grid[r][c] !== null) {
                        colHeights[c] = r;
                        break;
                    }
                }
            }
            for (let i = 0; i < blockLen; i++) {
                maxRowForThisLane = Math.min(maxRowForThisLane, colHeights[lane + i]);
            }
            const targetRow = maxRowForThisLane - 1;
            if (targetRow >= 0) {
                const cells = nextNeededBlock.split('');
                const blockId = blockIdCounter++;
                const blockColor = getBlockColor(nextNeededBlock);
                cells.forEach((cell, idx) => {
                    grid[targetRow][lane + idx] = {
                        char: cell,
                        blockText: nextNeededBlock,
                        color: blockColor,
                        id: blockId,
                        blockLength: blockLen,
                        posInBlock: idx
                    };
                });
            }
        }
        updateDisplay();
    }
}

function scheduleNextBlock() { return; }

function startFalling() {
    fallInterval = setInterval(() => {
        if (gameState !== 'playing') return;
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

function handleBlockClick(blockId) { return; }

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
            console.log(`되돌리기: [${lastBlock}] 즉시 그리드 재배치`);
            const lane = findBestLane(lastBlock);
            if (lane !== null) {
                const blockLen = lastBlock.length;
                let maxRowForThisLane = CONFIG.GRID_ROWS;
                const colHeights = Array(CONFIG.GRID_COLS).fill(CONFIG.GRID_ROWS);
                for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                    for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
                        if (grid[r][c] !== null) {
                            colHeights[c] = r;
                            break;
                        }
                    }
                }
                for (let i = 0; i < blockLen; i++) {
                    maxRowForThisLane = Math.min(maxRowForThisLane, colHeights[lane + i]);
                }
                const targetRow = maxRowForThisLane - 1;
                if (targetRow >= 0) {
                    const cells = lastBlock.split('');
                    const blockId = blockIdCounter++;
                    const blockColor = getBlockColor(lastBlock);
                    cells.forEach((cell, idx) => {
                        grid[targetRow][lane + idx] = {
                            char: cell,
                            blockText: lastBlock,
                            color: blockColor,
                            id: blockId,
                            blockLength: blockLen,
                            posInBlock: idx
                        };
                    });
                }
            }
        }
    }
    
    updateDisplay();
    checkAndInjectMissingBlock();
}

// 단순 스위칭 제어 핸들러 (이동만 순수 처리)
window.goToPrevProblem = function() {
    if (gameState !== 'playing') return;
    if (level > 0) {
        playClickSound();
        level--;
        document.getElementById('levelNum').textContent = level + 1;
        startGame();
    }
};

window.goToNextProblem = function() {
    if (gameState !== 'playing') return;
    if (gameData && level < gameData.length - 1) {
        playClickSound();
        level++;
        document.getElementById('levelNum').textContent = level + 1;
        startGame();
    }
};

function handleBomb() { return; }
window.handleResetSolved = function() { return; }

// ==========================================
// 5. 기타 필수 함수들
// ==========================================

function checkCollision(block) { return false; }

function stackBlock(block) {
    if (block.position < 0) return;
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
        for(let r=0; r<CONFIG.GRID_ROWS; r++) {
            for(let c=0; c<CONFIG.GRID_COLS; c++) {
                if(grid[r][c] && grid[r][c].id === blockId) {
                    blockCells.push({r, c, data: grid[r][c]});
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
}

// 고성능 무진동 인플레이스 고정 렌더러
function updateDisplay() {
    const gridEl = document.getElementById('grid');
    if (!gridEl) return;

    const firstVisibleEmptyRow = isGridCompressed ? compressedRowIndex : 0;
    
    if (!gridEl.getAttribute('data-init')) {
        gridEl.innerHTML = '';
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'row grid-row-static';
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                const cellEl = document.createElement('div');
                cellEl.className = 'cell';
                rowEl.appendChild(cellEl);
            }
            gridEl.appendChild(rowEl);
        }
        
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
        for(let i=0; i<remaining; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cell empty';
            josaRow.appendChild(emptyCell);
        }
        gridEl.appendChild(josaRow);
        gridEl.setAttribute('data-init', 'true');
    }

    const rowElements = gridEl.querySelectorAll('.grid-row-static');
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
        const rowEl = rowElements[row];
        if (row < firstVisibleEmptyRow) {
            rowEl.style.display = 'none'; 
            continue;
        }
        rowEl.style.display = 'flex';
        
        const cellElements = rowEl.children;
        for (let col = 0; col < CONFIG.GRID_COLS; col++) {
            const cellEl = cellElements[col];
            
            cellEl.className = 'cell';
            cellEl.style.backgroundColor = '';
            cellEl.style.color = '';
            cellEl.textContent = '';
            cellEl.onclick = null;
            if (cellEl.dataset.blockId) delete cellEl.dataset.blockId;
            
            if (grid[row][col]) {
                const cell = grid[row][col];
                renderCell(cellEl, cell.char, cell.color, cell.id, cell.posInBlock, cell.blockLength, false);
                cellEl.onclick = () => handleCellClick(row, col);
            } else {
                cellEl.classList.add('empty');
            }
        }
    }
    updateAnswerDisplay();
}

function updateAnswerDisplay() {
    const display = document.getElementById('answerDisplay');
    if (display) {
        display.innerHTML = userAnswer.split('').map(c => c === " " ? "□" : c).join('') + '<span class="blink">|</span>';
    }
    
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.disabled = answerHistory.length === 0 || gameState !== 'playing';
    }
    
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.disabled = (level === 0);
    if (nextBtn) nextBtn.disabled = (gameData.length === 0 || level === gameData.length - 1);
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
                startGame();
            } else {
                messageEl.innerHTML = '🏆 학습 완료! 축하합니다!';
                messageEl.className = 'message success show';
                gameState = 'complete';
                /* 학습완료 팝업이 1초 후에 화면에서 사라지도록 타임아웃 조율 */
                setTimeout(() => {
                    messageEl.classList.remove('show');
                }, 1000);
                setTimeout(() => showButtons(), 1000);
            }
        }, 2000);
    } else {
        mistakeCount++;
        messageEl.textContent = '❌ 틀렸습니다!';
        messageEl.className = 'message fail show';
        
        setTimeout(() => {
            messageEl.classList.remove('show');
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

function showNextProblemSelector(nextLevel) {
    showButtons();
}

window.selectNextProblem = function(idx) {
    level = idx;
    document.getElementById('levelNum').textContent = level + 1;
    startGame();
};

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
        
        gameData = converted;
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
    
    isGridCompressed = false;
    compressedRowIndex = 0;
    
    const gridEl = document.getElementById('grid');
    if (gridEl) gridEl.removeAttribute('data-init');
    
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

// 순수 아라비아 숫자 형태 인덱스만 드롭다운에 출력
window.toggleLevelDropdown = function() {
    const dropdown = document.getElementById('levelDropdown');
    
    if (dropdown.classList.contains('hidden')) {
        dropdown.innerHTML = '';
        
        if (gameData.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'level-dropdown-item';
            empty.textContent = '-';
            dropdown.appendChild(empty);
        } else {
            for (let i = 0; i < gameData.length; i++) {
                const item = document.createElement('div');
                item.className = 'level-dropdown-item';
                if (i === level) item.classList.add('level-dropdown-current');
                
                item.textContent = `${i + 1}`;
                item.onclick = (e) => {
                    e.stopPropagation();
                    closeLevelDropdown();
                    level = i;
                    document.getElementById('levelNum').textContent = level + 1;
                    startGame();
                };
                dropdown.appendChild(item);
            }
        }
        
        dropdown.classList.remove('hidden');
        setTimeout(() => document.addEventListener('click', closeLevelDropdownOutside), 0);
    } else {
        closeLevelDropdown();
    }
};

function closeLevelDropdown() {
    const dropdown = document.getElementById('levelDropdown');
    if (dropdown) dropdown.classList.add('hidden');
    document.removeEventListener('click', closeLevelDropdownOutside);
}

function closeLevelDropdownOutside(e) {
    const display = document.getElementById('levelDisplay');
    if (display && !display.contains(e.target)) {
        closeLevelDropdown();
    }
}

window.addEventListener('load', async () => {
    if (await initWasm() && checkLogin()) {
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('gameContent').classList.remove('hidden');
        document.getElementById('undoBtn').onclick = handleUndo;
    }
});