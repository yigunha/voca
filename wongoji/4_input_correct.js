// WASM ìž…ë ¥ í•¸ë"¤ëŸ¬ ì‚¬ìš©
let inputHandler = null;
let compositionInput = null;
let lastCompositionText = '';

// ìž…ë ¥ í•¸ë"¤ëŸ¬ ì´ˆê¸°í™"
async function initInputHandler() {
    if (!window.wasmModule || !window.wasmModule.InputHandler) {
        console.error('WASM module not loaded');
        return false;
    }
    
    try {
        inputHandler = new window.wasmModule.InputHandler(cols, rows);
        window.inputHandler = inputHandler;
        return true;
    } catch (e) {
        console.error('Failed to initialize input handler:', e);
        return false;
    }
}

// í™œì„± ì…€ ì—…ë°ì´íŠ¸
function updateActiveCell() {
    if (!inputHandler) return;
    
    for (var i = 0; i < studentCells.length; i++) {
        studentCells[i].classList.remove('active');
    }
    
    var pos = inputHandler.get_position();
    if (pos >= 0 && pos < studentCells.length) {
        var activeCell = studentCells[pos];
        activeCell.classList.add('active');
        
        if (compositionInput) {
            compositionInput.style.top = activeCell.offsetTop + 'px';
            compositionInput.style.left = activeCell.offsetLeft + 'px';
            
            // í¬ì»¤ìŠ¤ ê°•ì œ ë³µêµ¬
            setTimeout(function() {
                if (document.activeElement !== compositionInput) {
                    compositionInput.focus();
                }
            }, 0);
        }
        
        var rect = activeCell.getBoundingClientRect();
        var isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        
        if (!isVisible) {
            activeCell.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }
    
    currentPos = pos;
}

// ìž…ë ¥ ê²°ê³¼ ì²˜ë¦¬
function handleInputResults(results) {
    if (!results || !Array.isArray(results)) {
        if (results && typeof results === 'object') {
            results = [results];
        } else {
            return;
        }
    }
    
    for (var i = 0; i < results.length; i++) {
        var result = results[i];
        
        switch (result.action) {
            case 'place':
                if (result.clear_current) {
                    studentData[result.pos] = result.content;
                    var cell = studentCells[result.pos];
                    var content = cell.querySelector('.cell-content');
                    if (content) {
                        content.textContent = result.content;
                    }
                    
                    if (result.content.length > 1) {
                        cell.dataset.special = 'true';
                    } else {
                        delete cell.dataset.special;
                    }
                    delete cell.dataset.temp;
                }
                break;
                
            case 'buffer':
                // âœ… ë²„í¼1ë§Œ í˜„ìž¬ ì¹¸ì— ìž„ì‹œ í'œì‹œ
                studentData[result.pos] = result.buffer1;
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = result.buffer1;
                }
                cell.dataset.temp = 'true';
                delete cell.dataset.special;
                break;
                
            case 'composing':
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = result.content;
                }
                cell.dataset.temp = 'true';
                delete cell.dataset.special;
                break;
                
            case 'clear_and_move':
                // âœ… í˜„ìž¬ ì¹¸ ë¹„ìš°ê¸°
                studentData[result.pos] = '';
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = '';
                }
                delete cell.dataset.special;
                delete cell.dataset.temp;
                break;
                
            case 'delete':
                studentData[result.pos] = '';
                var cell = studentCells[result.pos];
                var content = cell.querySelector('.cell-content');
                if (content) {
                    content.textContent = '';
                }
                delete cell.dataset.special;
                delete cell.dataset.temp;
                break;
        }
    }
    
    updateActiveCell();
}

