// 학생용 UI 컨트롤러

let app = null;
let currentPos = 0;
let allCells = [];
let isComposing = false;

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

    // 쿠키에서 정보 불러오기
    loadFromCookies();

    // 이벤트 리스너
    elements.startBtn.addEventListener('click', handleStart);
    elements.inputBox.addEventListener('compositionstart', handleCompositionStart);
    elements.inputBox.addEventListener('compositionupdate', handleCompositionUpdate);
    elements.inputBox.addEventListener('compositionend', handleCompositionEnd);
    elements.inputBox.addEventListener('input', handleInput);
    elements.inputBox.addEventListener('keydown', handleKeyDown);
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
    const state = app.initEngine(cols, rows);
    
    // 학생 모드 명시적 설정
    app.engine.set_teacher_mode(false);
    
    elements.manuscriptPaper.className = `manuscript-paper cols-${cols}`;
    elements.manuscriptPaper.innerHTML = '';
    allCells = [];
    
    for (let i = 0; i < state.cells.length; i++) {
        const cell = state.cells[i];
        const cellDiv = document.createElement('div');
        cellDiv.className = cell.cell_type === 'student' ? 'cell student-cell' : 'cell teacher-cell';
        cellDiv.dataset.index = i;
        
        const content = document.createElement('div');
        content.className = 'cell-content';
        cellDiv.appendChild(content);
        
        // 학생 셀만 클릭 가능
        if (cell.cell_type === 'student') {
            cellDiv.addEventListener('click', (e) => {
                const clickedIndex = parseInt(e.currentTarget.dataset.index);
                
                // 엔진의 위치를 직접 설정
                const newState = app.setPosition(clickedIndex);
                currentPos = newState.current_pos;
                updateActiveCell();
                elements.inputBox.focus();
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

// 활성 셀 업데이트
function updateActiveCell() {
    allCells.forEach(cell => cell.classList.remove('active'));
    clearPreview();
    
    if (currentPos >= 0 && currentPos < allCells.length) {
        const state = app.getState();
        const cell = state.cells[currentPos];
        
        if (cell.cell_type === 'student') {
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
    
    const activeCell = allCells[currentPos];
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
    
    // 모든 학생 셀 재렌더링
    state.cells.forEach((cell, i) => {
        if (cell.cell_type === 'student') {
            renderCell(i);
        }
    });
    
    updateActiveCell();
    updateCharCount();
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