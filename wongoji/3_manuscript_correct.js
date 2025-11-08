// 원고지 초기화
function initializePaper() {
    manuscriptPaper.innerHTML = '';
    studentCells = [];
    teacherCells = [];
    studentData = [];
    teacherData = [];
    errorMarks = [];
    
    // ★★★ 이 플래그를 초기화하는 코드가 필요합니다. (1_config.js에 넣어도 좋습니다)
    window.compositionCancelledByClick = false;
    
    manuscriptPaper.className = 'manuscript-paper';
    if (cols === 20) {
        manuscriptPaper.classList.add('cols-20');
    } else if (cols === 25) {
        manuscriptPaper.classList.add('cols-25');
    }
    
    var totalRows = rows * 2;
    
    for (var i = 0; i < totalRows; i++) {
        var isStudentRow = (i % 2 === 0);
        
        for (var j = 0; j < cols; j++) {
            var idx = i * cols + j;
            var cell = document.createElement('div');
            
            if (isStudentRow) {
                cell.className = 'cell student-cell';
                cell.dataset.index = idx;
                cell.dataset.layer = 'student';
                
                var content = document.createElement('div');
                content.className = 'cell-content';
                cell.appendChild(content);
                
                cell.addEventListener('click', function(e) {
                    var domIdx = parseInt(this.dataset.index);
                    // ★ Rust 함수 사용
                    var studentIdx = window.inputHandler.dom_to_student_index(domIdx);
                    handleCellClick(studentIdx, e);
                });
                
                cell.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    
                    var domIdx = parseInt(this.dataset.index);
                    var studentIdx = window.inputHandler.dom_to_student_index(domIdx);
                    
                    if (!e.shiftKey) {
                        isDragging = true;
                        selectionStart = studentIdx;
                        clearSelection();
                        addToSelection(studentIdx);
                    }
                });
                
                cell.addEventListener('mouseenter', function(e) {
                    if (!isDragging) return;
                    
                    var domIdx = parseInt(this.dataset.index);
                    var studentIdx = window.inputHandler.dom_to_student_index(domIdx);
                    
                    clearSelection();
                    var start = Math.min(selectionStart, studentIdx);
                    var end = Math.max(selectionStart, studentIdx);
                    for (var k = start; k <= end; k++) {
                        addToSelection(k);
                    }
                });
                
                manuscriptPaper.appendChild(cell);
                studentCells.push(cell);
                studentData.push('');
            } else {
                cell.className = 'cell teacher-cell';
                cell.dataset.index = idx;
                cell.dataset.layer = 'teacher';
                
                var content = document.createElement('div');
                content.className = 'cell-content';
                cell.appendChild(content);
                
                cell.style.cursor = 'default';
                
                manuscriptPaper.appendChild(cell);
                teacherCells.push(cell);
                teacherData.push('');
            }
        }
    }
    
    var existingInput = document.getElementById('compositionInput');
    if (existingInput) {
        existingInput.remove();
    }
    
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'compositionInput';
    input.className = 'composition-input';
    input.autocomplete = 'off';
    manuscriptPaper.appendChild(input);
    
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
        }
    });
    
    setupInputEvents();
    
    currentPos = 0;
    currentLayer = 'student';
    
    switchLayer('student');
    
    updateActiveCell();
}

// 셀 렌더링
function renderCell(idx) {
if (idx < 0 || idx >= studentData.length) return;
    
    var cell = studentCells[idx];
    if (!cell) return;
    
    var content = cell.querySelector('.cell-content');
    
    if (content) {
        content.textContent = studentData[idx] || '';
    }
}

// 선생님 셀 렌더링
function renderTeacherCell(idx) {
    if (idx < 0 || idx >= teacherData.length) return;
    
    var cell = teacherCells[idx];
    if (!cell) return;
    
    var content = cell.querySelector('.cell-content');
    
    if (content) {
        content.textContent = teacherData[idx] || '';
    }
}

// 선택에 셀 추가
function addToSelection(idx) {
    if (idx < 0 || idx >= studentCells.length) return;
    if (selectedCells.indexOf(idx) === -1) {
        selectedCells.push(idx);
    }
    studentCells[idx].classList.add('selected');
}

