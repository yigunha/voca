// 선생님용 UI 컨트롤러

let app = null;
let currentPos = 0;
let allCells = [];
let isComposing = false;
let errorSelectionStart = null;

// DOM 요소
const elements = {
    loginArea: null,
    teacherArea: null,
    teacherNameInput: null,
    teacherPasswordInput: null,
    loginBtn: null,
    currentTeacherSpan: null,
    classFilter: null,
    studentSearch: null,
    manuscriptsList: null,
    editModal: null,
    manuscriptPaper: null,
    inputBox: null,
    prevContent: null,
    errorLineSvg: null,
};

// 초기화
async function initTeacherApp() {
    try {
        if (typeof window.initWongoApp !== 'function') {
            throw new Error('initWongoApp이 로드되지 않았습니다');
        }
        
        app = await window.initWongoApp();
        console.log('Teacher app initialized');
    } catch (error) {
        console.error('초기화 실패:', error);
        alert('앱 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
        return;
    }

    // DOM 요소
    elements.loginArea = document.getElementById('loginArea');
    elements.teacherArea = document.getElementById('teacherArea');
    elements.teacherNameInput = document.getElementById('teacherName');
    elements.teacherPasswordInput = document.getElementById('teacherPassword');
    elements.loginBtn = document.getElementById('loginBtn');
    elements.currentTeacherSpan = document.getElementById('currentTeacher');
    elements.classFilter = document.getElementById('classFilter');
    elements.studentSearch = document.getElementById('studentSearch');
    elements.manuscriptsList = document.getElementById('manuscriptsList');
    elements.editModal = document.getElementById('editModal');
    elements.manuscriptPaper = document.getElementById('manuscriptPaper');
    elements.inputBox = document.getElementById('inputBox');
    elements.prevContent = document.getElementById('prevContent');
    elements.errorLineSvg = document.getElementById('errorLineSvg');

    // 이벤트 리스너
    elements.loginBtn.addEventListener('click', handleLogin);
    elements.classFilter.addEventListener('change', loadManuscripts);
    elements.studentSearch.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loadManuscripts();
    });
    elements.inputBox.addEventListener('compositionstart', handleCompositionStart);
    elements.inputBox.addEventListener('compositionupdate', handleCompositionUpdate);
    elements.inputBox.addEventListener('compositionend', handleCompositionEnd);
    elements.inputBox.addEventListener('input', handleInput);
    elements.inputBox.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', () => {
        if (elements.editModal.classList.contains('show')) {
            drawErrorLines();
        }
    });
}

// 로그인
async function handleLogin() {
    const name = elements.teacherNameInput.value.trim();
    const password = elements.teacherPasswordInput.value.trim();
    
    if (!name || !password) {
        alert('이름과 비밀번호를 입력해주세요.');
        return;
    }

    try {
        await app.authenticateTeacher(name, password);
        
        elements.currentTeacherSpan.textContent = name + ' 선생님';
        elements.loginArea.style.display = 'none';
        elements.teacherArea.style.display = 'block';
        
        loadManuscripts();
    } catch (error) {
        alert(error.message);
    }
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        app.logout();
        elements.teacherNameInput.value = '';
        elements.teacherPasswordInput.value = '';
        elements.loginArea.style.display = 'block';
        elements.teacherArea.style.display = 'none';
        closeEditModal();
    }
}

// 원고 목록 불러오기
async function loadManuscripts() {
    const selectedClass = elements.classFilter.value;
    const searchName = elements.studentSearch.value.trim();
    
    try {
        const records = await app.loadManuscripts(
            searchName || null,
            selectedClass
        );
        
        if (!records || records.length === 0) {
            elements.manuscriptsList.innerHTML = '<p style="text-align:center; color:#888; padding:40px;">원고가 없습니다.</p>';
            return;
        }
        
        displayManuscriptCards(records);
    } catch (error) {
        alert('데이터 로드 실패: ' + error.message);
    }
}

