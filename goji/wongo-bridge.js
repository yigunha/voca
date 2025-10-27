// WASM 브리지 - Rust와 UI를 연결

class WongoApp {
    constructor() {
        this.engine = null;
        this.currentStudent = null;
        this.currentTeacher = null;
        this.currentManuscript = null;
        this.cols = 20;
        this.rows = 20;
        this.wasm = null;
    }

    async init(wasmModule) {
        this.wasm = wasmModule;
        console.log('WASM module loaded');
    }

    // ========== 학생 인증 ==========
    async authenticateStudent(name, password) {
        try {
            // 비밀번호를 문자열로 확실히 변환
            const passwordStr = String(password);
            const result = await this.wasm.authenticate_student(name, passwordStr);
            this.currentStudent = {
                name: result.student_name,
                number: result.student_number  // 이제 문자열
            };
            return this.currentStudent;
        } catch (error) {
            throw new Error('인증 실패: ' + error);
        }
    }

    // ========== 선생님 인증 ==========
    async authenticateTeacher(name, password) {
        try {
            const result = await this.wasm.authenticate_teacher(name, password);
            this.currentTeacher = {
                name: result.teacher_name
            };
            return this.currentTeacher;
        } catch (error) {
            throw new Error('인증 실패: ' + error);
        }
    }

    // ========== 원고지 엔진 초기화 ==========
    initEngine(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.engine = new this.wasm.ManuscriptEngine(cols, rows);
        return this.engine.get_state();
    }

    // ========== 문자 입력 처리 ==========
    processChar(char) {
        if (!this.engine) return null;
        return this.engine.process_char(char);
    }

    backspace() {
        if (!this.engine) return null;
        return this.engine.backspace();
    }

    moveLeft() {
        if (!this.engine) return null;
        return this.engine.move_left();
    }

    moveRight() {
        if (!this.engine) return null;
        return this.engine.move_right();
    }

    getState() {
        if (!this.engine) return null;
        return this.engine.get_state();
    }

    // ========== 에러 마크 ==========
    toggleErrorMark(row, col) {
        if (!this.engine) return null;
        return this.engine.toggle_error_mark(row, col);
    }

    clearErrorMarks() {
        if (!this.engine) return null;
        return this.engine.clear_error_marks();
    }

    // ========== 텍스트 추출 ==========
    getTeacherText() {
        if (!this.engine) return '';
        return this.engine.get_teacher_text();
    }

    getStudentText() {
        if (!this.engine) return '';
        return this.engine.get_student_text();
    }

    getErrorText() {
        if (!this.engine) return '';
        return this.engine.get_error_text();
    }

    // ========== 복사/삭제 ==========
    copyStudentToTeacher() {
        if (!this.engine) return null;
        return this.engine.copy_student_to_teacher();
    }

    clearTeacherCells() {
        if (!this.engine) return null;
        return this.engine.clear_teacher_cells();
    }

    // ========== 원고 저장 ==========
    async saveManuscript(studentName, className, title, content) {
        try {
            const modifiedText = this.getTeacherText().trim() || null;
            const errorText = this.getErrorText().trim() || null;
            
            const id = this.currentManuscript?.id || null;
            
            await this.wasm.save_manuscript(
                id,
                studentName,
                className,
                title,
                content,
                modifiedText,
                errorText,
                this.cols
            );
            
            return { success: true };
        } catch (error) {
            throw new Error('저장 실패: ' + error);
        }
    }

    // ========== 원고 목록 불러오기 ==========
    async loadManuscripts(studentName = null, className = null) {
        try {
            const records = await this.wasm.load_manuscripts(studentName, className);
            return records;
        } catch (error) {
            throw new Error('불러오기 실패: ' + error);
        }
    }

    // ========== 특정 원고 불러오기 ==========
    async loadManuscriptById(id) {
        try {
            const record = await this.wasm.load_manuscript_by_id(id);
            this.currentManuscript = record;
            
            // 엔진 초기화
            const cols = record.cols || 20;
            const rows = cols === 20 ? 20 : (record.content.split('\n').length <= 12 ? 12 : 28);
            
            this.initEngine(cols, rows);
            
            // 컨텐츠 로드
            this.engine.load_content(
                record.content,
                record.modified_text,
                record.error_text
            );
            
            return record;
        } catch (error) {
            throw new Error('원고 불러오기 실패: ' + error);
        }
    }

    // ========== 로그아웃 ==========
    logout() {
        this.currentStudent = null;
        this.currentTeacher = null;
        this.currentManuscript = null;
        this.engine = null;
    }
}

// 전역 인스턴스
let wongoApp = null;

// WASM 초기화 함수
async function initWongoApp() {
    try {
        // WASM 모듈 로드 (wasm-pack으로 빌드한 결과)
        const wasm = await import('./pkg/wongo_manuscript.js');
        await wasm.default();
        
        wongoApp = new WongoApp();
        await wongoApp.init(wasm);
        
        console.log('Wongo App initialized successfully');
        return wongoApp;
    } catch (error) {
        console.error('Failed to initialize WASM:', error);
        console.error('Make sure you have built the WASM module:');
        console.error('  wasm-pack build --target web --out-dir www/pkg');
        throw error;
    }
}

// Export for global use
window.initWongoApp = initWongoApp;
window.WongoApp = WongoApp;

// Export for module use
export { initWongoApp, WongoApp };

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initWongoApp, WongoApp };
}