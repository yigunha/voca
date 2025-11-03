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