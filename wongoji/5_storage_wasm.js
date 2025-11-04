let wasmModule = null;

// WASM 초기화 - 경고 해결
async function initWasm() {
    if (wasmModule) return;
    
    try {
        // GitHub Pages 경로 확인
        const basePath = window.location.pathname.includes('/voca/') 
            ? '/voca/wongoji/' 
            : './wongoji/';
        
        // 동적 import 사용
        const wasmModulePath = `${basePath}wongoji_wasm.js`;
        console.log('Loading WASM from:', wasmModulePath);
        
        const { default: init, authenticate_student, save_manuscript, 
                load_manuscript_list, load_existing_files, update_manuscript, 
                check_manuscript_exists, InputHandler } = await import(wasmModulePath);
        
        // WASM 초기화 - 새로운 방식 (경고 해결)
        await init({
            module_or_path: `${basePath}wongoji_wasm_bg.wasm`
        });
        
        wasmModule = {
            authenticate_student,
            save_manuscript,
            load_manuscript_list,
            load_existing_files,
            update_manuscript,
            check_manuscript_exists,
            InputHandler
        };
        
        // 전역으로 노출
        window.wasmModule = wasmModule;
        console.log('WASM module initialized successfully');
    } catch (e) {
        console.error('WASM initialization error details:', e);
        throw e;
    }
}

// 페이지 로드 시 WASM 초기화
window.addEventListener('load', async function() {
    try {
        await initWasm();
        console.log('WASM module initialized');
    } catch (e) {
        console.error('WASM initialization failed:', e);
        alert('시스템 초기화 실패. 페이지를 새로고침해주세요.\n에러: ' + e.message);
    }
});

// 시작 버튼 이벤트
startBtn.addEventListener('click', async function() {
    var studentName = studentNameInput.value.trim();
    var studentPassword = studentPasswordInput.value.trim();
    var selectedClass = classSelect.value;
    
    if (!studentName) {
        alert('이름을 입력해주세요.');
        return;
    }
    
    if (!studentPassword || studentPassword.length !== 4) {
        alert('비밀번호 4자리를 입력해주세요.');
        return;
    }
    
    try {
        if (!wasmModule) {
            await initWasm();
        }
        
        const data = await wasmModule.authenticate_student(studentName, selectedClass, studentPassword);
        
        // 로그인 성공
        currentStudentName = studentName;
        currentClass = selectedClass;
        isLoggedIn = true;
        
        setCookie('studentName', studentName, 30);
        setCookie('studentClass', currentClass, 30);
        setCookie('studentPassword', studentPassword, 30);
        
        classSelect.disabled = true;
        studentNameInput.disabled = true;
        studentPasswordInput.style.display = 'none';
        document.querySelector('label[for="studentPassword"]').style.display = 'none';
        
        paperType = colsSelect.value;
        
        if (paperType === '20') {
            cols = 20;
            rows = 20;
        } else if (paperType === '25-300') {
            cols = 25;
            rows = 12;
        } else if (paperType === '25-700') {
            cols = 25;
            rows = 28;
        }
        
        initializePaper();
        workArea.classList.add('show');
        
        // 입력 핸들러 초기화
        await initializePaperWithInput();
        
        setTimeout(function() {
            var compositionInput = document.getElementById('compositionInput');
            if (compositionInput) {
                compositionInput.focus();
            }
        }, 100);
    } catch (error) {
        console.error('Login error:', error);
        if (error.toString().includes('Student not found')) {
            alert('등록되지 않은 학생입니다.\n이름과 반을 확인해주세요.');
        } else if (error.toString().includes('Invalid password')) {
            alert('비밀번호가 일치하지 않습니다.');
        } else {
            alert('로그인 실패: ' + error);
        }
    }
});