// 선택 해제
function clearSelection() {
    for (var i = 0; i < selectedCells.length; i++) {
        var idx = selectedCells[i];
        if (studentCells[idx]) {
            studentCells[idx].classList.remove('selected');
        }
    }
    selectedCells = [];
    isSelecting = false;
}

// ★★★★★ handleCellClick 함수 수정 ★★★★★
function handleCellClick(idx, e) {
    // 1. Composition(조합) 중인 경우 (한글 'ㅁ' 등)
    if (window.inputHandler && window.inputHandler.is_composing()) {
        
        // ★★★ (A) 플래그 설정: 'compositionend' 이벤트 무시
        window.compositionCancelledByClick = true; 
        
        // (B) WASM에 조합 종료 알림
        window.inputHandler.end_composition(); 
        
        // (C) 숨겨진 <input> 값 비우기
        var compositionInput = document.getElementById('compositionInput');
        if (compositionInput) {
            compositionInput.value = '';
        }
    }
    
    // 2. 버퍼(buffer1)에 내용이 있는 경우 (영어 'a' 등)
    if (window.inputHandler) {
        var oldPos = window.inputHandler.get_position(); // 현재 포지션을 저장
        
        // (A) Rust의 버퍼(buffer1, buffer2)를 비웁니다.
        window.inputHandler.clear_all_buffers(); 
        
        // (B) 현재 셀(oldPos)에 'data-temp'로 표시된 
        //     임시 버퍼 내용("ㅁ" 또는 "a")을 DOM에서 지웁니다.
        if (oldPos >= 0 && oldPos < studentCells.length) {
            var oldCell = studentCells[oldPos];
            if (oldCell.dataset.temp) {
                studentData[oldPos] = ''; // JS 데이터 클리어
                var content = oldCell.querySelector('.cell-content');
                if (content) content.textContent = ''; // DOM 클리어
                delete oldCell.dataset.temp; // 임시 상태 제거
            }
        }
    }
    
    // 3. (이후 로직은 동일)
    //    새로운 셀로 커서를 이동시킵니다.
    if (e.shiftKey) {
        e.preventDefault();
        
        var start = Math.min(currentPos, idx);
        var end = Math.max(currentPos, idx);
        
        clearSelection();
        for (var i = start; i <= end; i++) {
            addToSelection(i);
        }
        return;
    }
    
    clearSelection();
    
    currentPos = idx;
    
    if (window.inputHandler) {
        window.inputHandler.set_position(idx);
    }
    
    updateActiveCell();
    
    setTimeout(function() {
        var compositionInput = document.getElementById('compositionInput');
        if (compositionInput) {
            compositionInput.value = '';
            compositionInput.focus();
        }
    }, 10);
}

// 원고 텍스트 가져오기 - ★ Rust 함수 사용
function getManuscriptText() {
    if (window.inputHandler) {
        return window.inputHandler.build_manuscript_text(studentData);
    }
    
    // 폴백 (WASM 로드 전)
    var lines = [];
    var studentRowCount = 0;
    
    for (var i = 0; i < rows; i++) {
        if (i % 2 === 0) {
            var cells = [];
            for (var j = 0; j < cols; j++) {
                var idx = studentRowCount * cols + j;
                if (idx < studentData.length) {
                    cells.push(studentData[idx] || '');
                } else {
                    cells.push('');
                }
            }
            lines.push(cells.join('\t'));
            studentRowCount++;
        }
    }
    return lines.join('\n');
}