function displayManuscriptCards(records) {
    const html = records.map(item => {
        const charCount = item.content ? item.content.replace(/\t/g, '').replace(/\n/g, '').length : 0;
        const date = new Date(item.updated_at || item.created_at);
        const dateStr = date.toLocaleDateString('ko-KR') + ' ' + 
                        date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
        
        const hasModified = item.modified_text ? true : false;
        const hasErrors = item.error_text ? true : false;
        
        const modifiedClass = hasModified ? 'has-modified' : 'no-modified';
        let modifiedText = hasModified ? '✓ 수정 완료' : '미수정';
        if (hasErrors) {
            const errorCount = (item.error_text.match(/-/g) || []).length;
            modifiedText += ` (빨간선 ${errorCount}개)`;
        }
        
        return `
            <div class="manuscript-card" onclick="openEditModal(${item.id})">
                <div class="card-header">
                    <span class="student-name">${item.student_name}</span>
                    <span class="class-badge">${item.class}</span>
                </div>
                <div class="title">${item.title || '제목 없음'}</div>
                <div class="info">📅 ${dateStr}</div>
                <div class="info">📝 ${charCount}자 (${item.cols || 20}칸)</div>
                <div class="modified-status ${modifiedClass}">${modifiedText}</div>
            </div>
        `;
    }).join('');
    
    elements.manuscriptsList.innerHTML = html;
}

// 원고 수정 모달 열기
async function openEditModal(manuscriptId) {
    try {
        const record = await app.loadManuscriptById(manuscriptId);
        
        document.getElementById('editTitle').textContent = 
            `${record.student_name} - ${record.title || '제목 없음'}`;
        
        const state = app.getState();
        initializePaper(state);
        
        elements.editModal.classList.add('show');
        document.querySelector('.input-box').classList.add('show');
        
        setTimeout(() => {
            elements.inputBox.focus();
            drawErrorLines();
        }, 100);
    } catch (error) {
        alert('원고를 불러올 수 없습니다: ' + error.message);
    }
}

function closeEditModal() {
    elements.editModal.classList.remove('show');
    document.querySelector('.input-box').classList.remove('show');
    errorSelectionStart = null;
    clearPreview();
}

// 원고지 초기화
function initializePaper(state) {
    const cols = state.cols;
    const rows = state.rows;
    
    elements.manuscriptPaper.className = `manuscript-paper cols-${cols}`;
    elements.manuscriptPaper.innerHTML = '';
    allCells = [];
    
    state.cells.forEach((cell, i) => {
        const cellDiv = document.createElement('div');
        cellDiv.className = cell.cell_type === 'student' ? 'cell student-cell' : 'cell teacher-cell';
        cellDiv.dataset.index = i;
        cellDiv.dataset.type = cell.cell_type;
        cellDiv.dataset.row = cell.row;
        cellDiv.dataset.col = cell.col;
        
        const content = document.createElement('div');
        content.className = 'cell-content';
        cellDiv.appendChild(content);
        
        // 이벤트 핸들러
        if (cell.cell_type === 'student') {
            cellDiv.addEventListener('click', handleStudentCellClick);
        } else {
            cellDiv.addEventListener('click', handleTeacherCellClick);
        }
        
        elements.manuscriptPaper.appendChild(cellDiv);
        allCells.push(cellDiv);
        
        // 셀 렌더링
        if (cell.text) {
            renderCell(i, cell.text);
        }
    });
    
    currentPos = state.current_pos;
    updateActiveCell();
    updateErrorDisplay(state);
}

// 학생 셀 클릭 (Ctrl+클릭으로 빨간선)
function handleStudentCellClick(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    
    e.preventDefault();
    
    const row = parseInt(this.dataset.row);
    const col = parseInt(this.dataset.col);
    
    // 빨간선 토글
    const state = app.toggleErrorMark(row, col);
    updateErrorDisplay(state);
    drawErrorLines();
}

// 선생님 셀 클릭
function handleTeacherCellClick(e) {
    const cellIndex = parseInt(this.dataset.index);
    currentPos = cellIndex;
    updateActiveCell();
    elements.inputBox.focus();
}

// 활성 셀 업데이트
function updateActiveCell() {
    allCells.forEach(cell => cell.classList.remove('active'));
    clearPreview();
    
    if (currentPos >= 0 && currentPos < allCells.length) {
        const cellDiv = allCells[currentPos];
        const cellType = cellDiv.dataset.type;
        
        if (cellType === 'teacher') {
            cellDiv.classList.add('active');
            cellDiv.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
            setTimeout(updateInputBoxPosition, 300);
            updatePrevContent();
        }
    }
}

// 입력창 위치 업데이트
function updateInputBoxPosition() {
    if (currentPos < 0 || currentPos >= allCells.length) return;
    
    const activeCell = allCells[currentPos];
    const rect = activeCell.getBoundingClientRect();
    const inputBoxElement = document.querySelector('.input-box');
    const inputBoxHeight = inputBoxElement.offsetHeight;
    
    let topPosition = rect.bottom + 10;
    if (topPosition + inputBoxHeight > window.innerHeight) {
        topPosition = rect.top - inputBoxHeight - 10;
    }
    if (topPosition < 0) topPosition = rect.bottom + 10;
    
    topPosition = Math.max(0, Math.min(window.innerHeight - inputBoxHeight, topPosition));
    inputBoxElement.style.top = topPosition + 'px';
}