// 서버에서 불러오기
async function loadFromSupabase() {
    if (!currentStudentName) {
        alert('학생 이름이 확인되지 않았습니다.');
        return;
    }
    
    try {
        if (!wasmModule) {
            await initWasm();
        }
        
        console.log('Loading manuscripts for:', currentStudentName, currentClass);
        const data = await wasmModule.load_manuscript_list(currentStudentName, currentClass);
        console.log('Loaded manuscripts:', data);
        
        if (!data || data.length === 0) {
            alert('저장된 원고가 없습니다.');
            return;
        }
        
        var listHTML = '';
        data.forEach(function(item, index) {
            var approvalBadge = '';
            var hasModified = '';
            var hasError = '';
            
            try {
                if (item.approval_status === true) {
                    approvalBadge = '<span class="approval-badge">✅ 결재</span>';
                    if (item.modified_text && item.modified_text.trim()) {
                        hasModified = '<span class="modified-badge">(수정본)</span>';
                    }
                    if (item.error_text && item.error_text.trim()) {
                        hasError = '<span class="modified-badge">(빨간선)</span>';
                    }
                }
            } catch (e) {
                console.error('Badge error:', e);
            }
            
            var dateStr = '날짜 없음';
            try {
                if (item.updated_at || item.created_at) {
                    var date = new Date(item.updated_at || item.created_at);
                    dateStr = date.toLocaleDateString('ko-KR') + ' ' + 
                              date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
                }
            } catch (e) {
                console.error('Date error:', e);
            }
            
            var paperInfo = '';
            try {
                var charCount = 0;
                if (item.content) {
                    charCount = item.content.replace(/\t/g, '').replace(/\n/g, '').length;
                }
                if (item.cols === 20) {
                    paperInfo = '20칸 (' + charCount + '자)';
                } else if (item.cols === 25) {
                    paperInfo = '25칸 (' + charCount + '자)';
                } else {
                    paperInfo = (item.cols || 20) + '칸 (' + charCount + '자)';
                }
            } catch (e) {
                paperInfo = '정보 없음';
                console.error('Paper info error:', e);
            }
            
            listHTML += '<li>';
            listHTML += '<div class="title" onclick="loadSelectedManuscript(' + index + ')">' + 
                        (item.title || '제목 없음') + ' ' + approvalBadge + ' ' + hasModified + ' ' + hasError + '</div>';
            listHTML += '<div class="info">' + dateStr + ' | ' + paperInfo + '</div>';
            listHTML += '</li>';
        });
        
        document.getElementById('savedList').innerHTML = listHTML;
        document.getElementById('loadModal').classList.add('show');
        
        window.savedManuscripts = data;
    } catch (error) {
        console.error('Load error:', error);
        alert('불러오기 실패: ' + error);
    }
}

function closeLoadModal() {
    document.getElementById('loadModal').classList.remove('show');
}

async function loadSelectedManuscript(index) {
    var item = window.savedManuscripts[index];
    
    var textToLoad = item.content;
    var modifiedText = null;
    var errorText = null;
    var memo = null;
    var approved = item.approval_status || false;
    
    if (!textToLoad) {
        alert('저장된 내용이 없습니다.');
        return;
    }
    
    if (approved) {
        modifiedText = item.modified_text;
        errorText = item.error_text;
        memo = item.teacher_memo;
    }
    
    var savedCols = item.cols || 20;
    
    loadManuscriptText(textToLoad, savedCols, modifiedText, errorText, memo);
    
    // 입력 핸들러 재초기화
    if (inputHandler) {
        inputHandler.set_position(0);
        updateActiveCell();
    }
    
    closeLoadModal();
}

