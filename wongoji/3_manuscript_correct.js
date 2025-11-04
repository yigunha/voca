// 셀 클릭 핸들러
function handleCellClick(idx, e) {
    var compositionInput = document.getElementById('compositionInput');
    
    // 1. IME 강제 종료 및 리셋
    if (compositionInput) {
        compositionInput.blur();  // 포커스 해제로 IME 상태 리셋
        compositionInput.value = '';  // 값 초기화
    }
    
    // 2. 버퍼 처리 (한글이든 영어든 남은 내용 배치)
    if (window.inputHandler) {
        // is_composing이 false가 되었으므로 안전하게 처리
        var oldPos = window.inputHandler.get_position();
        if (oldPos + 1 < studentCells.length) {
            var nextCell = studentCells[oldPos + 1];
            if (nextCell.dataset.temp && studentData[oldPos + 1] === '') {
                var nextContent = nextCell.querySelector('.cell-content');
                if (nextContent) {
                    nextContent.textContent = '';
                }
                delete nextCell.dataset.temp;
            }
        }
        
        var result = window.inputHandler.finalize_buffer();
        if (result) {
            handleInputResults(result);
        }
    }
    
    // 3. Shift 클릭: 범위 선택
    if (e.shiftKey) {
        e.preventDefault();
        
        // 현재 커서 위치부터 클릭한 위치까지 선택
        var start = Math.min(currentPos, idx);
        var end = Math.max(currentPos, idx);
        
        clearSelection();
        for (var i = start; i <= end; i++) {
            addToSelection(i);
        }
        
        // 선택 후 포커스 복구
        setTimeout(function() {
            if (compositionInput) {
                compositionInput.focus({ preventScroll: true });
            }
        }, 50);
        return;
    }
    
    // 4. 일반 클릭 - 선택 해제하고 새 위치로 이동
    clearSelection();
    
    currentPos = idx;
    
    if (window.inputHandler) {
        window.inputHandler.set_position(idx);
    }
    
    updateActiveCell();
    
    // 5. 약간의 지연 후 다시 포커스 (IME 완전 리셋)
    setTimeout(function() {
        if (compositionInput) {
            compositionInput.value = '';
            compositionInput.focus({ preventScroll: true });
        }
    }, 50);
}