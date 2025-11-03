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
    
    var totalCells = cols * rows;
    
    // 학생 레이어 생성
    for (var i = 0; i < totalCells; i++) {
        var cell = document.createElement('div');
        cell.className = 'cell student-cell';
        cell.dataset.index = i;
        
        var content = document.createElement('div');
        content.className = 'cell-content';
        cell.appendChild(content);
        
        cell.addEventListener('click', function(e) {
            handleCellClick(parseInt(this.dataset.index), e);
        });
        
        manuscriptPaper.appendChild(cell);
        studentCells.push(cell);
        studentData.push('');
    }
    
    // 선생님 레이어 생성 (투명)
    for (var i = 0; i < totalCells; i++) {
        var cell = document.createElement('div');
        cell.className = 'cell teacher-cell';
        cell.dataset.index = i;
        
        var content = document.createElement('div');
        content.className = 'cell-content';
        cell.appendChild(content);
        
        manuscriptPaper.appendChild(cell);
        teacherCells.push(cell);
        teacherData.push('');
    }
    
    // 조합용 숨김 input 생성
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
    
    // 이벤트 설정
    setupInputEvents();
    
    currentPos = 0;
}

// 셀 렌더링
function renderCell(idx) {
    if (idx < 0 || idx >= studentData.length) return;
    
    var cell = studentCells[idx];
    var content = cell.querySelector('.cell-content');
    
    if (content) {
        content.textContent = studentData[idx] || '';
    }
}

// 셀 클릭 핸들러
function handleCellClick(idx, e) {
    // 버퍼 확정 (WASM 사용)
    if (window.inputHandler) {
        var bufferResult = window.inputHandler.finalize_buffer();
        if (bufferResult && bufferResult !== null) {
            handleInputResults(bufferResult);
        }
    }
    
    // 일반 클릭 - 커서 이동 및 입력 준비
    clearSelection();
    
    // ★★★ 덮어쓰기: 클릭한 셀의 기존 내용 완전히 제거 ★★★
    studentData[idx] = '';
    delete studentCells[idx].dataset.special;
    delete studentCells[idx].dataset.temp;
    renderCell(idx);
    
    // WASM inputHandler 위치 설정
    if (window.inputHandler) {
        window.inputHandler.set_position(idx);
    }
    
    currentPos = idx;
    updateActiveCell();
    
    setTimeout(function() {
        var compositionInput = document.getElementById('compositionInput');
        if (compositionInput) {
            compositionInput.value = '';
            compositionInput.focus();
        }
    }, 10);
    
    isDragging = false;
    selectionStart = idx;
    isSelecting = true;
}

// 선택 해제
function clearSelection() {
    selectedCells = [];
    for (var i = 0; i < studentCells.length; i++) {
        studentCells[i].classList.remove('selected');
    }
    isSelecting = false;
    isDragging = false;
    selectionStart = -1;
}

// 원고 텍스트 가져오기
function getManuscriptText() {
    var text = '';
    for (var i = 0; i < rows; i++) {
        var line = '';
        for (var j = 0; j < cols; j++) {
            var idx = i * cols + j;
            var char = studentData[idx] || '';
            line += char;
        }
        // 빈 줄이어도 탭으로 표시
        text += line + '\n';
    }
    return text;
}

// 원고 텍스트 로드
function loadManuscriptText(text, savedCols, modifiedText, errorText, memo) {
    // 칸 수가 다르면 재초기화
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
    
    // 데이터 파싱
    var lines = text.split('\n');
    var idx = 0;
    
    for (var i = 0; i < lines.length && i < rows; i++) {
        var line = lines[i];
        for (var j = 0; j < cols; j++) {
            if (j < line.length) {
                studentData[idx] = line[j];
            } else {
                studentData[idx] = '';
            }
            renderCell(idx);
            idx++;
        }
    }
    
    // 나머지 셀 비우기
    while (idx < studentData.length) {
        studentData[idx] = '';
        renderCell(idx);
        idx++;
    }
    
    // 수정본 및 에러 라인 처리
    if (modifiedText) {
        loadModifiedText(modifiedText);
    }
    
    if (errorText) {
        loadErrorText(errorText);
    }
    
    // 메모 표시
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
    
    for (var i = 0; i < lines.length && i < rows; i++) {
        var line = lines[i];
        for (var j = 0; j < cols; j++) {
            if (j < line.length) {
                teacherData[idx] = line[j];
                var content = teacherCells[idx].querySelector('.cell-content');
                if (content) {
                    content.textContent = line[j];
                }
            } else {
                teacherData[idx] = '';
            }
            idx++;
        }
    }
    
    hasModifiedText = true;
}

// 에러 라인 로드
function loadErrorText(errorText) {
    if (!errorText || !errorLineSvg) return;
    
    errorMarks = [];
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
    if (!errorLineSvg) return;
    
    errorLineSvg.innerHTML = '';
    
    for (var i = 0; i < errorMarks.length; i++) {
        var idx = errorMarks[i];
        if (idx >= studentCells.length) continue;
        
        var cell = studentCells[idx];
        var rect = cell.getBoundingClientRect();
        var containerRect = manuscriptPaper.getBoundingClientRect();
        
        var x1 = rect.left - containerRect.left;
        var y = rect.bottom - containerRect.top - 2;
        var x2 = rect.right - containerRect.left;
        
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
    }
}

// 선생님 메모 숨기기
function hideTeacherMemo() {
    var memoPanel = document.getElementById('memoSidePanel');
    if (memoPanel) {
        memoPanel.style.display = 'none';
    }
}

// 전역으로 노출
window.initializePaper = initializePaper;
window.renderCell = renderCell;
window.handleCellClick = handleCellClick;
window.clearSelection = clearSelection;
window.getManuscriptText = getManuscriptText;
window.loadManuscriptText = loadManuscriptText;