// 서버에 저장
async function saveToSupabase() {
    if (!currentStudentName) {
        alert('학생 이름이 확인되지 않았습니다.');
        return;
    }
    
    var text = '';
    try {
        text = getManuscriptText();
    } catch (e) {
        console.error('Get text error:', e);
        alert('원고 텍스트를 가져오는데 실패했습니다: ' + e.message);
        return;
    }
    
    if (!text || !text.trim()) {
        alert('저장할 내용이 없습니다.');
        return;
    }
    
    try {
        if (!wasmModule) {
            await initWasm();
        }
        
        console.log('Loading existing files for:', currentStudentName, currentClass);
        const existingFiles = await wasmModule.load_existing_files(currentStudentName, currentClass);
        console.log('Existing files:', existingFiles);
        
        var existingFilesList = document.getElementById('existingFilesList');
        if (existingFiles && existingFiles.length > 0) {
            var listHTML = '';
            existingFiles.forEach(function(file) {
                var dateStr = '날짜 없음';
                try {
                    if (file.updated_at || file.created_at) {
                        var date = new Date(file.updated_at || file.created_at);
                        dateStr = date.toLocaleDateString('ko-KR') + ' ' + 
                                  date.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'});
                    }
                } catch (e) {
                    console.error('Date parsing error:', e);
                }
                
                var approvalBadge = '';
                var memoBadge = '';
                
                try {
                    if (file.approval_status === true) {
                        approvalBadge = '<span class="approval-badge">✅ 결재</span>';
                    }
                    if (file.teacher_memo && file.teacher_memo.trim()) {
                        memoBadge = '<span class="memo-badge">📝 메모</span>';
                    }
                } catch (e) {
                    console.error('Badge error:', e);
                }
                
                var safeTitle = '';
                try {
                    safeTitle = (file.title || '제목 없음').replace(/'/g, "\\'");
                } catch (e) {
                    safeTitle = '제목 없음';
                    console.error('Title error:', e);
                }
                
                listHTML += '<li onclick="selectExistingFile(\'' + safeTitle + '\')">';
                listHTML += '<div class="file-title">' + (file.title || '제목 없음') + approvalBadge + memoBadge + '</div>';
                listHTML += '<div class="file-date">' + dateStr + '</div>';
                listHTML += '</li>';
            });
            existingFilesList.innerHTML = listHTML;
        } else {
            existingFilesList.innerHTML = '<li class="no-files">저장된 파일이 없습니다</li>';
        }
        
        document.getElementById('saveModal').classList.add('show');
        document.getElementById('saveTitle').value = '';
        // 모달이 열린 후 포커스 (스크롤 방지)
        setTimeout(() => {
            const titleInput = document.getElementById('saveTitle');
            if (titleInput) {
                titleInput.focus({ preventScroll: true });
            }
        }, 100);

    } catch (error) {
        console.error('Save modal error:', error);
        alert('파일 목록 불러오기 실패: ' + error);
    }
}

function selectExistingFile(title) {
    document.getElementById('saveTitle').value = title;
    document.getElementById('saveTitle').focus();
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.remove('show');
}

async function confirmSave() {
    var title = document.getElementById('saveTitle').value.trim();
    if (!title) {
        alert('제목을 입력해주세요.');
        return;
    }
    
    var text = '';
    try {
        text = getManuscriptText();
    } catch (e) {
        console.error('Get text error:', e);
        alert('원고 텍스트를 가져오는데 실패했습니다: ' + e.message);
        return;
    }
    
    try {
        if (!wasmModule) {
            await initWasm();
        }
        
        console.log('Checking existing manuscript:', title);
        const existingData = await wasmModule.check_manuscript_exists(currentStudentName, currentClass, title);
        console.log('Existing data:', existingData);
        
        if (existingData && existingData !== null) {
            if (existingData.approval_status) {
                alert('이미 결재된 원고입니다.\n결재된 원고는 수정할 수 없습니다.');
                return;
            }
            
            if (!confirm('같은 제목의 원고가 있습니다.\n덮어쓰시겠습니까?')) {
                return;
            }
            
            console.log('Updating manuscript:', existingData.id);
            await wasmModule.update_manuscript(existingData.id, text, cols);
            alert('원고가 업데이트되었습니다!');
            closeSaveModal();
        } else {
            console.log('Saving new manuscript');
            await wasmModule.save_manuscript(currentStudentName, currentClass, title, text, cols);
            alert('새 원고가 저장되었습니다!');
            closeSaveModal();
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('저장 실패: ' + error);
    }
}

// 파일로 저장
function saveToFile() {
    if (!currentStudentName) {
        alert('학생 이름이 확인되지 않았습니다.');
        return;
    }
    
    var text = '';
    try {
        text = getManuscriptText();
    } catch (e) {
        alert('원고 텍스트를 가져오는데 실패했습니다: ' + e.message);
        return;
    }
    
    if (!text || !text.trim()) {
        alert('저장할 내용이 없습니다.');
        return;
    }
    
    var saveData = {
        student_name: currentStudentName,
        class: currentClass,
        cols: cols,
        rows: rows,
        content: text,
        saved_date: new Date().toISOString()
    };
    
    var jsonString = JSON.stringify(saveData, null, 2);
    var blob = new Blob([jsonString], { type: 'application/json' });
    
    var now = new Date();
    var dateStr = now.getFullYear() + 
                  String(now.getMonth() + 1).padStart(2, '0') + 
                  String(now.getDate()).padStart(2, '0') + '_' +
                  String(now.getHours()).padStart(2, '0') + 
                  String(now.getMinutes()).padStart(2, '0');
    var filename = currentStudentName + '_' + dateStr + '.wongo';
    
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    
    alert('파일이 다운로드되었습니다!\n파일명: ' + filename);
}

// 파일에서 불러오기
function loadFromFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wongo,.json';
    
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var reader = new FileReader();
        reader.onload = async function(event) {
            try {
                var saveData = JSON.parse(event.target.result);
                
                if (!saveData.content || !saveData.cols) {
                    alert('올바르지 않은 파일 형식입니다.');
                    return;
                }
                
                var textToLoad = saveData.content;
                var savedCols = saveData.cols || 20;
                
                loadManuscriptText(textToLoad, savedCols, null, null, null);
                
                // 입력 핸들러 재초기화
                if (inputHandler) {
                    inputHandler.set_position(0);
                    updateActiveCell();
                }
                
            } catch (error) {
                alert('파일 읽기 실패: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?\n저장하지 않은 내용은 사라집니다.')) {
        currentStudentName = '';
        currentClass = '3A';
        studentNameInput.value = '';
        studentPasswordInput.value = '';
        isLoggedIn = false;
        
        classSelect.disabled = false;
        studentNameInput.disabled = false;
        studentPasswordInput.style.display = '';
        studentPasswordInput.value = '';
        document.querySelector('label[for="studentPassword"]').style.display = '';
        
        eraseCookie('studentName');
        eraseCookie('studentClass');
        eraseCookie('studentPassword');
        
        workArea.classList.remove('show');
        
        for (var i = 0; i < studentData.length; i++) {
            studentData[i] = '';
            renderCell(i);
        }
        currentPos = 0;
        
        // 입력 핸들러 초기화
        inputHandler = null;
    }
}

// 전역 함수로 노출
window.saveToSupabase = saveToSupabase;
window.loadFromSupabase = loadFromSupabase;
window.saveToFile = saveToFile;
window.loadFromFile = loadFromFile;
window.logout = logout;
window.closeSaveModal = closeSaveModal;
window.closeLoadModal = closeLoadModal;
window.confirmSave = confirmSave;
window.selectExistingFile = selectExistingFile;
window.loadSelectedManuscript = loadSelectedManuscript;