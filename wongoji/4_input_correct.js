// 4_input_correct.js

// WASM 입력 핸들러 사용
let inputHandler = null;
let compositionInput = null;
// ⭐ [수정] let lastCompositionData = ''; (제거 - 1_config.js의 전역 변수 사용)

// 입력 핸들러 초기화
async function initInputHandler() {
    if (!window.wasmModule || !window.wasmModule.InputHandler) {
        console.error('WASM module not loaded');
        return false;
    }
    
    try {
        inputHandler = new window.wasmModule.InputHandler(cols, rows);
        window.inputHandler = inputHandler;
        return true;
    } catch (e) {
        console.error('Failed to initialize input handler:', e);
        return false;
    }
}

// 활성 셀 업데이트
function updateActiveCell() {
    if (!inputHandler) return;
    
    for (var i = 0; i < studentCells.length; i++) {
        studentCells[i].classList.remove('active');
    }
    
    var pos = inputHandler.get_position();
    if (pos >= 0 && pos < studentCells.length) {
        var activeCell = studentCells[pos];
        activeCell.classList.add('active');
        
        if (compositionInput) {
            compositionInput.style.top = activeCell.offsetTop + 'px';
            compositionInput.style.left = activeCell.offsetLeft + 'px';
            
            setTimeout(function() {
                if (document.activeElement !== compositionInput) {
                    compositionInput.focus({ preventScroll: true });
                }
            }, 0);
        }
        
        var rect = activeCell.getBoundingClientRect();
        var isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        
        if (!isVisible) {
            activeCell.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }
    
    currentPos = pos;
}

// 입력 결과 처리
function handleInputResults(results) {
    if (!results || !Array.isArray(results)) {
        if (results && typeof results === 'object') {
            results = [results];
        } else {
            return;
        }
    }
    
    for (var i = 0; i < results.length; i++) {
        var result = results[i];
        
        switch (result.action) {
            case 'place':
                if (result.clear_current) {
                    studentData[result.pos] = result.content;
                    var cell = studentCells[result.pos];
                    var content = cell.querySelector('.cell-content');
                    if (content) {
                        content.textContent = result.content;
                    }
                    
                    if (result.content.length > 1) {
                        cell.dataset.special = 'true';
                    } else {
                        delete cell.dataset.special;
                    }
                    delete cell.dataset.temp;
                }
                break;
                
            case 'buffer':
                studentData[result.pos] = result.buffer1;
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = result.buffer1;
                }
                cell.dataset.temp = 'true';
                delete cell.dataset.special;
                break;
                
            case 'composing':
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = result.content;
                }
                cell.dataset.temp = 'true';
                delete cell.dataset.special;
                break;
                
            case 'clear_and_move':
                studentData[result.pos] = '';
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = '';
                }
                delete cell.dataset.special;
                delete cell.dataset.temp;
                break;
                
            case 'delete':
                studentData[result.pos] = '';
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = '';
                }
                delete cell.dataset.special;
                delete cell.dataset.temp;
                break;
        }
    }
    
    updateActiveCell();
}

// 클립보드에 복사
function copySelectedCells() {
    if (selectedCells.length === 0) return false;
    
    // 선택된 셀들을 정렬
    var sortedCells = selectedCells.slice().sort(function(a, b) { return a - b; });
    
    clipboard = [];
    for (var i = 0; i < sortedCells.length; i++) {
        var idx = sortedCells[i];
        clipboard.push({
            index: idx,
            content: studentData[idx] || '',
            relativePos: idx - sortedCells[0]
        });
    }
    
    return true;
}

// 클립보드에서 붙여넣기
function pasteClipboard() {
    if (clipboard.length === 0) return false;
    if (!inputHandler) return false;
    
    var startPos = inputHandler.get_position();
    
    for (var i = 0; i < clipboard.length; i++) {
        var item = clipboard[i];
        var targetPos = startPos + item.relativePos;
        
        if (targetPos >= 0 && targetPos < studentData.length) {
            studentData[targetPos] = item.content;
            renderCell(targetPos);
        }
    }
    
    updateActiveCell();
    return true;
}

