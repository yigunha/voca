// script-parentheses_v1.js

// 전역 변수 설정
let questions = [];
let currentQuestionIndex = 0;
let gameStartTime = null;
let gameEndTime = null;
const dataFolderName = "data-parentheses/";
const imageFolderName = dataFolderName + "images/";

// HTML 요소 가져오기
const dataSelectorEl = document.getElementById("dataSelector");
const loadBtnEl = document.getElementById("loadBtn");
const studyCheckEl = document.getElementById("studyCheck");
const challengeHeaderEl = document.getElementById("challengeHeader");
const descriptionAreaEl = document.getElementById("descriptionArea");
const questionContainerEl = document.getElementById("questionContainer");
const submitBtnEl = document.getElementById("submitBtn");
const answerCheckEl = document.getElementById("answerCheck");
const descriptionCheckEl = document.getElementById("descriptionCheck");
const answerCheckboxGroupEl = document.querySelector(".answer-checkbox-group");
const descriptionCheckboxGroupEl = document.querySelector(".description-checkbox-group");
const resultMessageEl = document.getElementById("resultMessage");
const gameStatsEl = document.getElementById("gameStats");

// Study 체크박스 변경 이벤트
studyCheckEl.addEventListener("change", () => {
    if (studyCheckEl.checked) {
        challengeHeaderEl.style.display = "none";
    } else {
        challengeHeaderEl.style.display = "block";
    }
});

// '게임 시작' 버튼 이벤트 리스너
loadBtnEl.addEventListener("click", () => {
    const selectedFile = dataSelectorEl.value;
    const filePath = dataFolderName + selectedFile;

    // 기존 스크립트 제거
    const oldScript = document.getElementById("questions-script");
    if (oldScript) {
        oldScript.remove();
    }

    // 새 스크립트 로드
    const script = document.createElement("script");
    script.src = filePath;
    script.id = "questions-script";

    script.onload = () => {
        try {
            // 데이터 스크립트에서 window.questionsData나 questionData 등 어떤 이름인지 감지
            // 호환성: window.questionsData 사용 (원래 데이터가 이 이름을 쓰면 OK)
            if (window.questionsData) {
                questions = window.questionsData;
            } else if (window.questionData) {
                questions = window.questionData;
            } else if (window.defaultQuestions) {
                questions = window.defaultQuestions;
            } else {
                throw new Error("문제 데이터가 없습니다.");
            }

            if (!questions || questions.length === 0) {
                throw new Error("문제 데이터가 없습니다.");
            }

            // UI 요소 표시
            descriptionAreaEl.style.display = "block";
            questionContainerEl.style.display = "block";
            submitBtnEl.style.display = "inline-block";
            descriptionCheckboxGroupEl.style.display = "inline-block";

            // Study 모드일 때만 정답 보기 표시
            if (studyCheckEl.checked) {
                answerCheckboxGroupEl.style.display = "inline-block";
            } else {
                answerCheckboxGroupEl.style.display = "none";
            }

            // 게임 상태 초기화
            currentQuestionIndex = 0;
            gameStartTime = new Date();

            // 게임 시작
            startGame();

            // 파일 선택 영역 숨기기
            document.querySelector('.file-selector').style.display = 'none';

        } catch (error) {
            console.error("게임 시작 오류:", error);
            resultMessageEl.textContent = `오류: 게임을 시작할 수 없습니다. ${error.message}`;
            resultMessageEl.style.color = "red";
        }
    };

    script.onerror = () => {
        console.error("파일 로드 오류:", filePath);
        resultMessageEl.textContent = `오류: ${filePath} 파일을 불러올 수 없습니다.`;
        resultMessageEl.style.color = "red";
    };

    document.head.appendChild(script);
});

// 배열을 무작위로 섞는 함수
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 게임 시작 함수
function startGame() {
    shuffleArray(questions);

    submitBtnEl.removeEventListener("click", checkAnswer);
    submitBtnEl.addEventListener("click", checkAnswer);
    answerCheckEl.removeEventListener("change", toggleAnswer);
    answerCheckEl.addEventListener("change", toggleAnswer);
    descriptionCheckEl.removeEventListener("change", toggleDescription);
    descriptionCheckEl.addEventListener("change", toggleDescription);
    displayQuestion();
}