// 미리보기
function clearPreview() {
    document.querySelectorAll('.preview-text, .preview-two-chars').forEach(el => el.remove());
}

function showPreview(text) {
    if (!text || currentPos < 0 || currentPos >= allCells.length) return;
    
    const cellType = allCells[currentPos].dataset.type;
    if (cellType !== 'teacher') return;
    
    clearPreview();
    const content = allCells[currentPos].querySelector('.cell-content');
    
    if (text.length === 2) {
        const span = document.createElement('span');
        span.className = 'preview-two-chars';
        span.innerHTML = `<span>${text[0]}</span><span>${text[1]}</span>`;
        content.appendChild(span);
    } else {
        const span = document.createElement('span');
        span.className = 'preview-text';
        span.textContent = text;
        content.appendChild(span);
    }
}

// 이전 내용 표시
function updatePrevContent() {
    elements.prevContent.innerHTML = '';
    if (currentPos > 0) {
        const state = app.getState();
        // 이전 선생님 셀 찾기
        for (let i = currentPos - 1; i >= 0; i--) {
            const cell = state.cells[i];
            if (cell.cell_type === 'teacher' && cell.text) {
                renderCellContent(elements.prevContent, cell.text, true);
                break;
            }
        }
    }
}

// 셀 렌더링
function renderCell(index, text) {
    if (index < 0 || index >= allCells.length) return;
    
    const content = allCells[index].querySelector('.cell-content');
    const cellType = allCells[index].dataset.type;
    const isTeacher = cellType === 'teacher';
    
    renderCellContent(content, text, isTeacher);
}

function renderCellContent(container, text, isTeacher = false) {
    container.innerHTML = '';
    if (!text) return;
    
    const colorClass = isTeacher ? ' teacher-char' : '';
    
    if (text.length === 2) {
        const span = document.createElement('span');
        span.className = 'two-chars';
        span.innerHTML = `<span class="${colorClass}">${text[0]}</span><span class="${colorClass}">${text[1]}</span>`;
        container.appendChild(span);
    } else {
        const span = document.createElement('span');
        const isPunc = text === '.' || text === ',';
        span.className = (isPunc ? 'char-punctuation-single' : 'char-main') + colorClass;
        span.textContent = text;
        container.appendChild(span);
    }
}

// 입력 이벤트
function handleCompositionStart() {
    isComposing = true;
    clearPreview();
}

function handleCompositionUpdate(e) {
    if (e.data) {
        const state = app.getState();
        const combined = state.waiting_char ? state.waiting_char + e.data : e.data;
        showPreview(combined);
    }
}

function handleCompositionEnd(e) {
    isComposing = false;
    clearPreview();
    if (e.data) {
        const state = app.processChar(e.data);
        updateUI(state);
    }
}

function handleInput(e) {
    if (isComposing) return;
    
    const value = e.target.value;
    if (value.length > 0) {
        const state = app.getState();
        const newChar = value.charAt(value.length - 1);
        const combined = state.waiting_char ? state.waiting_char + newChar : newChar;
        showPreview(combined);
        
        const newState = app.processChar(newChar);
        updateUI(newState);
    }
}

function handleKeyDown(e) {
    if (e.key === 'Backspace') {
        if (elements.inputBox.value === '') {
            e.preventDefault();
            const state = app.backspace();
            updateUI(state);
        }
    } else if (e.key === 'Delete') {
        e.preventDefault();
        const state = app.backspace();
        updateUI(state);
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const state = app.moveLeft();
        updateUI(state);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const state = app.moveRight();
        updateUI(state);
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const state = app.moveRight();
        updateUI(state);
    }
}

// UI 업데이트
function updateUI(state) {
    if (!state) return;
    
    currentPos = state.current_pos;
    elements.inputBox.value = state.waiting_char || '';
    
    // 변경된 셀만 재렌더링
    state.cells.forEach((cell, i) => {
        if (cell.text) {
            renderCell(i, cell.text);
        } else {
            const content = allCells[i].querySelector('.cell-content');
            content.innerHTML = '';
        }
    });
    
    updateActiveCell();
}

