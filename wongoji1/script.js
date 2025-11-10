// 추가 JavaScript 유틸리티 함수들

// 클립보드 붙여넣기 처리
document.addEventListener('paste', async (e) => {
    e.preventDefault();
    
    const text = e.clipboardData.getData('text');
    if (!text) return;
    
    // WASM으로 전달하여 처리
    // paste_text(text); // WASM 함수 호출
});

// 레이어 전환 시각적 표시
function updateLayerDisplay(layer) {
    const statusBar = document.getElementById('currentLayer');
    if (layer === 'student') {
        statusBar.textContent = '레이어: 학생 작성';
        statusBar.style.color = '#2c3e50';
    } else {
        statusBar.textContent = '레이어: 선생님 첨삭';
        statusBar.style.color = '#dc3545';
    }
}

// 원고지 내보내기 (인쇄용)
function exportToPDF() {
    window.print();
}

// 통계 정보 표시
function showStatistics() {
    const studentData = get_student_data();
    const lines = studentData.split('\n');
    const totalChars = studentData.replace(/[\t\n]/g, '').length;
    
    alert(`통계 정보:\n총 글자 수: ${totalChars}자\n총 줄 수: ${lines.length}줄`);
}

// 자동 저장 기능
let autoSaveTimer = null;

function enableAutoSave(intervalMs = 60000) {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    
    autoSaveTimer = setInterval(async () => {
        if (currentUser) {
            console.log('자동 저장 중...');
            // 자동 저장 로직
        }
    }, intervalMs);
}

function disableAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
}

// 키보드 단축키 도움말
function showKeyboardHelp() {
    const helpText = `
키보드 단축키:

- Tab: 레이어 전환 (학생 ↔ 선생님)
- Ctrl+C: 선택한 셀 복사
- Ctrl+V: 붙여넣기
- Ctrl+X: 잘라내기
- Delete: 선택한 셀 삭제
- 방향키: 셀 이동
- Enter: 다음 줄로 이동
- Space: 다음 칸으로 이동
- Shift+클릭: 범위 선택
    `;
    
    alert(helpText);
}

// 에러 마킹 관련 함수
let errorMarks = [];

function addErrorMark(row, startCol, endCol, type, color) {
    errorMarks.push({
        row: row,
        startCol: startCol,
        endCol: endCol,
        type: type,
        color: color
    });
    
    drawErrorMarks();
}

function drawErrorMarks() {
    // SVG로 에러 마킹 그리기
    // 밑줄, 취소선, 띄어쓰기, 붙여쓰기 표시
}

function clearErrorMarks() {
    errorMarks = [];
    drawErrorMarks();
}

// 선생님 메모 기능
function saveTeacherMemo(manuscriptId, memo) {
    // Supabase에 메모 저장
}

function loadTeacherMemo(manuscriptId) {
    // Supabase에서 메모 불러오기
}

// 결재 상태 변경
async function updateApprovalStatus(manuscriptId, status, teacherName) {
    const { error } = await supabase
        .from('wongo')
        .update({
            approval_status: status,
            approved_by: status ? teacherName : null,
            approved_at: status ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
        })
        .eq('id', manuscriptId);
    
    if (error) {
        console.error('결재 상태 업데이트 실패:', error);
        return false;
    }
    
    return true;
}

// 원고 검색 기능
async function searchManuscripts(searchTerm) {
    const { data, error } = await supabase
        .from('wongo')
        .select('*')
        .or(`title.ilike.%${searchTerm}%,student_name.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('검색 실패:', error);
        return [];
    }
    
    return data || [];
}

// 반별 원고 목록
async function getManuscriptsByClass(className) {
    const { data, error } = await supabase
        .from('wongo')
        .select('*')
        .eq('class', className)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('반별 목록 조회 실패:', error);
        return [];
    }
    
    return data || [];
}

// 원고 삭제
async function deleteManuscript(manuscriptId) {
    if (!confirm('정말로 이 원고를 삭제하시겠습니까?')) {
        return false;
    }
    
    const { error } = await supabase
        .from('wongo')
        .delete()
        .eq('id', manuscriptId);
    
    if (error) {
        alert('삭제 실패: ' + error.message);
        return false;
    }
    
    alert('삭제되었습니다.');
    return true;
}

// 원고 복제
async function duplicateManuscript(manuscriptId) {
    const { data, error } = await supabase
        .from('wongo')
        .select('*')
        .eq('id', manuscriptId)
        .single();
    
    if (error || !data) {
        alert('원고를 불러오는데 실패했습니다.');
        return;
    }
    
    const newTitle = prompt('새 원고 제목:', data.title + ' (사본)');
    if (!newTitle) return;
    
    const { error: insertError } = await supabase
        .from('wongo')
        .insert({
            student_name: data.student_name,
            class: data.class,
            title: newTitle,
            content: data.content,
            modified_text: '',
            error_text: '[]',
            cols: data.cols,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    
    if (insertError) {
        alert('복제 실패: ' + insertError.message);
    } else {
        alert('원고가 복제되었습니다.');
    }
}

// 인쇄 스타일
const printStyles = `
@media print {
    #toolbar, #statusBar {
        display: none !important;
    }
    
    #manuscriptPaper {
        box-shadow: none;
        page-break-inside: avoid;
    }
    
    .teacher-cell {
        display: none !important;
    }
    
    .student-cell {
        display: block !important;
    }
}
`;

// 스타일 주입
const styleSheet = document.createElement('style');
styleSheet.textContent = printStyles;
document.head.appendChild(styleSheet);