// 이미지 슬라이더 생성 함수 - 필름 스트립 버전
function createImageSlider(imageNumbers) {
    if (!imageNumbers || imageNumbers.length === 0) return null;

    const container = document.createElement("div");

    // 3장 이상일 때는 필름 스트립 스타일, 2장 이하는 기존 방식
    if (imageNumbers.length >= 3) {
        container.className = "image-slider-container";
        container.innerHTML = `
            <div class="slider-track" id="sliderTrack">
                ${imageNumbers.map(num => `
                    <div class="slide">
                        <img src="${imageFolderName}${num.trim()}.jpg"
                             alt="문제 관련 이미지"
                             draggable="false">
                    </div>
                `).join('')}
            </div>
        `;

        // 드래그 스크롤 기능 추가
        setTimeout(() => {
            setupDragScroll(container.querySelector('.slider-track'));
        }, 100);

    } else {
        // 2장 이하는 기존 방식
        container.className = "image-container";
        container.innerHTML = imageNumbers.map(num => `
            <img src="${imageFolderName}${num.trim()}.jpg"
                 alt="문제 관련 이미지"
                 class="question-image"
                 draggable="false">
        `).join('');
    }

    return container;
}

// 드래그 스크롤 기능 설정
function setupDragScroll(track) {
    if (!track) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    track.addEventListener('mousedown', (e) => {
        isDown = true;
        track.style.cursor = 'grabbing';
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
        e.preventDefault();
    });

    track.addEventListener('mouseleave', () => {
        isDown = false;
        track.style.cursor = 'grab';
    });

    track.addEventListener('mouseup', () => {
        isDown = false;
        track.style.cursor = 'grab';
    });

    track.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - track.offsetLeft;
        const walk = (x - startX) * 2; // 스크롤 속도 조절
        track.scrollLeft = scrollLeft - walk;
    });

    // 터치 이벤트 (모바일)
    track.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
        if (!startX) return;
        const x = e.touches[0].pageX - track.offsetLeft;
        const walk = (x - startX) * 2;
        track.scrollLeft = scrollLeft - walk;
    }, { passive: true });

    track.addEventListener('touchend', () => {
        startX = null;
    });
}

// 문제 보여주기
function displayQuestion() {
    try {
        if (currentQuestionIndex < questions.length) {
            const currentQuestion = questions[currentQuestionIndex];

            if (!currentQuestion.question && !currentQuestion.sentence) {
                throw new Error("문제 데이터가 올바르지 않습니다.");
            }

            // 호환성: question 또는 sentence 필드 사용
            const rawQuestionText = currentQuestion.question || currentQuestion.sentence || "";
            const questionParts = rawQuestionText.split('(   )');

            // 기존 내용 초기화
            descriptionAreaEl.innerHTML = "";
            questionContainerEl.innerHTML = "";
            resultMessageEl.textContent = "";
            answerCheckEl.checked = false;
            descriptionCheckEl.checked = false;

            // 이미지 표시 (최우선 - 맨 위에 표시)
            if (currentQuestion.image) {
                const imageNumbers = currentQuestion.image.split(",");
                const imageSlider = createImageSlider(imageNumbers);
                if (imageSlider) {
                    descriptionAreaEl.appendChild(imageSlider);
                }
            }

            // 설명 표시 (기본적으로 숨김)
            if (currentQuestion.description) {
                const descEl = document.createElement("p");
                descEl.textContent = currentQuestion.description;
                descEl.style.display = "none";
                descriptionAreaEl.appendChild(descEl);
            }

            // 질문 텍스트와 입력창
            let questionHTML = "";
            for (let i = 0; i < questionParts.length; i++) {
                const textPart = questionParts[i].replace(/\n/g, '<br>');
                questionHTML += `<span>${textPart}</span>`;

                if (i < questionParts.length - 1) {
                    // 정답 그룹에서 가장 긴 정답의 길이를 계산
                    const answersGroup = (currentQuestion.answers && currentQuestion.answers[i]) ? currentQuestion.answers[i] : [];
                    const longestAnswerLength = answersGroup.reduce((max, answer) => Math.max(max, answer.length), 0);

                    const dynamicWidth = Math.max(longestAnswerLength * 2.2, 3) + "ch"; // 최소 너비

                    // input-group으로 input과 hint를 묶음
                    questionHTML += `
                        <div class="input-group">
                            <input type="text" 
                                   class="answerInput" 
                                   placeholder="정답 ${i + 1} 입력" 
                                   data-index="${i}"
                                   style="width: ${dynamicWidth};">
                            <div class="answer-hint"></div>
                        </div>
                    `;
                }
            }

            questionContainerEl.innerHTML = questionHTML;

            // 입력창 이벤트
            const allInputs = document.querySelectorAll(".answerInput");
            allInputs.forEach((input, index) => {
                input.addEventListener("keydown", (event) => {
                    if (event.key === "Enter") {
                        if (index === allInputs.length - 1) {
                            checkAnswer();
                        } else {
                            allInputs[index + 1].focus();
                        }
                    }
                });
            });

            // 첫 번째 입력창에 포커스
            if (allInputs.length > 0) {
                setTimeout(() => {
                    allInputs[0].focus();
                }, 200);
            }

        } else {
            // 게임 종료
            gameEndTime = new Date();
            showGameStats();
            descriptionAreaEl.innerHTML = "";
            descriptionAreaEl.style.display = "none";
            questionContainerEl.textContent = "🥳 게임 종료! 모든 문제를 맞혔습니다!";
            submitBtnEl.style.display = "none";
            answerCheckboxGroupEl.style.display = "none";
            descriptionCheckboxGroupEl.style.display = "none";
            resultMessageEl.style.display = "none";
            gameStatsEl.style.display = "none";
        }
    } catch (error) {
        console.error("문제 표시 오류:", error);
        resultMessageEl.textContent = `오류: ${error.message}`;
        resultMessageEl.style.color = "red";
    }
}

