// input.js - 입력 처리

var alphaNumericBuffer = '';
var compositionInput = null;

// 문자 타입 판별
function getCharType(char) {
    if (/[0-9]/.test(char)) return 'number';
    if (/[a-z]/.test(char)) return 'lower';
    if (/[A-Z]/.test(char)) return 'upper';
    if (/[.,]/.test(char)) return 'punct1';
    if (/['"]/.test(char)) return 'punct2';
    if (char === '-') return 'punct3';
    if (/[가-힣]/.test(char)) return 'korean';
    return 'other';
}

// 조합 가능 여부 판단
function canCombine(bufferChar, inputChar, isLastCol) {
    if (!bufferChar) return false;
    
    var bufferType = getCharType(bufferChar);
    var inputType = getCharType(inputChar);
    
    if (bufferType === 'number' && inputType === 'number') return true;
    if (bufferType === 'lower' && inputType === 'lower') return true;
    if (bufferType === 'number' && inputType === 'punct1') return true;
    if (bufferType === 'punct1' && inputType === 'number') return true;
    if (bufferType === 'punct1' && inputType === 'punct2') return true;
    if (bufferType === 'punct2' && inputType === 'punct2') return true;
    if (isLastCol && bufferType === 'lower' && inputType === 'punct1') return true;
    if (isLastCol && bufferType === 'lower' && inputType === 'punct3') return true;
    
    return false;
}

// 버퍼 확정
function finalizeBuffer() {
    if (!alphaNumericBuffer) return;
    
    var cell = studentCells[currentPos];
    studentData[currentPos] = alphaNumericBuffer;
    var content = cell.querySelector('.cell-content');
    if (content) content.textContent = alphaNumericBuffer;
    delete cell.dataset.temp;
    alphaNumericBuffer = '';
    
    if (currentPos < studentCells.length - 1) {
        currentPos++;
        updateActiveCell();
    }
}

// 한 글자 바로 쓰기
function placeChar(char) {
    if (currentPos >= studentCells.length) return;
    
    studentData[currentPos] = char;
    var content = studentCells[currentPos].querySelector('.cell-content');
    if (content) {
        content.textContent = char;
    }
    
    delete studentCells[currentPos].dataset.special;
    alphaNumericBuffer = '';
    
    if (currentPos < studentCells.length - 1) {
        currentPos++;
        updateActiveCell();
    }
}

// 입력 처리 메인 함수
function processInput(char) {
    var charType = getCharType(char);
    var col = currentPos % cols;
    var isLastCol = (col === cols - 1);
    
    // 대문자는 항상 버퍼 확정 후 바로 배치
    if (charType === 'upper') {
        finalizeBuffer();
        placeChar(char);
        return;
    }
    
    // 한글은 항상 버퍼 확정 후 바로 배치
    if (charType === 'korean') {
        finalizeBuffer();
        placeChar(char);
        return;
    }
    
    // 마침표/쉼표 처리
    if (charType === 'punct1') {
        if (alphaNumericBuffer) {
            if (canCombine(alphaNumericBuffer, char, isLastCol)) {
                var cell = studentCells[currentPos];
                studentData[currentPos] = alphaNumericBuffer + char;
                var content = cell.querySelector('.cell-content');
                if (content) content.textContent = alphaNumericBuffer + char;
                cell.dataset.special = 'true';
                delete cell.dataset.temp;
                alphaNumericBuffer = '';
                if (compositionInput) compositionInput.value = '';
                
                if (currentPos < studentCells.length - 1) {
                    currentPos++;
                    updateActiveCell();
                }
                return;
            } else {
                finalizeBuffer();
                processInput(char);
                return;
            }
        }
        
        var currentContent = studentData[currentPos];
        
        if (currentContent && currentContent.length === 1) {
            var contentType = getCharType(currentContent);
            
            if (contentType === 'number') {
                studentData[currentPos] = currentContent + char;
                var content = studentCells[currentPos].querySelector('.cell-content');
                if (content) content.textContent = currentContent + char;
                studentCells[currentPos].dataset.special = 'true';
                
                if (currentPos < studentCells.length - 1) {
                    currentPos++;
                    updateActiveCell();
                }
                return;
            }
            
            if (isLastCol && /[가-힣a-zA-Z]/.test(currentContent)) {
                studentData[currentPos] = currentContent + char;
                var content = studentCells[currentPos].querySelector('.cell-content');
                if (content) content.textContent = currentContent + char;
                studentCells[currentPos].dataset.special = 'true';
                
                if (currentPos < studentCells.length - 1) {
                    currentPos++;
                    updateActiveCell();
                }
                return;
            }
        }
        
        if (col === 0 && currentPos > 0 && !currentContent) {
            var prevIdx = currentPos - 1;
            var prevContent = studentData[prevIdx];
            
            if (prevContent && prevContent.length === 1 && /[가-힣a-zA-Z0-9]/.test(prevContent)) {
                studentData[prevIdx] = prevContent + char;
                var prevContentEl = studentCells[prevIdx].querySelector('.cell-content');
                if (prevContentEl) prevContentEl.textContent = prevContent + char;
                studentCells[prevIdx].dataset.special = 'true';
                return;
            }
        }
        
        placeChar(char);
        return;
    }
    
    // 버퍼가 비어있는 경우
    if (!alphaNumericBuffer) {
        var currentContent = studentData[currentPos];
        
        if (currentContent && currentContent.length === 2) {
            if (currentPos < studentCells.length - 1) {
                currentPos++;
                updateActiveCell();
            }
            processInput(char);
            return;
        }
        
        if (currentContent && currentContent.length === 1) {
            var contentType = getCharType(currentContent);
            
            if (isLastCol && /[a-z]/.test(currentContent) && charType === 'punct3') {
                studentData[currentPos] = currentContent + char;
                var content = studentCells[currentPos].querySelector('.cell-content');
                if (content) content.textContent = currentContent + char;
                studentCells[currentPos].dataset.special = 'true';
                
                if (currentPos < studentCells.length - 1) {
                    currentPos++;
                    updateActiveCell();
                }
                return;
            }
        }
        
        if (/[a-z0-9'"]/i.test(char) && charType !== 'upper') {
            alphaNumericBuffer = char;
            studentData[currentPos] = char;
            var content = studentCells[currentPos].querySelector('.cell-content');
            if (content) content.textContent = char;
            studentCells[currentPos].dataset.temp = 'true';
            if (compositionInput) compositionInput.value = char;
            return;
        }
        
        placeChar(char);
        return;
    }
    
    // 버퍼가 있는 경우
    if (canCombine(alphaNumericBuffer, char, isLastCol)) {
        var cell = studentCells[currentPos];
        studentData[currentPos] = alphaNumericBuffer + char;
        var content = cell.querySelector('.cell-content');
        if (content) content.textContent = alphaNumericBuffer + char;
        cell.dataset.special = 'true';
        delete cell.dataset.temp;
        alphaNumericBuffer = '';
        if (compositionInput) compositionInput.value = '';
        
        if (currentPos < studentCells.length - 1) {
            currentPos++;
            updateActiveCell();
        }
    } else {
        finalizeBuffer();
        processInput(char);
    }
}

// 활성 셀 업데이트
function updateActiveCell() {
    for (var i = 0; i < studentCells.length; i++) {
        studentCells[i].classList.remove('active');
    }
    
    if (alphaNumericBuffer && currentPos > 0) {
        var prevCell = studentCells[currentPos - 1];
        if (prevCell && prevCell.dataset.temp) {
            delete prevCell.dataset.temp;
        }
    }
    
    if (currentPos >= 0 && currentPos < studentCells.length) {
        var activeCell = studentCells[currentPos];
        activeCell.classList.add('active');
        
        if (compositionInput) {
            compositionInput.style.top = activeCell.offsetTop + 'px';
            compositionInput.style.left = activeCell.offsetLeft + 'px';
            compositionInput.focus();
        }
        
        // 셀이 화면에 보이는지 확인
        var rect = activeCell.getBoundingClientRect();
        var isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        
        // 화면에 보이지 않을 때만 스크롤
        if (!isVisible) {
            activeCell.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }
    
    alphaNumericBuffer = '';
    if (compositionInput) {
        compositionInput.value = '';
    }
}

// 이벤트 설정
function setupInputEvents() {
    compositionInput = document.getElementById('compositionInput');
    if (!compositionInput) {
        console.error('compositionInput not found!');
        return;
    }
    
    compositionInput.addEventListener('compositionstart', function() {
        isComposing = true;
        compositionInput.classList.add('is-composing');
        if (currentPos >= 0 && currentPos < studentCells.length) {
            studentCells[currentPos].classList.add('is-composing');
        }
    });
    
    compositionInput.addEventListener('compositionend', function(e) {
        isComposing = false;
        compositionInput.classList.remove('is-composing');
        for (var i = 0; i < studentCells.length; i++) {
            studentCells[i].classList.remove('is-composing');
        }
        
        var text = e.data;
        if (text) {
            compositionInput.value = '';
            for (var i = 0; i < text.length; i++) {
                processInput(text[i]);
            }
        }
    });
    
    compositionInput.addEventListener('input', function(e) {
        if (isComposing) return;
        
        var text = e.target.value;
        
        if (text) {
            if (alphaNumericBuffer && text.length > 1) {
                var lastChar = text[text.length - 1];
                processInput(lastChar);
            } else {
                for (var i = 0; i < text.length; i++) {
                    processInput(text[i]);
                }
            }
            
            if (!alphaNumericBuffer) {
                compositionInput.value = '';
            }
        }
    });
    
    compositionInput.addEventListener('keydown', function(e) {
        if (e.isComposing) return;
        
        // Backspace
        if (e.key === 'Backspace') {
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
                
                currentPos = selectedCells[0];
                clearSelection();
                updateActiveCell();
            } else {
                var targetIdx = (studentData[currentPos] === '' && currentPos > 0) ? currentPos - 1 : currentPos;
                
                studentData[targetIdx] = '';
                var content = studentCells[targetIdx].querySelector('.cell-content');
                if (content) content.textContent = '';
                delete studentCells[targetIdx].dataset.special;
                delete studentCells[targetIdx].dataset.temp;
                
                currentPos = targetIdx;
                updateActiveCell();
            }
            
            alphaNumericBuffer = '';
            compositionInput.value = '';
            return;
        }
        
        // Space
        if (e.key === ' ') {
            e.preventDefault();
            if (e.shiftKey) return;
            
            if (alphaNumericBuffer) {
                finalizeBuffer();
            }
            
            if (currentPos < studentCells.length - 1) {
                currentPos++;
                updateActiveCell();
            }
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
                
                currentPos = selectedCells[0];
                clearSelection();
                updateActiveCell();
            } else {
                studentData[currentPos] = '';
                var content = studentCells[currentPos].querySelector('.cell-content');
                if (content) content.textContent = '';
                delete studentCells[currentPos].dataset.special;
                delete studentCells[currentPos].dataset.temp;
            }
            
            alphaNumericBuffer = '';
            compositionInput.value = '';
            return;
        }
        
        // Arrow keys - ★★★ cols 변수 사용 ★★★
        if (e.key === 'ArrowLeft' && currentPos > 0) {
            e.preventDefault();
            currentPos--;
            updateActiveCell();
            return;
        }
        
        if (e.key === 'ArrowRight' && currentPos < studentCells.length - 1) {
            e.preventDefault();
            currentPos++;
            updateActiveCell();
            return;
        }
        
        if (e.key === 'ArrowUp' && currentPos >= cols) {
            e.preventDefault();
            currentPos -= cols;
            updateActiveCell();
            return;
        }
        
        if (e.key === 'ArrowDown' && currentPos < studentCells.length - cols) {
            e.preventDefault();
            currentPos += cols;
            updateActiveCell();
            return;
        }
        
        // Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            var nextRow = Math.floor(currentPos / cols) + 1;
            if (nextRow < rows) {
                currentPos = nextRow * cols;
                updateActiveCell();
            }
            return;
        }
    });
}