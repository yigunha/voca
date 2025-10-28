// 학생용 UI 컨트롤러

let app = null;
let currentPos = 0;
let allCells = [];
let isComposing = false;
let showTeacherMode = false; // 선생님 수정본 보기 모드

// DOM 요소
const elements = {
    studentNameInput: null,
    studentPasswordInput: null,
    classSelect: null,
    colsSelect: null,
    startBtn: null,
    workArea: null,
    infoArea: null,
    manuscriptPaper: null,
    inputBox: null,
    prevContent: null,
    charCount: null,
    teacherToggle: null,
};

// 초기화
async function initStudentApp() {
    try {
        if (typeof window.initWongoApp !== 'function') {
            throw new Error('initWongoApp이 로드되지 않았습니다');
        }
        
        app = await window.initWongoApp();
        console.log('Student app initialized');
    } catch (error) {
        console.error('초기화 실패:', error);
        alert('앱 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
        return;
    }

    // DOM 요소 가져오기
    elements.studentNameInput = document.getElementById('studentName');
    elements.studentPasswordInput = document.getElementById('studentPassword');
    elements.classSelect = document.getElementById('classSelect');
    elements.colsSelect = document.getElementById('colsSelect');
    elements.startBtn = document.getElementById('startBtn');
    elements.workArea = document.getElementById('workArea');
    elements.infoArea = document.getElementById('infoArea');
    elements.manuscriptPaper = document.getElementById('manuscriptPaper');
    elements.inputBox = document.getElementById('inputBox');
    elements.prevContent = document.getElementById('prevContent');
    elements.charCount = document.getElementById('charCount');
    elements.teacherToggle = document.getElementById('teacherToggle');

    // 쿠키에서 정보 불러오기
    loadFromCookies();

    // 이벤트 리스너
    elements.startBtn.addEventListener('click', handleStart);
    elements.inputBox.addEventListener('compositionstart', handleCompositionStart);
    elements.inputBox.addEventListener('compositionupdate', handleCompositionUpdate);
    elements.inputBox.addEventListener('compositionend', handleCompositionEnd);
    elements.inputBox.addEventListener('input', handleInput);
    elements.inputBox.addEventListener('keydown', handleKeyDown);
    
    if (elements.teacherToggle) {
        elements.teacherToggle.addEventListener('change', handleTeacherToggle);
    }
    
    window.addEventListener('resize', updateInputBoxPosition);
    window.addEventListener('scroll', updateInputBoxPosition);
}

// 쿠키 관리
function setCookie(name, value, days) {
    const expires = days ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}` : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function loadFromCookies() {
    const savedName = getCookie('studentName');
    const savedClass = getCookie('studentClass');
    const savedPassword = getCookie('studentPassword');
    
    if (savedName) elements.studentNameInput.value = savedName;
    if (savedClass) elements.classSelect.value = savedClass;
    if (savedPassword) elements.studentPasswordInput.value = savedPassword;
}

// 시작 버튼 핸들러
async function handleStart() {
    const name = elements.studentNameInput.value.trim();
    const password = elements.studentPasswordInput.value.trim();
    
    if (!name) {
        alert('이름을 입력해주세요.');
        return;
    }
    
    if (!password) {
        alert('비밀번호를 입력해주세요.');
        return;
    }

    try {
        await app.authenticateStudent(name, password);
        
        console.log('인증 성공:', name);
        
        // 쿠키 저장
        setCookie('studentName', name, 30);
        setCookie('studentClass', elements.classSelect.value, 30);
        setCookie('studentPassword', password, 30);
        
        // UI 설정
        elements.classSelect.disabled = true;
        elements.studentNameInput.disabled = true;
        elements.studentPasswordInput.style.display = 'none';
        document.querySelector('label[for="studentPassword"]').style.display = 'none';
        
        // 원고지 초기화
        const paperType = elements.colsSelect.value;
        let cols = 20, rows = 20;
        
        if (paperType === '20') {
            cols = 20; rows = 20;
        } else if (paperType === '25-300') {
            cols = 25; rows = 12;
        } else if (paperType === '25-700') {
            cols = 25; rows = 28;
        }
        
        initializePaper(cols, rows);
        
        elements.workArea.classList.add('show');
        elements.infoArea.classList.add('hide');
        
        setTimeout(() => {
            updateInputBoxPosition();
            elements.inputBox.focus();
        }, 100);
        
    } catch (error) {
        alert(error.message);
    }
}

// 원고지 초기화
function initializePaper(cols, rows) {
    // 학생 모드(false)로 엔진 초기화
    const state = app.initEngine(cols, rows, false);
    
    elements.manuscriptPaper.className = `manuscript-paper cols-${cols}`;
    elements.manuscriptPaper.innerHTML = '';
    allCells = [];
    showTeacherMode = false;
    
    for (let i = 0; i < state.cells.length; i++) {
        const cell = state.cells[i];
        const cellDiv = document.createElement('div');
        cellDiv.className = cell.cell_type === 'student' ? 'cell student-cell' : 'cell teacher-cell';
        cellDiv.dataset.index = i;
        cellDiv.dataset.type = cell.cell_type;
        
        const content = document.createElement('div');
        content.className = 'cell-content';
        cellDiv.appendChild(content);
        
        // 학생 셀만 클릭 가능
        if (cell.cell_type === 'student') {
            cellDiv.addEventListener('click', function() {
                if (!showTeacherMode) {
                    const clickedIndex = parseInt(this.dataset.index);
                    
                    // UI 위치 업데이트
                    currentPos = clickedIndex;
                    
                    // 엔진 위치를 강제로 동기화
                    syncEnginePosition(clickedIndex);
                    
                    // 대기 문자 초기화
                    const state = app.getState();
                    elements.inputBox.value = '';
                    
                    updateActiveCell();
                    elements.inputBox.focus();
                }
            });
        }
        
        elements.manuscriptPaper.appendChild(cellDiv);
        allCells.push(cellDiv);
    }
    
    // 선생님 셀 숨김
    state.cells.forEach((cell, i) => {
        if (cell.cell_type === 'teacher') {
            allCells[i].style.display = 'none';
        }
    });
    
    currentPos = state.current_pos;
    updateActiveCell();
    updateCharCount();
}

// 선생님 수정본 토글
function handleTeacherToggle() {
    showTeacherMode = elements.teacherToggle.checked;
    
    const state = app.getState();
    
    state.cells.forEach((cell, i) => {
        if (showTeacherMode) {
            // 선생님 셀 보이기, 학생 셀 숨기기
            if (cell.cell_type === 'teacher') {
                allCells[i].style.display = 'block';
            } else {
                allCells[i].style.display = 'none';
            }
        } else {
            // 학생 셀 보이기, 선생님 셀 숨기기
            if (cell.cell_type === 'student') {
                allCells[i].style.display = 'block';
            } else {
                allCells[i].style.display = 'none';
            }
        }
    });
    
    // 에러 마크 표시/숨김
    updateErrorDisplay(state);
    
    // active 클래스 제거
    allCells.forEach(cell => cell.classList.remove('active'));
}

// 활성 셀 업데이트
function updateActiveCell() {
    allCells.forEach(cell => cell.classList.remove('active'));
    clearPreview();
    
    if (currentPos >= 0 && currentPos < allCells.length) {
        const cellType = allCells[currentPos].dataset.type;
        if (cellType === 'student' && !showTeacherMode) {
            allCells[currentPos].classList.add('active');
            allCells[currentPos].scrollIntoView({
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
    if (showTeacherMode) return; // 선생님 모드에서는 입력창 숨김
    
    const activeCell = allCells[currentPos];
    if (!activeCell || activeCell.style.display === 'none') return;
    
    const rect = activeCell.getBoundingClientRect();
    const inputBoxElement = document.querySelector('.input-box');
    const inputBoxHeight = inputBoxElement.offsetHeight;
    
    let topPosition = rect.bottom + 50;
    if (topPosition + inputBoxHeight > window.innerHeight) {
        topPosition = rect.top - inputBoxHeight - 10;
    }
    if (topPosition < 0) topPosition = rect.bottom + 50;
    
    topPosition = Math.max(0, Math.min(window.innerHeight - inputBoxHeight, topPosition));
    inputBoxElement.style.top = topPosition + 'px';
}

// 미리보기
function clearPreview() {
    document.querySelectorAll('.preview-text, .preview-two-chars').forEach(el => el.remove());
}

function showPreview(text) {
    if (!text || currentPos < 0 || currentPos >= allCells.length) return;
    
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
    
    const state = app.getState();
    // 이전 학생 셀 찾기
    for (let i = currentPos - 1; i >= 0; i--) {
        const cell = state.cells[i];
        if (cell && cell.cell_type === 'student' && cell.text) {
            renderCellContent(elements.prevContent, cell.text);
            break;
        }
    }
}

// 셀 렌더링
function renderCell(index) {
    if (index < 0 || index >= allCells.length) return;
    
    const state = app.getState();
    const cell = state.cells[index];
    const content = allCells[index].querySelector('.cell-content');
    
    renderCellContent(content, cell.text);
}

function renderCellContent(container, text) {
    container.innerHTML = '';
    if (!text) return;
    
    if (text.length === 2) {
        const span = document.createElement('span');
        span.className = 'two-chars';
        span.innerHTML = `<span>${text[0]}</span><span>${text[1]}</span>`;
        container.appendChild(span);
    } else {
        const span = document.createElement('span');
        const isPunc = text === '.' || text === ',';
        span.className = isPunc ? 'char-punctuation-single' : 'char-main';
        span.textContent = text;
        container.appendChild(span);
    }
}

// 글자 수 업데이트
function updateCharCount() {
    const state = app.getState();
    let count = 0;
    state.cells.forEach(cell => {
        if (cell.cell_type === 'student' && cell.text) count++;
    });
    elements.charCount.textContent = count;
}

// 에러 표시 업데이트
function updateErrorDisplay(state) {
    if (!state.error_marks) return;
    
    // 모든 학생 셀의 에러 표시 제거
    allCells.forEach((cell, i) => {
        if (cell.dataset.type === 'student') {
            cell.classList.remove('has-error');
        }
    });
    
    // 에러가 있고 선생님 모드가 아닐 때만 표시
    if (!showTeacherMode) {
        state.error_marks.forEach(mark => {
            for (let col = mark.start_col; col <= mark.end_col; col++) {
                const cellIndex = mark.row * state.cols * 2 + col;
                if (cellIndex < allCells.length && allCells[cellIndex].dataset.type === 'student') {
                    allCells[cellIndex].classList.add('has-error');
                }
            }
        });
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
        // 엔진과 UI 위치 동기화 확인
        const beforeState = app.getState();
        if (beforeState.current_pos !== currentPos) {
            syncEnginePosition(currentPos);
        }
        
        const state = app.processChar(e.data);
        updateUI(state);
    }
}

function handleInput(e) {
    if (isComposing) return;
    if (showTeacherMode) return;
    
    const value = e.target.value;
    if (value.length > 0) {
        const newChar = value.charAt(value.length - 1);
        
        // 디버깅 로그
        console.log('Input char:', newChar, 'Code:', newChar.charCodeAt(0));
        
        // 엔진과 UI 위치 동기화 확인
        const beforeState = app.getState();
        console.log('Before - Engine pos:', beforeState.current_pos, 'UI pos:', currentPos, 'Waiting:', beforeState.waiting_char);
        
        if (beforeState.current_pos !== currentPos) {
            syncEnginePosition(currentPos);
        }
        
        const state = app.getState();
        const combined = state.waiting_char ? state.waiting_char + newChar : newChar;
        showPreview(combined);
        
        const newState = app.processChar(newChar);
        console.log('After - Engine pos:', newState.current_pos, 'Waiting:', newState.waiting_char);
        
        updateUI(newState);
    }
}

function handleKeyDown(e) {
    if (showTeacherMode) return; // 선생님 모드에서는 키 입력 불가
    
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
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveUp();
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveDown();
    } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        
        // 대기 중인 문자가 있으면 먼저 입력하고 다음 칸으로
        const beforeState = app.getState();
        if (beforeState.waiting_char) {
            console.log('Flushing waiting char:', beforeState.waiting_char);
            const state = app.flushWaitingChar();
            updateUI(state);
        } else {
            // 대기 문자가 없으면 그냥 다음 칸으로
            const state = app.moveRight();
            updateUI(state);
        }
    }
}

// 위로 이동
function moveUp() {
    const state = app.getState();
    const cols = state.cols * 2; // 학생 + 선생님 셀
    
    // 현재 위치에서 한 줄 위로
    const newPos = currentPos - cols;
    
    if (newPos >= 0 && state.cells[newPos] && state.cells[newPos].cell_type === 'student') {
        currentPos = newPos;
        syncEnginePosition(newPos);
        updateActiveCell();
    }
}

// 아래로 이동
function moveDown() {
    const state = app.getState();
    const cols = state.cols * 2; // 학생 + 선생님 셀
    
    // 현재 위치에서 한 줄 아래로
    const newPos = currentPos + cols;
    
    if (newPos < state.cells.length && state.cells[newPos] && state.cells[newPos].cell_type === 'student') {
        currentPos = newPos;
        syncEnginePosition(newPos);
        updateActiveCell();
    }
}

// 엔진 위치를 UI 위치로 강제 동기화
function syncEnginePosition(targetPos) {
    const state = app.getState();
    
    // 대기 문자가 있으면 초기화
    if (state.waiting_char) {
        state.waiting_char = '';
        elements.inputBox.value = '';
    }
    
    // 현재 엔진 위치
    let enginePos = state.current_pos;
    
    // 목표 위치까지 이동
    let attempts = 0;
    const maxAttempts = 1000; // 무한 루프 방지
    
    while (enginePos !== targetPos && attempts < maxAttempts) {
        if (enginePos < targetPos) {
            const newState = app.moveRight();
            enginePos = newState.current_pos;
        } else {
            const newState = app.moveLeft();
            enginePos = newState.current_pos;
        }
        attempts++;
    }
    
    // 최종 상태 확인
    const finalState = app.getState();
    if (finalState.current_pos !== targetPos) {
        console.warn('Position sync failed:', finalState.current_pos, 'vs', targetPos);
    }
}

// UI 업데이트
function updateUI(state) {
    if (!state) return;
    
    currentPos = state.current_pos;
    
    // 입력창의 값은 대기 문자만 표시
    const waitingChar = state.waiting_char || '';
    if (elements.inputBox.value !== waitingChar) {
        elements.inputBox.value = waitingChar;
    }
    
    // 모든 학생 셀 재렌더링
    state.cells.forEach((cell, i) => {
        if (cell.cell_type === 'student') {
            renderCell(i);
        }
    });
    
    updateActiveCell();
    updateCharCount();
    updateErrorDisplay(state);
}

// 저장
async function saveToSupabase() {
    if (!app.currentStudent) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    const content = app.getStudentText();
    if (!content.trim()) {
        alert('저장할 내용이 없습니다.');
        return;
    }
    
    document.getElementById('saveModal').classList.add('show');
    document.getElementById('saveTitle').value = '';
    document.getElementById('saveTitle').focus();
}

async function confirmSave() {
    const title = document.getElementById('saveTitle').value.trim();
    if (!title) {
        alert('제목을 입력해주세요.');
        return;
    }
    
    try {
        const content = app.getStudentText();
        await app.saveManuscript(
            app.currentStudent.name,
            elements.classSelect.value,
            title,
            content
        );
        alert('원고가 저장되었습니다!');
        closeSaveModal();
    } catch (error) {
        alert(error.message);
    }
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.remove('show');
}

// 불러오기
async function loadFromSupabase() {
    if (!app.currentStudent) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    try {
        const records = await app.loadManuscripts(
            app.currentStudent.name,
            elements.classSelect.value
        );
        
        if (!records || records.length === 0) {
            alert('저장된 원고가 없습니다.');
            return;
        }
        
        displayManuscriptList(records);
        document.getElementById('loadModal').classList.add('show');
    } catch (error) {
        alert(error.message);
    }
}

function displayManuscriptList(records) {
    const listHTML = records.map((item, index) => {
        const hasModified = item.modified_text ? ' <span class="modified-badge">(선생님 수정본)</span>' : '';
        const hasError = item.error_text ? ' <span class="modified-badge">(빨간선)</span>' : '';
        const date = new Date(item.updated_at || item.created_at);
        const dateStr = date.toLocaleDateString('ko-KR') + ' ' + 
                        date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
        
        const charCount = item.content ? item.content.replace(/\t/g, '').replace(/\n/g, '').length : 0;
        const paperInfo = `${item.cols || 20}칸 (${charCount}자)`;
        
        return `
            <li onclick="loadSelectedManuscript(${item.id})">
                <div class="title">${item.title || '제목 없음'}${hasModified}${hasError}</div>
                <div class="info">${dateStr} | ${paperInfo}</div>
            </li>
        `;
    }).join('');
    
    document.getElementById('savedList').innerHTML = listHTML;
}

async function loadSelectedManuscript(id) {
    try {
        const record = await app.loadManuscriptById(id);
        const state = app.getState();
        
        // 원고지 다시 초기화
        const cols = record.cols || 20;
        const rows = cols === 20 ? 20 : (record.content.split('\n').length <= 12 ? 12 : 28);
        initializePaper(cols, rows);
        
        // 컨텐츠 로드
        app.engine.load_content(
            record.content,
            record.modified_text,
            record.error_text
        );
        
        // UI 업데이트
        const newState = app.getState();
        updateUI(newState);
        
        // 체크박스 활성화 (수정본이나 에러가 있을 때)
        if (elements.teacherToggle) {
            if (record.modified_text || record.error_text) {
                elements.teacherToggle.disabled = false;
            } else {
                elements.teacherToggle.disabled = true;
                elements.teacherToggle.checked = false;
            }
        }
        
        closeLoadModal();
        
        let message = '원고를 불러왔습니다.';
        if (record.modified_text) {
            message += '\n선생님이 수정한 원고가 있습니다.\n체크박스를 클릭하면 볼 수 있습니다.';
        }
        if (record.error_text) {
            message += '\n빨간선 표시가 있습니다.';
        }
        alert(message);
    } catch (error) {
        alert(error.message);
    }
}

function closeLoadModal() {
    document.getElementById('loadModal').classList.remove('show');
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?\n저장하지 않은 내용은 사라집니다.')) {
        app.logout();
        location.reload();
    }
}

// 텍스트 복사
function copyToClipboard() {
    const text = app.getStudentText();
    navigator.clipboard.writeText(text).then(() => {
        alert('텍스트가 클립보드에 복사되었습니다!');
    }).catch(err => {
        alert('복사 실패: ' + err);
    });
}

// 초기화 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudentApp);
} else {
    initStudentApp();
}

// 전역 함수 노출
window.saveToSupabase = saveToSupabase;
window.confirmSave = confirmSave;
window.closeSaveModal = closeSaveModal;
window.loadFromSupabase = loadFromSupabase;
window.loadSelectedManuscript = loadSelectedManuscript;
window.closeLoadModal = closeLoadModal;
window.logout = logout;
window.copyToClipboard = copyToClipboard;