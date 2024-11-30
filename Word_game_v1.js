
        let currentWordIndex = 0;
        let clickedLetters = [];
        let previousClickedCells = [];
        let currentWord;
        let startTime;
        let selectedList;

         // Function to dynamically load the JavaScript file
        function loadWordList() {
            // Remove any existing dynamically loaded script
            const existingScript = document.querySelector('script[data-wordlist]');
            if (existingScript) {
                existingScript.remove();
            }

            // Get the selected list value
            const selectedList = document.getElementById('listSelect').value;

            // Create a new script element
            const script = document.createElement('script');
            script.src = `Word_3A/${selectedList}.js`;
            script.setAttribute('data-wordlist', 'true');

            // Append the script to the document head
            document.head.appendChild(script);
        }

        // Add event listener to the list select dropdown
        document.getElementById('listSelect').addEventListener('change', loadWordList);

        document.getElementById('startButton').addEventListener('click', function() {
            selectedList = document.getElementById('listSelect').value;
            if (!selectedList) {
                alert('리스트를 선택하세요!');
                return;
            }

            document.getElementById('menu').style.display = 'none';
            document.getElementById('gameArea').style.display = 'block';

            //document.getElementById('wordDisplay').textContent = englishTranslations[0];

            selectedLevel = document.getElementById("levelSelect").value;

            if (selectedLevel === "1") {
                createGrid1();           
            } else if (selectedLevel === "2") {
                createGrid2();
            } else {
                initializeGame();
            }


            // 초기 설정
            let d = currentWord.length; // 첫 번째 단어의 글자 수로 초기화
            document.getElementById('header').textContent = `단어 1 / ${words.length} : ${englishTranslations[0]} (${d})`;

            startTime = new Date();    // 게임 시작 시 기록

        });

	
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                // 무작위 인덱스 생성
                let j = Math.floor(Math.random() * (i + 1));
                // 요소를 교환
                [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
        }



        function createGrid1() {
            const grid = document.getElementById('grid');
            grid.innerHTML = '';

            let allLetters = [];
            currentWord = words[currentWordIndex].split('');
            allLetters = words.slice(currentWordIndex, currentWordIndex + 1).join('').split('');

            allLetters = shuffleArray(allLetters);

            for (let i = 0; i < 49; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if (allLetters[i]) {
                        cell.textContent = allLetters[i];
                        cell.addEventListener('click', () => handleCellClick(cell));
                } else {
                        cell.textContent = '';
                        cell.classList.add('empty');
                }
                grid.appendChild(cell);
            }

        }


        function createGrid2() {
            const grid = document.getElementById('grid');
            grid.innerHTML = '';

            let allLetters = [];
            currentWord = words[currentWordIndex].split('');
            
            if (currentWordIndex < words.length - 2) {
                allLetters = words.slice(currentWordIndex, currentWordIndex + 3).join('').split('');
            } else if (currentWordIndex === words.length - 2) {
                allLetters = words.slice(currentWordIndex, currentWordIndex + 2).join('').concat(words.slice(0, 1).join('')).split('');
            } else {
                allLetters = words.slice(currentWordIndex, currentWordIndex + 1).join('').concat(words.slice(0, 2).join('')).split('');
            }
            

             allLetters = shuffleArray(allLetters);

            for (let i = 0; i < 49; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if (allLetters[i]) {
                        cell.textContent = allLetters[i];
                        cell.addEventListener('click', () => handleCellClick(cell));
                } else {
                        cell.textContent = '';
                        cell.classList.add('empty');
                }
                grid.appendChild(cell);
            }
        }

        // 단어 배열을 섞는 함수
        function shuffleWordsAndTranslations() {
            const indices = Array.from({ length: words.length }, (_, i) => i);
            
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            
            const shuffledWords = indices.map(i => words[i]);
            const shuffledTranslations = indices.map(i => englishTranslations[i]);
            
            words.length = 0;
            englishTranslations.length = 0;
            words.push(...shuffledWords);
            englishTranslations.push(...shuffledTranslations);
        }

        
        // 게임 초기화 함수
        function initializeGame() {
            shuffleWordsAndTranslations();
            currentWordIndex = 0;
            currentWord = words[currentWordIndex].split('');
            clickedLetters = [];
            previousClickedCells = [];
            startTime = new Date();
            
            const initialWordLength = currentWord.length;
            document.getElementById('header').textContent = `단어 1 / ${words.length} : ${englishTranslations[0]} (${initialWordLength})`;
            createGrid3();
        }


        function createGrid3() {
            const grid = document.getElementById('grid');
            grid.innerHTML = '';

            let allLetters = [];
            if (currentWordIndex < words.length - 2) {
                allLetters = words.slice(currentWordIndex, currentWordIndex + 3).join('').split('');
            } else if (currentWordIndex === words.length - 2) {
                allLetters = words.slice(currentWordIndex, currentWordIndex + 2).join('').concat(words.slice(0, 1).join('')).split('');
            } else {
                allLetters = words.slice(currentWordIndex, currentWordIndex + 1).join('').concat(words.slice(0, 2).join('')).split('');
            }

            allLetters = shuffleArray(allLetters);

            for (let i = 0; i < 49; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if (allLetters[i]) {
                    cell.textContent = allLetters[i];
                    cell.addEventListener('click', () => handleCellClick(cell));
                } else {
                    cell.textContent = '';
                    cell.classList.add('empty');
                }
                grid.appendChild(cell);
            }
        }


        function handleCellClick(cell) {
            if (clickedLetters.length < currentWord.length && cell.textContent) {
                clickedLetters.push(cell.textContent);
                previousClickedCells.push(cell);
                cell.textContent = '';
                cell.classList.add('empty');
                updateBottomRow();

                // "되돌리기" 버튼 활성화
                const undoButton = document.getElementById('undoButton');
                if (clickedLetters.length > 0) {
                    undoButton.classList.remove('disabled');
                    undoButton.disabled = false;
                }

                if (clickedLetters.length === currentWord.length) {
                    checkCompletion();
                }
            }
        }


        function updateBottomRow() {
            const bottomRow = document.getElementById('bottomRow');
            bottomRow.innerHTML = '';
            clickedLetters.forEach(letter => {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.textContent = letter;
                bottomRow.appendChild(cell);
            });
        }


        function checkCompletion() {
            const alertBox = document.getElementById('alert');
            if (clickedLetters.join('') === currentWord.join('')) {
                alertBox.classList.add('hidden');
                if (currentWordIndex < words.length - 1) {
                    currentWordIndex++;
                    currentWord = words[currentWordIndex].split('');
                    clickedLetters = [];
                    previousClickedCells = [];
                    let d = currentWord.length; // 맞추어야 할 글자 수
                    document.getElementById('header').textContent = `단어 ${currentWordIndex + 1} / ${words.length} : ${englishTranslations[currentWordIndex]} (${d})`;
                    
                    if (selectedLevel === "1") {
                        createGrid1();           
                    } else if (selectedLevel === "2") {
                        createGrid2();
                    } else {
                        createGrid3();
                    }

                    updateBottomRow();

                    // "되돌리기" 버튼 비활성화
                    const undoButton = document.getElementById('undoButton');
                    undoButton.classList.add('disabled');
                    undoButton.disabled = true;
                } else {
                    // 마지막 문제를 완료한 경우
               
                    document.getElementById('grid').style.display = 'none';
                    document.getElementById('bottomRow').style.display = 'none';
                    document.getElementById('undoButton').style.display = 'none';
                    document.getElementById('header').style.display = 'none';
                   // document.getElementById('end-message').classList.remove('hidden');
                    displaySelection();
                    displayDateTime(); // 날짜와 시간 표시
                }
            } else {
                alertBox.classList.remove('hidden');
                clickedLetters = [];
                previousClickedCells = [];
                updateBottomRow();
  
                if (selectedLevel === "1") {
                    createGrid1();           
                } else if (selectedLevel === "2") {
                    createGrid2();
                } else {
                    createGrid3();
                }
            }
        }


        document.getElementById('undoButton').addEventListener('click', () => {
            if (clickedLetters.length > 0) {
                const lastLetter = clickedLetters.pop();
                const lastCell = previousClickedCells.pop();
                if (lastCell) {
                    lastCell.textContent = lastLetter;
                    lastCell.classList.remove('empty');
                }
                updateBottomRow();

                // "되돌리기" 버튼 비활성화 조건 확인
                if (clickedLetters.length === 0) {
                    const undoButton = document.getElementById('undoButton');
                    undoButton.classList.add('disabled');
                    undoButton.disabled = true;
                }
            }
        });


        function displaySelection() {
            // 선택된 것이 몇 과 인지 알려준다.
            var selectedItem = document.getElementById("listSelect").value;

            // 선택된 값을 화면에 출력합니다.
            document.getElementById("selectedValue").textContent = "항목: " + selectedItem + "과 Level " + selectedLevel;
        }


        function displayDateTime() {
            const dateTimeElement = document.getElementById('date-time');
            const now = new Date();
            const formattedDate = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${now.getHours()}시 ${now.getMinutes()}분`;

            // 문제 푸는 데 걸린 시간 계산
            const timeTaken = Math.floor((now - startTime) / 1000); // 초 단위로 계산
            const minutes = Math.floor(timeTaken / 60);
            const seconds = timeTaken % 60;

            dateTimeElement.innerHTML = `&nbsp;<br>${formattedDate}<br>걸린 시간: ${minutes}분 ${seconds}초`;
        }
