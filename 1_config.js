// 전역 변수 (Supabase 설정은 WASM 내부로 이동됨)
var cols = 20, rows = 20;
var studentCells = [], teacherCells = [];
var studentData = [], teacherData = [];
var currentPos = 0;
var isComposing = false;
var alphaNumericBuffer = '';
var currentStudentName = '';
var currentClass = '3A';
var paperType = '20';
var isLoggedIn = false;
var errorMarks = [];
var errorLineSvg = null;

// 결재 및 레이어 관련
var isApproved = false;
var currentLayer = 'student';
var hasModifiedText = false;

// 셀 선택 관련
var isSelecting = false;
var isDragging = false;
var selectionStart = -1;
var selectedCells = [];
var clipboard = [];

// DOM 요소
var studentNameInput = document.getElementById('studentName');
var studentPasswordInput = document.getElementById('studentPassword');
var colsSelect = document.getElementById('colsSelect');
var classSelect = document.getElementById('classSelect');
var startBtn = document.getElementById('startBtn');
var workArea = document.getElementById('workArea');
var manuscriptPaper = document.getElementById('manuscriptPaper');

// 쿠키 함수
function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/';
}

// 스페이스바 기본 동작 방지
document.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (!workArea.classList.contains('show')) {
            e.preventDefault();
            return;
        }
    }
});

// 페이지 로드 시 쿠키에서 정보 불러오기
window.addEventListener('load', function() {
    var savedName = getCookie('studentName');
    var savedClass = getCookie('studentClass');
    var savedPassword = getCookie('studentPassword');
    
    if (savedName) {
        studentNameInput.value = savedName;
    }
    if (savedClass) {
        classSelect.value = savedClass;
    }
    if (savedPassword) {
        studentPasswordInput.value = savedPassword;
    }
    
    errorLineSvg = document.getElementById('errorLineSvg');
});