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
    
    // 학생용 셀만 생성 (선생용 행 제거)
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            var idx = i * cols + j;
            var cell = document.createElement('div');
            
            // 학생용 셀
            cell.className = 'cell student-cell';
            cell.dataset.index = idx;
            cell.dataset.layer = 'student';
            
            var content = document.createElement('div');
            content.className = 'cell-content';
            cell.appendChild(content);
            
            // 클릭 이벤트
            cell.addEventListener('click', function(e) {
                var idx = parseInt(this.dataset.index);
                handleCellClick(idx, e);
            });
            
            // 드래그 선택 이벤트
            cell.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                isDragging = true;
                var idx = parseInt(this.dataset.index);
                selectionStart = idx;
                clearSelection();
                selectedCells.push(idx);
                this.classList.add('selected');
            });
            
            cell.addEventListener('mouseenter', function(e) {
                if (!isDragging) return;
                var idx = parseInt(this.dataset.index);
                clearSelection();
                var start = Math.min(selectionStart, idx);
                var end = Math.max(selectionStart, idx);
                for (var k = start; k <= end; k++) {
                    if (studentCells[k]) {
                        selectedCells.push(k);
                        studentCells[k].classList.add('selected');
                    }
                }
            });
            
            manuscriptPaper.appendChild(cell);
            studentCells.push(cell);
            studentData.push('');
        }
    }
    
    // 선생용 셀 생성 (별도 배열, DOM에는 추가 안 함)
    for (var i = 0; i < totalCells; i++) {
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
    
    // 마우스 업 이벤트 (드래그 종료)
    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
        }
    });
    
    // 이벤트 설정
    setupInputEvents();
    
    currentPos = 0;
    currentLayer = 'student';
    
    updateActiveCell();
}

// 셀 렌더링 (학생용만)
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
    
    // 선생님 셀은 DOM에 없으므로 데이터만 업데이트
    // Tab 키로 전환 시 동적 생성
}

// 셀 클릭 핸들러 (학생용만)
function handleCellClick(idx, e) {
    // 버퍼 확정
    if (window.inputHandler && window.inputHandler.finalize_buffer) {
        window.inputHandler.finalize_buffer();
    }
    
    // Shift 클릭: 범위 선택
    if (e.shiftKey && selectionStart >= 0) {
        clearSelection();
        var start = Math.min(selectionStart, idx);
        var end = Math.max(selectionStart, idx);
        for (var i = start; i <= end; i++) {
            if (studentCells[i]) {
                selectedCells.push(i);
                studentCells[i].classList.add('selected');
            }
        }
        return;
    }
    
    // 일반 클릭 - 커서 이동 및 입력 준비
    clearSelection();
    
    // 덮어쓰기: 클릭한 셀의 기존 내용 완전히 제거
    studentData[idx] = '';
    if (studentCells[idx]) {
        delete studentCells[idx].dataset.special;
        delete studentCells[idx].dataset.temp;
    }
    renderCell(idx);
    
    currentPos = idx;
    
    // WASM InputHandler에 위치 설정
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
    
    selectionStart = idx;
    isSelecting = true;
}

// 선택 해제
function clearSelection() {
    selectedCells = [];
    for (var i = 0; i < studentCells.length; i++) {
        if (studentCells[i]) {
            studentCells[i].classList.remove('selected');
        }
    }
    isSelecting = false;
    isDragging = false;
}