// ì´ë²¤íŠ¸ ì„¤ì •
function setupInputEvents() {
    compositionInput = document.getElementById('compositionInput');
    if (!compositionInput) {
        console.error('compositionInput not found!');
        return;
    }
    
    // í•œê¸€ ì¡°í•© ì‹œìž'
    compositionInput.addEventListener('compositionstart', function() {
        if (!inputHandler) return;
        
        inputHandler.start_composition();
        isComposing = true;
        compositionInput.classList.add('is-composing');
        lastCompositionText = '';
        
        var pos = inputHandler.get_position();
        if (pos >= 0 && pos < studentCells.length) {
            studentCells[pos].classList.add('is-composing');
        }
    });
    
    // âœ… í•œê¸€ ì¡°í•© ì—…ë°ì´íŠ¸ - ë' ë²ˆì§¸ ê¸€ìž ê°ì§€!
    compositionInput.addEventListener('compositionupdate', function(e) {
        if (!inputHandler) return;
        
        var text = e.data || '';
        
        // âœ… ì²˜ìŒìœ¼ë¡œ 2ê¸€ìžê°€ ëœ ë•Œë§Œ ì²˜ë¦¬ (1ê¸€ìž â†' 2ê¸€ìž)
        if (lastCompositionText.length === 1 && text.length >= 2) {
            var firstChar = text[0];
            var remaining = text.slice(1);
            
            // ì²« ê¸€ìž í™•ì •
            var result1 = inputHandler.finalize_first_char(firstChar);
            handleInputResults(result1);
            
            // ë' ë²ˆì§¸ ê¸€ìž ìž„ì‹œ í'œì‹œ
            var result2 = inputHandler.update_composition(remaining);
            handleInputResults(result2);
        } else if (text.length >= 2) {
            // ì´ë¯¸ 2ê¸€ìž ì´ìƒì¸ ê²½ìš° (ë' ë²ˆì§¸ ê¸€ìž ì—…ë°ì´íŠ¸ë§Œ)
            var remaining = text.slice(1);
            var result = inputHandler.update_composition(remaining);
            handleInputResults(result);
        } else {
            // 1ê¸€ìž ì¡°í•© ì¤'
            var result = inputHandler.update_composition(text);
            handleInputResults(result);
        }
        
        lastCompositionText = text;
    });
    
    // í•œê¸€ ì¡°í•© ì™„ë£Œ
    compositionInput.addEventListener('compositionend', function(e) {
        if (!inputHandler) return;
        
        isComposing = false;
        compositionInput.classList.remove('is-composing');
        for (var i = 0; i < studentCells.length; i++) {
            studentCells[i].classList.remove('is-composing');
        }
        
        lastCompositionText = '';
        
        var text = e.data || '';
        if (text) {
            compositionInput.value = '';
            
            // âœ… ê¸¸ì´ ì²´í¬: ì´ë¯¸ ì²˜ë¦¬ëœ ê²½ìš°ì™€ ë§ˆì§€ë§‰ ê¸€ìžë§Œ ì²˜ë¦¬
            if (text.length === 1) {
                // ë‹¨ì¼ ê¸€ìžë§Œ ìž…ë ¥ëœ ê²½ìš°
                var result = inputHandler.finalize_composition(text);
                handleInputResults(result);
            } else {
                // ì—¬ëŸ¬ ê¸€ìž: ë§ˆì§€ë§‰ ê¸€ìžë§Œ í™•ì • (ë‚˜ë¨¸ì§€ëŠ" updateì—ì„œ ì²˜ë¦¬ë¨)
                var lastChar = text[text.length - 1];
                var result = inputHandler.finalize_composition(lastChar);
                handleInputResults(result);
            }
        }
    });
    
    // ì¼ë°˜ ìž…ë ¥
    compositionInput.addEventListener('input', function(e) {
        if (!inputHandler || inputHandler.is_composing()) return;
        
        var text = e.target.value;
        if (text) {
            compositionInput.value = '';
            var result = inputHandler.process_input(text);
            handleInputResults(result);
        }
    });
    
    // í‚¤ë³´ë"œ ì´ë²¤íŠ¸
    compositionInput.addEventListener('keydown', function(e) {
        if (!inputHandler) return;
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
                
                inputHandler.set_position(selectedCells[0]);
                clearSelection();
                updateActiveCell();
            } else {
                var pos = inputHandler.get_position();
                if (studentData[pos] === '' && pos > 0) {
                    inputHandler.move_left();
                    pos = inputHandler.get_position();
                }
                
                var result = inputHandler.handle_backspace();
                handleInputResults(result);
            }
            
            compositionInput.value = '';
            return;
        }
        
        // Space
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (e.shiftKey) return;
            
            var result = inputHandler.handle_space();
            handleInputResults(result);
            compositionInput.value = '';
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
                
                inputHandler.set_position(selectedCells[0]);
                clearSelection();
                updateActiveCell();
            } else {
                var result = inputHandler.handle_delete();
                handleInputResults(result);
            }
            
            compositionInput.value = '';
            return;
        }
        
        // Arrow keys
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (inputHandler.move_left()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (inputHandler.move_right()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (inputHandler.move_up()) {
                updateActiveCell();
            }
            return;
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (inputHandler.move_down()) {
                updateActiveCell();
            }
            return;
        }
        
        // Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            if (inputHandler.move_next_row()) {
                updateActiveCell();
            }
            return;
        }
    });
    
    // í¬ì»¤ìŠ¤ ìœ ì§€ (Alt í‚¤ ë"±ìœ¼ë¡œ ì¸í•œ í¬ì»¤ìŠ¤ ì†ì‹¤ ë°©ì§€)
    compositionInput.addEventListener('blur', function() {
        setTimeout(function() {
            if (workArea && workArea.classList.contains('show')) {
                compositionInput.focus();
            }
        }, 10);
    });
    
    // ì „ì—­ í´ë¦­ ì‹œ í¬ì»¤ìŠ¤ ë³µêµ¬
    document.addEventListener('click', function(e) {
        if (workArea && workArea.classList.contains('show')) {
            if (!e.target.closest('.modal') && !e.target.closest('button')) {
                setTimeout(function() {
                    compositionInput.focus();
                }, 10);
            }
        }
    });
}

// ì›ê³ ì§€ ì´ˆê¸°í™" ì‹œ ìž…ë ¥ í•¸ë"¤ëŸ¬ë„ ì´ˆê¸°í™"
async function initializePaperWithInput() {
    await initInputHandler();
    if (inputHandler) {
        inputHandler.set_position(0);
        updateActiveCell();
    }
}

// ì „ì—­ìœ¼ë¡œ ë…¸ì¶œ
window.setupInputEvents = setupInputEvents;
window.updateActiveCell = updateActiveCell;
window.initializePaperWithInput = initializePaperWithInput;
window.handleInputResults = handleInputResults;
window.initInputHandler = initInputHandler;