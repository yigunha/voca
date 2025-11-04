// 원고지 초기화
function initializePaper() {
    manuscriptPaper.innerHTML = '';
    studentCells = [];
    teacherCells = [];
    studentData = [];
    teacherData = [];
    errorMarks = [];
    
    // 현재 cols 값에 따라 클래스 설정
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
                
                // 클릭 이벤트
                cell.addEventListener('click', function(e) {
                    var domIdx = parseInt(this.dataset.index);
                    var studentIdx = domIndexToStudentIndex(domIdx);
                    handleCellClick(studentIdx, e);
                });
                
                // 드래그 선택 시작
                cell.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    
                    var domIdx = parseInt(this.dataset.index);
                    var studentIdx = domIndexToStudentIndex(domIdx);
                    
                    // Shift 클릭이 아닐 때만 드래그 모드 시작
                    if (!e.shiftKey) {
                        isDragging = true;
                        selectionStart = studentIdx;
                        clearSelection();
                        addToSelection(studentIdx);
                    }
                });
                
                // 드래그 중 선택 확장
                cell.addEventListener('mouseenter', function(e) {
                    if (!isDragging) return;
                    
                    var domIdx = parseInt(this.dataset.index);
                    var studentIdx = domIndexToStudentIndex(domIdx);
                    
                    // 시작점부터 현재 위치까지 선택
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
    
    // 마우스 업 이벤트 (드래그 종료)
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

// DOM 인덱스 → 학생 데이터 인덱스
function domIndexToStudentIndex(domIdx) {
    var domRow = Math.floor(domIdx / cols);
    var col = domIdx % cols;
    var studentRow = Math.floor(domRow / 2);
    return studentRow * cols + col;
}

// 학생 데이터 인덱스 → DOM 인덱스
function studentIndexToDomIndex(studentIdx) {
    var row = Math.floor(studentIdx / cols);
    var col = studentIdx % cols;
    return (row * 2) * cols + col;
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



// 셀 클릭 핸들러
function handleCellClick(idx, e) {
    var compositionInput = document.getElementById('compositionInput');
    
    if (compositionInput) {
        // 1. IME 강제 종료: blur() + compositionend 이벤트 dispatch
        compositionInput.blur();  // 포커스 해제
        
        // compositionend 강제 트리거 (data: ''로 빈 조합 종료 시뮬레이션)
        var endEvent = new CompositionEvent('compositionend', { bubbles: true, data: '' });
        compositionInput.dispatchEvent(endEvent);
        
        compositionInput.value = '';  // 값 초기화
    }
    
    // 2. WASM 버퍼 확정 및 composing 종료 (타임아웃으로 IME 안정화)
    setTimeout(function() {
        if (window.inputHandler) {
            window.inputHandler.end_composition();  // composing 플래그 false
            if (window.inputHandler.is_composing()) {
                // 만약 여전히 composing이면 finalize 강제
                var result = window.inputHandler.finalize_composition('');
                handleInputResults(result);
            } else {
                // 일반 버퍼 확정
                window.inputHandler.finalize_buffer();
            }
            
            // 현재 위치 +1의 temp 제거 (기존 코드 유지/보완)
            var oldPos = window.inputHandler.get_position();
            if (oldPos + 1 < studentCells.length) {
                var nextCell = studentCells[oldPos + 1];
                if (nextCell.dataset.temp) {
                    studentData[oldPos + 1] = '';
                    var nextContent = nextCell.querySelector('.cell-content');
                    if (nextContent) nextContent.textContent = '';
                    delete nextCell.dataset.temp;
                    delete nextCell.dataset.special;
                }
            }
            
            // 위치 이동
            window.inputHandler.set_position(idx);
            updateActiveCell();
        }
        
        // 3. 입력 요소 재생성 (선택적: IME 완전 리셋 위해)
        if (compositionInput) {
            compositionInput.remove();  // 기존 제거
            var newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.id = 'compositionInput';
            newInput.className = 'composition-input';
            newInput.autocomplete = 'off';
            manuscriptPaper.appendChild(newInput);
            setupInputEvents();  // 이벤트 재설정
            compositionInput = newInput;  // 참조 업데이트
        }
        
        // 포커스 복귀
        if (compositionInput) {
            compositionInput.focus({ preventScroll: true });
        }
    }, 20);  // 20ms 타임아웃 (조정 가능)
    
    // 나머지 기존 코드 (드래그 등)
    clearSelection();
    addToSelection(idx);
    isSelecting = true;
}



// 원고 텍스트 가져오기
function getManuscriptText() {
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
    
    hasModifiedText = true;
}

// 에러 라인 로드
function loadErrorText(errorText) {
    if (!errorText || !errorLineSvg) return;
    
    errorMarks = [];
    
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
    
    for (var i = 0; i < errorMarks.length; i++) {
        var idx = errorMarks[i];
        if (idx >= studentCells.length || !studentCells[idx]) continue;
        
        var cell = studentCells[idx];
        var cellRect = cell.getBoundingClientRect();
        
        var x1 = cellRect.left - paperRect.left;
        var y = cellRect.bottom - paperRect.top - 2;
        var x2 = cellRect.right - paperRect.left;
        
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'red');
        line.setAttribute('stroke-width', '2');
        
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
window.domIndexToStudentIndex = domIndexToStudentIndex;
window.studentIndexToDomIndex = studentIndexToDomIndex;