// 에러 표시 업데이트
function updateErrorDisplay(state) {
    // 모든 학생 셀의 에러 표시 제거
    allCells.forEach((cell, i) => {
        if (cell.dataset.type === 'student') {
            cell.classList.remove('has-error');
        }
    });
    
    // 빨간선 있는 셀에 표시
    state.error_marks.forEach(mark => {
        for (let col = mark.start_col; col <= mark.end_col; col++) {
            const cellIndex = mark.row * state.cols * 2 + col;
            if (cellIndex < allCells.length && allCells[cellIndex].dataset.type === 'student') {
                allCells[cellIndex].classList.add('has-error');
            }
        }
    });
}

// 빨간선 그리기
function drawErrorLines() {
    if (!elements.errorLineSvg) return;
    elements.errorLineSvg.innerHTML = '';
    
    const state = app.getState();
    if (!state || !state.error_marks) return;
    
    state.error_marks.forEach(mark => {
        drawErrorLine(mark.row, mark.start_col, mark.end_col, state.cols);
    });
}

function drawErrorLine(row, startCol, endCol, cols) {
    const startCellIndex = row * cols * 2 + startCol;
    const endCellIndex = row * cols * 2 + endCol;
    
    if (startCellIndex >= allCells.length || endCellIndex >= allCells.length) return;
    
    const startCell = allCells[startCellIndex];
    const endCell = allCells[endCellIndex];
    
    if (!startCell || !endCell) return;
    
    const container = elements.manuscriptPaper.getBoundingClientRect();
    const rect1 = startCell.getBoundingClientRect();
    const rect2 = endCell.getBoundingClientRect();
    
    const x1 = rect1.left - container.left;
    const y1 = rect1.bottom - container.top - 5;
    const x2 = rect2.right - container.left;
    const y2 = rect2.bottom - container.top - 5;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#FF0000');
    line.setAttribute('stroke-width', '3');
    
    elements.errorLineSvg.appendChild(line);
}

// 학생 원본 복사
function copyStudentToTeacher() {
    if (!confirm('학생 원본을 선생님 수정본으로 복사하시겠습니까?\n기존 수정 내용이 사라집니다.')) {
        return;
    }
    
    const state = app.copyStudentToTeacher();
    updateUI(state);
    alert('복사 완료!');
}

// 선생님 원고 지우기
function clearTeacherPaper() {
    if (!confirm('선생님 수정본을 모두 지우시겠습니까?')) {
        return;
    }
    
    const state = app.clearTeacherCells();
    updateUI(state);
    alert('지우기 완료!');
}

// 빨간선 모두 지우기
function clearErrorMarks() {
    if (!confirm('빨간선을 모두 지우시겠습니까?')) {
        return;
    }
    
    const state = app.clearErrorMarks();
    updateErrorDisplay(state);
    drawErrorLines();
    alert('지우기 완료!');
}

// 수정 내용 저장
async function saveModifiedText() {
    if (!app.currentManuscript) {
        alert('저장할 원고가 선택되지 않았습니다.');
        return;
    }
    
    try {
        const teacherText = app.getTeacherText();
        const errorText = app.getErrorText();
        const studentText = app.getStudentText();
        
        // 빈 내용 체크
        const hasTeacherContent = teacherText.trim().length > 0;
        if (!hasTeacherContent) {
            if (!confirm('수정 내용이 비어있습니다.\n저장하면 기존 수정본이 삭제됩니다.\n계속하시겠습니까?')) {
                return;
            }
        }
        
        await app.saveManuscript(
            app.currentManuscript.student_name,
            app.currentManuscript.class,
            app.currentManuscript.title,
            studentText
        );
        
        const state = app.getState();
        const totalMarks = state.error_marks.reduce((sum, mark) => 
            sum + (mark.end_col - mark.start_col + 1), 0
        );
        
        alert(`수정 내용이 저장되었습니다!\n빨간선: ${state.error_marks.length}개 (총 ${totalMarks}칸)`);
        loadManuscripts(); // 목록 새로고침
    } catch (error) {
        alert('저장 실패: ' + error.message);
    }
}

// 초기화 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeacherApp);
} else {
    initTeacherApp();
}

// 전역 함수 노출
window.logout = logout;
window.loadManuscripts = loadManuscripts;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.copyStudentToTeacher = copyStudentToTeacher;
window.clearTeacherPaper = clearTeacherPaper;
window.clearErrorMarks = clearErrorMarks;
window.saveModifiedText = saveModifiedText;