// 정답 토글 함수 - 드롭다운 스타일 (z-index 관리 추가)
function toggleAnswer() {
    const currentQuestion = questions[currentQuestionIndex];
    const hints = document.querySelectorAll(".answer-hint");

    if (answerCheckEl.checked && studyCheckEl.checked) {
        if (currentQuestion.answers) {
            hints.forEach((hint, index) => {
                const answerGroup = currentQuestion.answers[index];
                if (answerGroup && answerGroup.length > 0) {
                    // 기존 내용 초기화
                    hint.innerHTML = '';
                    hint.classList.remove('active');
                    if (hint.closest('.input-group')) {
                        hint.closest('.input-group').classList.remove('active');
                    }

                    // 컨테이너 div 생성
                    const containerDiv = document.createElement('div');
                    containerDiv.style.position = 'relative';

                    // 현재 선택된 정답 표시 (기본은 첫 번째)
                    const currentDiv = document.createElement('div');
                    currentDiv.className = 'answer-current';
                    currentDiv.textContent = answerGroup[0];

                    // 드롭다운 컨테이너
                    const dropdownDiv = document.createElement('div');
                    dropdownDiv.className = 'answer-dropdown';

                    // 각 정답을 드롭다운 아이템으로 생성
                    answerGroup.forEach((answer, answerIndex) => {
                        const answerItem = document.createElement('div');
                        answerItem.className = 'answer-item';
                        answerItem.textContent = answer;
                        answerItem.dataset.index = answerIndex;

                        // 첫 번째 아이템은 선택된 상태로 표시
                        if (answerIndex === 0) {
                            answerItem.classList.add('selected');
                        }

                        // 아이템 클릭 이벤트
                        answerItem.addEventListener('click', function(e) {
                            e.stopPropagation();

                            // 모든 아이템의 선택 상태 제거
                            dropdownDiv.querySelectorAll('.answer-item').forEach(item => {
                                item.classList.remove('selected');
                            });

                            // 현재 아이템 선택
                            this.classList.add('selected');

                            // 현재 표시 업데이트
                            currentDiv.textContent = this.textContent;

                            // 드롭다운 닫기 및 active 상태 제거
                            dropdownDiv.classList.remove('show');
                            hint.classList.remove('active');
                            if (hint.closest('.input-group')) {
                                hint.closest('.input-group').classList.remove('active');
                            }
                        });

                        dropdownDiv.appendChild(answerItem);
                    });

                    // 현재 정답 클릭 시 드롭다운 토글
                    currentDiv.addEventListener('click', function(e) {
                        e.stopPropagation();

                        // 다른 모든 드롭다운 닫기 및 active 상태 제거
                        document.querySelectorAll('.answer-hint').forEach(otherHint => {
                            if (otherHint !== hint) {
                                otherHint.classList.remove('active');
                                const otherDropdown = otherHint.querySelector('.answer-dropdown');
                                if (otherDropdown) {
                                    otherDropdown.classList.remove('show');
                                }
                                if (otherHint.closest('.input-group')) {
                                    otherHint.closest('.input-group').classList.remove('active');
                                }
                            }
                        });

                        // 현재 드롭다운 토글
                        const isOpen = dropdownDiv.classList.contains('show');
                        if (isOpen) {
                            dropdownDiv.classList.remove('show');
                            hint.classList.remove('active');
                            if (hint.closest('.input-group')) {
                                hint.closest('.input-group').classList.remove('active');
                            }
                        } else {
                            dropdownDiv.classList.add('show');
                            hint.classList.add('active');
                            if (hint.closest('.input-group')) {
                                hint.closest('.input-group').classList.add('active');
                            }
                        }
                    });

                    // 컨테이너에 요소들 추가
                    containerDiv.appendChild(currentDiv);
                    containerDiv.appendChild(dropdownDiv);
                    hint.appendChild(containerDiv);
                    hint.style.display = "block";
                }
            });

            // 문서 클릭 시 모든 드롭다운 닫기 (이전 이벤트 리스너 제거 후 추가)
            document.removeEventListener('click', closeAllDropdowns);
            document.addEventListener('click', closeAllDropdowns);
        }
    } else {
        hints.forEach(hint => {
            hint.innerHTML = "";
            hint.style.display = "none";
            hint.classList.remove('active');
            if (hint.closest('.input-group')) {
                hint.closest('.input-group').classList.remove('active');
            }
        });

        // 드롭다운 닫기 이벤트 리스너 제거
        document.removeEventListener('click', closeAllDropdowns);
    }
}