// 선택된 셀 잘라내기
function cutSelectedCells() {
    if (!copySelectedCells()) return false;
    
    // 선택된 셀들 삭제
    for (var i = 0; i < selectedCells.length; i++) {
        var idx = selectedCells[i];
        studentData[idx] = '';
        var content = studentCells[idx].querySelector('.cell-content');
        if (content) content.textContent = '';
        delete studentCells[idx].dataset.special;
        delete studentCells[idx].dataset.temp;
    }
    
    clearSelection();
    updateActiveCell();
    return true;
}

// 이벤트 설정
function setupInputEvents() {
    compositionInput = document.getElementById('compositionInput');
    if (!compositionInput) {
        console.error('compositionInput not found!');
        return;
    }
    
    // 한글 조합 시작
    compositionInput.addEventListener('compositionstart', function(e) {
        if (!inputHandler) return;
        
        lastCompositionData = ''; // 전역 변수
        inputHandler.start_composition();
        isComposing = true;
        compositionInput.classList.add('is-composing');
        
        var pos = inputHandler.get_position();
        if (pos >= 0 && pos < studentCells.length) {
            studentCells[pos].classList.add('is-composing');
        }
    });
    
    // 한글 조합 업데이트
    compositionInput.addEventListener('compositionupdate', function(e) {
        if (!inputHandler) return;
        
        var text = e.data || '';
        var currentLength = text.length;
        var lastLength = lastCompositionData.length; // 전역 변수
        
        if (currentLength > lastLength && lastLength > 0) {
            var completedChars = text.substring(0, currentLength - 1);
            for (var i = lastLength - 1; i < completedChars.length; i++) {
                var result = inputHandler.place_char_and_move(completedChars[i]);
                handleInputResults(result);
            }
            
            var lastChar = text[currentLength - 1];
            var result = inputHandler.update_composition(lastChar);
            handleInputResults(result);
        } else {
            var result = inputHandler.update_composition(text);
            handleInputResults(result);
        }
        
        lastCompositionData = text; // 전역 변수
    });
    
    // ⭐ [수정] 한글 조합 완료 (전체 교체)
    compositionInput.addEventListener('compositionend', function(e) {
        
        // ⭐ [수정] 클릭 핸들러가 이미 처리했다면, 중복 실행 방지
        if (window.g_composition_finalized_by_click) {
            // console.log('CompositionEnd: Blocked, already handled by click.');
            window.g_composition_finalized_by_click = false; // 플래그만 리셋하고 종료
            return; 
        }

        // (기존) 조합 중복 실행 방지 (이것도 그대로 둠)
        if (!inputHandler || !isComposing) {
            // console.log('CompositionEnd: Blocked, isComposing is false.');
            return;
        }
        
        // console.log('CompositionEnd: Handling finalization.');

        isComposing = false;
        inputHandler.end_composition();
        compositionInput.classList.remove('is-composing');
        
        for (var i = 0; i < studentCells.length; i++) {
            studentCells[i].classList.remove('is-composing');
        }
        
        var text = e.data || '';
        if (text) {
            compositionInput.value = '';
            var result = inputHandler.finalize_composition(text);
            handleInputResults(result);
        }
        
        lastCompositionData = ''; // 전역 변수 초기화
    });
    
    // 일반 입력
    compositionInput.addEventListener('input', function(e) {
        if (!inputHandler || inputHandler.is_composing()) return;
        
        var text = e.target.value;
        if (text) {
            compositionInput.value = '';
            var result = inputHandler.process_input(text);
            handleInputResults(result);
        }
    });
    
    // 키보드 이벤트
    compositionInput.addEventListener('keydown', function(e) {
        if (!inputHandler) return;
        if (e.isComposing) return;
        
        // Ctrl/Cmd + C (복사)
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            if (selectedCells.length > 0) {
                copySelectedCells();
                console.log('복사됨:', selectedCells.length + '개 셀');
            }
            return;
        }
        
        // Ctrl/Cmd + X (잘라내기)
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
            e.preventDefault();
            if (selectedCells.length > 0) {
                if (cutSelectedCells()) {
                    console.log('잘라내기 완료');
                }
            }
            return;
        }
        
        // Ctrl/Cmd + V (붙여넣기)
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            e.preventDefault();
            if (clipboard.length > 0) {
                if (pasteClipboard()) {
                    console.log('붙여넣기 완료');
                }
            }
            return;
        }
        
        // Backspace
        if (e.key === 'Backspace') {
            e.preventDefault();
            
            if (selectedCells.length > 0) {
                for (var i = 0; i < selectedCells.length; i++) {
                    var idx = selectedCells[i];
                    studentData[idx] = '';
                    var content = studentCells[idx].querySelector('.cell-content');
                    if (content) content.textContent = '';
                    delete studentCells[idx].dataset.special;
                    delete studentCells[idx].dataset.temp;
                }
                
                inputHandler.set_position(selectedCells[0]);
                clearSelection();
                updateActiveCell();
            } else {
                var pos = inputHandler.get_position();
                if (studentData[pos] === '' && pos > 0) {
                    inputHandler.move_left();
                    pos = inputHandler.get_position();
                }
                
                var result = inputHandler.handle_backspace();
                handleInputResults(result);
            }
            
            compositionInput.value = '';
            return;
        }
        
        // Space
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (e.shiftKey) return;
            
            var result = inputHandler.handle_space();
            handleInputResults(result);
            compositionInput.value = '';
            return;
        }
        
        // Delete
        if (e.key === 'Delete') {
            e.preventDefault();
            
            if (selectedCells.length > 0) {
                for (var i = 0; i < selectedCells.length; i++) {
                    var idx = selectedCells[i];
                    studentData[idx] = '';
                    var content = studentCells[idx].querySelector('.cell-content');
                    if (content) content.textContent = '';
                    delete studentCells[idx].dataset.special;
                    delete studentCells[idx].dataset.temp;
                }
                
                inputHandler.set_position(selectedCells[0]);
                clearSelection();
                updateActiveCell();
            } else {
                var result = inputHandler.handle_delete();
                handleInputResults(result);
            }
            
            compositionInput.value = '';
            return;
        }
        
        // Arrow keys - 선택 해제
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            clearSelection();
            if (inputHandler.move_left()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            clearSelection();
            if (inputHandler.move_right()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            clearSelection();
            if (inputHandler.move_up()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            clearSelection();
            if (inputHandler.move_down()) {
                updateActiveCell();
            }
            return;
        }
        
        // Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            clearSelection();
            if (inputHandler.move_next_row()) {
                updateActiveCell();
            }
            return;
        }
    });
    
    // 포커스 유지
    compositionInput.addEventListener('blur', function() {
        setTimeout(function() {
            if (workArea && workArea.classList.contains('show')) {
                compositionInput.focus({ preventScroll: true });
            }
        }, 10);
    });
    
    // 작업 패널 시 포커스 복구
    document.addEventListener('click', function(e) {
        if (workArea && workArea.classList.contains('show')) {
            if (!e.target.closest('.modal') && !e.target.closest('button')) {
                setTimeout(function() {
                    compositionInput.focus({ preventScroll: true });
                }, 10);
            }
        }
    });
}

// 워크지 초기화 시 입력 핸들러도 초기화
async function initializePaperWithInput() {
    await initInputHandler();
    if (inputHandler) {
        inputHandler.set_position(0);
        updateActiveCell();
    }
}

// 전역으로 내보내기
window.setupInputEvents = setupInputEvents;
window.updateActiveCell = updateActiveCell;
window.initializePaperWithInput = initializePaperWithInput;
window.handleInputResults = handleInputResults;
window.initInputHandler = initInputHandler;
window.copySelectedCells = copySelectedCells;
window.pasteClipboard = pasteClipboard;
window.cutSelectedCells = cutSelectedCells;