// 원고 텍스트 로드
function loadManuscriptText(text, savedCols, modifiedText, errorText, memo) {
    if (savedCols !== cols) {
        cols = savedCols;
        
        if (cols === 20) {
            rows = 20;
            paperType = '20';
        } else if (cols === 25) {
            var lines = text.split('\n').filter(function(line) { return line.length > 0; });
            rows = lines.length <= 12 ? 12 : 28;
            paperType = rows === 12 ? '25-300' : '25-700';
        }
        
        colsSelect.value = paperType;
        initializePaper();
    }
    
    // ★ Rust 함수로 파싱
    if (window.inputHandler) {
        var parsedData = window.inputHandler.parse_manuscript_text(text);
        for (var i = 0; i < parsedData.length && i < studentData.length; i++) {
            studentData[i] = parsedData[i];
            renderCell(i);
        }
    } else {
        // 폴백
        var lines = text.split('\n');
        var idx = 0;
        
        for (var i = 0; i < lines.length && idx < studentData.length; i++) {
            var cells = lines[i].split('\t');
            for (var j = 0; j < cols; j++) {
                if (j < cells.length) {
                    studentData[idx] = cells[j] || '';
                } else {
                    studentData[idx] = '';
                }
                renderCell(idx);
                idx++;
            }
        }
        
        while (idx < studentData.length) {
            studentData[idx] = '';
            renderCell(idx);
            idx++;
        }
    }
    
    if (modifiedText) {
        loadModifiedText(modifiedText);
    }
    
    if (errorText) {
        loadErrorText(errorText);
    }
    
    if (memo && memo.trim()) {
        showTeacherMemo(memo);
    } else {
        hideTeacherMemo();
    }
    
    currentPos = 0;
    
    if (window.inputHandler) {
        window.inputHandler.set_position(0);
    }
    
    updateActiveCell();
}

// 수정본 로드
function loadModifiedText(modifiedText) {
    if (!modifiedText) return;
    
    // ★ Rust 함수로 파싱
    if (window.inputHandler) {
        var parsedData = window.inputHandler.parse_manuscript_text(modifiedText);
        for (var i = 0; i < parsedData.length && i < teacherData.length; i++) {
            teacherData[i] = parsedData[i];
            renderTeacherCell(i);
        }
    } else {
        // 폴백
        var lines = modifiedText.split('\n');
        var idx = 0;
        
        for (var i = 0; i < lines.length && idx < teacherData.length; i++) {
            var cells = lines[i].split('\t');
            for (var j = 0; j < cols; j++) {
                if (j < cells.length) {
                    teacherData[idx] = cells[j] || '';
                } else {
                    teacherData[idx] = '';
                }
                renderTeacherCell(idx);
                idx++;
            }
        }
    }
    
    hasModifiedText = true;
}

// 에러 라인 로드 - ★ Rust 함수 사용
function loadErrorText(errorText) {
    if (!errorText || !errorLineSvg) return;
    
    errorMarks = [];
    
    if (window.inputHandler) {
        try {
            errorMarks = window.inputHandler.parse_error_marks(errorText);
            drawErrorLines();
        } catch (e) {
            console.error('Error parsing error marks:', e);
        }
        return;
    }
    
    // 폴백 (WASM 로드 전)
    try {
        var jsonMarks = JSON.parse(errorText);
        
        if (Array.isArray(jsonMarks) && jsonMarks.length > 0) {
            for (var i = 0; i < jsonMarks.length; i++) {
                var mark = jsonMarks[i];
                for (var col = mark.startCol; col <= mark.endCol; col++) {
                    var cellIndex = mark.row * cols + col;
                    errorMarks.push(cellIndex);
                }
            }
            drawErrorLines();
            return;
        }
    } catch (e) {
        console.log('JSON 파싱 실패, 텍스트 형식으로 시도:', e);
    }
    
    var lines = errorText.split('\n');
    
    for (var i = 0; i < lines.length; i++) {
        var positions = lines[i].split(',').map(function(p) { return parseInt(p.trim()); });
        for (var j = 0; j < positions.length; j++) {
            if (!isNaN(positions[j])) {
                errorMarks.push(i * cols + positions[j]);
            }
        }
    }
    
    drawErrorLines();
}

// 에러 라인 그리기
function drawErrorLines() {
    if (!errorLineSvg || !manuscriptPaper) return;
    
    var paperRect = manuscriptPaper.getBoundingClientRect();
    var containerRect = manuscriptPaper.parentElement.getBoundingClientRect();
    
    errorLineSvg.style.width = paperRect.width + 'px';
    errorLineSvg.style.height = paperRect.height + 'px';
    errorLineSvg.style.left = (paperRect.left - containerRect.left) + 'px';
    errorLineSvg.style.top = (paperRect.top - containerRect.top) + 'px';
    
    errorLineSvg.setAttribute('width', paperRect.width);
    errorLineSvg.setAttribute('height', paperRect.height);
    errorLineSvg.setAttribute('viewBox', '0 0 ' + paperRect.width + ' ' + paperRect.height);
    
    errorLineSvg.innerHTML = '';
    
    var LINE_OFFSET_Y = -8;
    
    for (var i = 0; i < errorMarks.length; i++) {
        var idx = errorMarks[i];
        if (idx >= studentCells.length || !studentCells[idx]) continue;
        
        var cell = studentCells[idx];
        var cellRect = cell.getBoundingClientRect();
        
        var x1 = cellRect.left - paperRect.left;
        var y = cellRect.bottom - paperRect.top + LINE_OFFSET_Y;
        var x2 = cellRect.right - paperRect.left;
        
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'red');
        line.setAttribute('stroke-width', '4');
        
        errorLineSvg.appendChild(line);
    }
}