// 모든 드롭다운 닫기 함수
function closeAllDropdowns(e) {
    // 클릭 이벤트가 드롭다운 내부에서 발생한 경우 무시
    if (e && e.target && e.target.closest && e.target.closest('.answer-hint')) {
        return;
    }

    document.querySelectorAll('.answer-dropdown').forEach(dd => dd.classList.remove('show'));
    document.querySelectorAll('.answer-hint').forEach(hint => {
        hint.classList.remove('active');
        if (hint.closest('.input-group')) {
            hint.closest('.input-group').classList.remove('active');
        }
    });
}

// 설명 토글 함수
function toggleDescription() {
    const currentQuestion = questions[currentQuestionIndex];
    const descriptionElements = descriptionAreaEl.children;

    if (descriptionCheckEl.checked) {
        if (currentQuestion.description) {
            for (let el of descriptionElements) {
                if (el.tagName === 'P') {
                    el.style.display = "block";
                }
            }
        }
    } else {
        for (let el of descriptionElements) {
            if (el.tagName === 'P') {
                el.style.display = "none";
            }
        }
    }
}

// 정답 확인
function checkAnswer() {
    const currentQuestion = questions[currentQuestionIndex];
    const correctAnswers = currentQuestion.answers;
    const userInputs = document.querySelectorAll(".answerInput");

    let allCorrect = true;
    userInputs.forEach((input, index) => {
        if (input.disabled) {
            return; // 이미 정답 처리된 입력창은 건너뜀
        }
        const userAnswer = input.value.trim();
        let isCorrect = false;

        // 해당 인덱스의 여러 정답 중 하나라도 맞으면 정답으로 처리
        if (correctAnswers && correctAnswers[index]) {
            for (let correctAnswer of correctAnswers[index]) {
                if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
                    isCorrect = true;
                    break;
                }
            }
        }

        if (isCorrect && userAnswer !== "") {
            input.style.borderColor = "green";
            input.style.backgroundColor = "#e8f5e9";
            input.disabled = true;
        } else {
            input.style.borderColor = "red";
            input.style.backgroundColor = "#ffebee";
            allCorrect = false;
        }
    });

    if (allCorrect) {
        resultMessageEl.textContent = "✅ 모든 정답을 맞혔습니다!";
        resultMessageEl.style.color = "green";
        currentQuestionIndex++;

        setTimeout(() => {
            resultMessageEl.textContent = "";
            displayQuestion();
        }, 1000);
    } else {
        resultMessageEl.textContent = "❌ 틀린 답이 있습니다. 다시 시도해 보세요.";
        resultMessageEl.style.color = "red";
    }
}

// 게임 통계 표시
function showGameStats() {
    const timeDiff = gameEndTime - gameStartTime;
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    const formatDate = (date) => {
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}시 ${date.getMinutes()}분`;
    };

    const statsHTML = `
        <h3>📊 게임 통계</h3>
        <p><strong>시작 시간:</strong> ${formatDate(gameStartTime)}</p>
        <p><strong>종료 시간:</strong> ${formatDate(gameEndTime)}</p>
        <p><strong>소요 시간:</strong> ${hours > 0 ? hours + '시간 ' : ''}${minutes > 0 ? minutes + '분 ' : ''}${seconds}초</p>
        <p><strong>총 문제 수:</strong> ${questions.length}문제</p>
    `;
    gameStatsEl.innerHTML = statsHTML;
    gameStatsEl.style.display = "block";
}

// 초기 화면 설정
descriptionAreaEl.style.display = "none";
questionContainerEl.style.display = "none";
submitBtnEl.style.display = "none";
answerCheckboxGroupEl.style.display = "none";
descriptionCheckboxGroupEl.style.display = "none";