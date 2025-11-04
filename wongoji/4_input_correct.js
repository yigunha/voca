// WASM 입력 핸들러 사용
let inputHandler = null;
let compositionInput = null;

// 입력 핸들러 초기화
async function initInputHandler() {
    if (!window.wasmModule || !window.wasmModule.InputHandler) {
        console.error('WASM module not loaded');
        return false;
    }
    
    try {
        inputHandler = new window.wasmModule.InputHandler(cols, rows);
        window.inputHandler = inputHandler; // 전역으로 노출
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
            compositionInput.focus();
        }
        
        // 화면에 보이도록 스크롤
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
                // 셀에 내용 배치
                if (result.clear_current) {
                    studentData[result.pos] = result.content;
                    var cell = studentCells[result.pos];
                    var content = cell.querySelector('.cell-content');
                    if (content) {
                        content.textContent = result.content;
                    }
                    
                    // 2글자 이상이면 special 표시
                    if (result.content.length > 1) {
                        cell.dataset.special = 'true';
                    } else {
                        delete cell.dataset.special;
                    }
                    delete cell.dataset.temp;
                }
                break;
                
            case 'buffer':
                // 버퍼 상태 표시 (임시)
                studentData[result.pos] = result.content;
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = result.content;
                }
                cell.dataset.temp = 'true';
                delete cell.dataset.special;
                break;
                
            case 'composing':
                // 한글 조합 중
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = result.content;
                }
                break;
                
            case 'clear_and_move':
                // 스페이스바: 현재 셀 비우고 이동
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
                // 삭제
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

// 이벤트 설정
function setupInputEvents() {
    compositionInput = document.getElementById('compositionInput');
    if (!compositionInput) {
        console.error('compositionInput not found!');
        return;
    }
    
    // 한글 조합 시작
    compositionInput.addEventListener('compositionstart', function() {
        if (!inputHandler) return;
        
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
        var result = inputHandler.update_composition(text);
        handleInputResults(result);
    });
    
    // 한글 조합 완료
    compositionInput.addEventListener('compositionend', function(e) {
        if (!inputHandler) return;
        
        isComposing = false;
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
        
        // Backspace
        if (e.key === 'Backspace') {
            e.preventDefault();
            
            if (selectedCells.length > 0) {
                // 선택된 셀들 삭제
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
                // 현재 셀이 비어있으면 이전 셀로 이동 후 삭제
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
        
        // Arrow keys
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (inputHandler.move_left()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (inputHandler.move_right()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (inputHandler.move_up()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (inputHandler.move_down()) {
                updateActiveCell();
            }
            return;
        }
        
        // Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            if (inputHandler.move_next_row()) {
                updateActiveCell();
            }
            return;
        }
    });
}

// 원고지 초기화 시 입력 핸들러도 초기화
async function initializePaperWithInput() {
    await initInputHandler();
    if (inputHandler) {
        inputHandler.set_position(0);
        updateActiveCell();
    }
}

// 전역으로 노출
window.setupInputEvents = setupInputEvents;
window.updateActiveCell = updateActiveCell;
window.initializePaperWithInput = initializePaperWithInput;
window.handleInputResults = handleInputResults;