// 원고 텍스트 가져오기 (학생 데이터만)
function getManuscriptText() {
    var text = '';
    
    for (var i = 0; i < rows; i++) {
        var line = '';
        for (var j = 0; j < cols; j++) {
            var idx = i * cols + j;
            if (idx < studentData.length) {
                var char = studentData[idx] || '';
                line += char;
            }
        }
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
    
    // 학생 데이터 파싱
    var lines = text.split('\n');
    var idx = 0;
    
    for (var i = 0; i < lines.length && idx < studentData.length; i++) {
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
    
    // WASM InputHandler에 위치 설정
    if (window.inputHandler) {
        window.inputHandler.set_position(0);
    }
    
    updateActiveCell();
}

// 수정본 로드 (선생님 데이터에만 저장)
function loadModifiedText(modifiedText) {
    if (!modifiedText) return;
    
    var lines = modifiedText.split('\n');
    var idx = 0;
    
    for (var i = 0; i < lines.length && idx < teacherData.length; i++) {
        var line = lines[i];
        for (var j = 0; j < cols; j++) {
            if (j < line.length) {
                teacherData[idx] = line[j];
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
        if (idx >= studentCells.length || !studentCells[idx]) continue;
        
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

// 메모 패널 위치 및 높이 조정
function adjustMemoPanelPosition() {
    var memoPanel = document.getElementById('memoSidePanel');
    var manuscriptPaper = document.getElementById('manuscriptPaper');
    var manuscriptWrapper = document.querySelector('.manuscript-wrapper');
    
    if (!memoPanel || !manuscriptPaper || !manuscriptWrapper) return;
    if (memoPanel.style.display === 'none') return;
    
    // 원고지의 실제 위치 계산
    var wrapperRect = manuscriptWrapper.getBoundingClientRect();
    var containerRect = document.querySelector('.manuscript-memo-container').getBoundingClientRect();
    
    // 메모 패널을 원고지 바로 오른쪽에 배치
    var leftPosition = wrapperRect.right - containerRect.left + 20; // 20px gap
    memoPanel.style.left = leftPosition + 'px';
    
    // 높이를 원고지와 동일하게
    var manuscriptHeight = manuscriptPaper.offsetHeight + 20; // padding 포함
    memoPanel.style.height = manuscriptHeight + 'px';
    
    // 메모 컨텐츠 높이 조정 (헤더 48px 제외)
    var memoContent = document.getElementById('memoSideContent');
    if (memoContent) {
        memoContent.style.height = (manuscriptHeight - 52) + 'px';
    }
}

// 레이어 전환 함수
function switchLayer(layer) {
    currentLayer = layer;
    
    if (layer === 'student') {
        // 학생 레이어만 표시
        for (var i = 0; i < studentCells.length; i++) {
            studentCells[i].style.display = '';
        }
        
        // 선생님 셀 숨기기 (있다면)
        var teacherCells = document.querySelectorAll('.teacher-cell');
        teacherCells.forEach(function(cell) {
            cell.style.display = 'none';
        });
        
        var memoPanel = document.getElementById('memoSidePanel');
        if (memoPanel) {
            memoPanel.style.display = 'none';
        }
    } else if (layer === 'teacher') {
        // 선생님 레이어 생성 및 표시
        createTeacherLayer();
        
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

// 선생님 레이어 동적 생성
function createTeacherLayer() {
    // 기존 선생님 셀 제거
    var existingTeacherCells = document.querySelectorAll('.teacher-cell');
    existingTeacherCells.forEach(function(cell) {
        cell.remove();
    });
    
    // 선생님 셀 재생성
    for (var i = 0; i < studentCells.length; i++) {
        var studentCell = studentCells[i];
        var teacherCell = document.createElement('div');
        
        teacherCell.className = 'cell teacher-cell';
        teacherCell.dataset.index = i;
        teacherCell.dataset.layer = 'teacher';
        
        var content = document.createElement('div');
        content.className = 'cell-content';
        content.textContent = teacherData[i] || '';
        teacherCell.appendChild(content);
        
        teacherCell.style.cursor = 'default';
        
        // 학생 셀 바로 다음에 삽입
        studentCell.parentNode.insertBefore(teacherCell, studentCell.nextSibling);
    }
}

// Tab 키 이벤트 리스너
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

// 윈도우 리사이즈 시 메모 패널 재조정
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
window.getManuscriptText = getManuscriptText;
window.loadManuscriptText = loadManuscriptText;
window.switchLayer = switchLayer;
window.adjustMemoPanelPosition = adjustMemoPanelPosition;