// 선생님 메모 표시
function showTeacherMemo(memo) {
    var memoPanel = document.getElementById('memoSidePanel');
    var memoContent = document.getElementById('memoSideContent');
    
    if (memoPanel && memoContent) {
        memoContent.textContent = memo;
        memoPanel.style.display = 'block';
        
        setTimeout(function() {
            adjustMemoPanelPosition();
        }, 100);
    }
}

// 선생님 메모 숨기기
function hideTeacherMemo() {
    var memoPanel = document.getElementById('memoSidePanel');
    if (memoPanel) {
        memoPanel.style.display = 'none';
    }
}

// 메모 패널 위치 조정
function adjustMemoPanelPosition() {
    var memoPanel = document.getElementById('memoSidePanel');
    var manuscriptPaper = document.getElementById('manuscriptPaper');
    var manuscriptWrapper = document.querySelector('.manuscript-wrapper');
    
    if (!memoPanel || !manuscriptPaper || !manuscriptWrapper) return;
    if (memoPanel.style.display === 'none') return;
    
    var wrapperRect = manuscriptWrapper.getBoundingClientRect();
    var containerRect = document.querySelector('.manuscript-memo-container').getBoundingClientRect();
    
    var leftPosition = wrapperRect.right - containerRect.left + 20;
    memoPanel.style.left = leftPosition + 'px';
    
    var manuscriptHeight = manuscriptPaper.offsetHeight + 20;
    memoPanel.style.height = manuscriptHeight + 'px';
    
    var memoContent = document.getElementById('memoSideContent');
    if (memoContent) {
        memoContent.style.height = (manuscriptHeight - 52) + 'px';
    }
}

// 레이어 전환
function switchLayer(layer) {
    currentLayer = layer;
    
    if (layer === 'student') {
        for (var i = 0; i < studentCells.length; i++) {
            studentCells[i].style.display = '';
        }
        for (var i = 0; i < teacherCells.length; i++) {
            teacherCells[i].style.display = 'none';
        }
        
        var memoPanel = document.getElementById('memoSidePanel');
        if (memoPanel) {
            memoPanel.style.display = 'none';
        }
    } else if (layer === 'teacher') {
        for (var i = 0; i < studentCells.length; i++) {
            studentCells[i].style.display = '';
        }
        for (var i = 0; i < teacherCells.length; i++) {
            teacherCells[i].style.display = '';
        }
        
        var memoPanel = document.getElementById('memoSidePanel');
        if (memoPanel) {
            memoPanel.style.display = 'block';
            setTimeout(function() {
                adjustMemoPanelPosition();
            }, 100);
        }
    }
    
    updateActiveCell();
    drawErrorLines();
}

// Tab 키 이벤트
document.addEventListener('keydown', function(e) {
    if (!workArea || !workArea.classList.contains('show')) return;
    
    if (e.key === 'Tab') {
        e.preventDefault();
        if (currentLayer === 'student') {
            switchLayer('teacher');
        } else {
            switchLayer('student');
        }
    }
});

// 윈도우 리사이즈
window.addEventListener('resize', function() {
    adjustMemoPanelPosition();
    drawErrorLines();
});

window.addEventListener('scroll', function() {
    drawErrorLines();
});

// 전역으로 노출
window.initializePaper = initializePaper;
window.renderCell = renderCell;
window.renderTeacherCell = renderTeacherCell;
window.handleCellClick = handleCellClick;
window.clearSelection = clearSelection;
window.addToSelection = addToSelection;
window.getManuscriptText = getManuscriptText;
window.loadManuscriptText = loadManuscriptText;
window.switchLayer = switchLayer;
window.adjustMemoPanelPosition = adjustMemoPanelPosition;