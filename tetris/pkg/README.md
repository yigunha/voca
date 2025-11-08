# 한국어 학습 게임 - WASM 버전

테트리스 스타일의 한국어 형태소 분석 학습 게임입니다. Rust + WebAssembly로 구현된 보안 기능을 포함합니다.

## 📁 프로젝트 구조

```
korean-game-wasm/
├── src/                          # Rust WASM 소스코드
│   ├── lib.rs                    # 메인 엔트리 포인트
│   ├── auth.rs                   # Supabase 인증 모듈
│   └── crypto.rs                 # XOR 복호화 모듈
│
├── data_before/                  # 원본 데이터
│   └── 3A.json                   # 암호화 전 게임 데이터
│
├── tetris/                       # 게임 폴더
│   ├── game_wasm.html            # 게임 페이지
│   ├── pkg/                      # 빌드된 WASM (생성됨)
│   │   ├── korean_game_wasm.js
│   │   ├── korean_game_wasm_bg.wasm
│   │   └── ...
│   └── data/                     # 암호화된 데이터
│       └── 3A_encrypted.dat
│
├── index.html                    # 로그인 페이지
├── Cargo.toml                    # Rust 프로젝트 설정
├── encrypt_data.py               # 데이터 암호화 스크립트
├── build.sh                      # 빌드 자동화 스크립트
└── README.md                     # 이 파일
```

## 🚀 빠른 시작

### 1단계: 필수 도구 설치

```bash
# Rust 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# wasm-pack 설치
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Python 3 확인
python3 --version
```

### 2단계: 프로젝트 빌드

```bash
# 빌드 스크립트 실행 권한 부여
chmod +x build.sh

# 빌드 실행
./build.sh
```

빌드 스크립트는 다음을 수행합니다:
1. `data_before/3A.json` → `tetris/data/3A_encrypted.dat` 암호화
2. Rust 코드 컴파일 → `tetris/pkg/` 폴더에 WASM 생성

### 3단계: Supabase 설정 (선택사항)

로그인 기능을 사용하려면:

1. https://supabase.com 에서 프로젝트 생성
2. SQL Editor에서 테이블 생성:

```sql
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_name VARCHAR(50) NOT NULL,
    class VARCHAR(10) NOT NULL,
    student_number VARCHAR(20) NOT NULL
);

-- 테스트 데이터
INSERT INTO students (student_name, class, student_number) VALUES
('홍길동', '3-1', '20231234'),
('김철수', '3-2', '20235678');
```

3. `src/auth.rs` 파일 수정:

```rust
const SUPABASE_URL: &str = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY: &str = "your-anon-key-here";
```

4. 다시 빌드:

```bash
./build.sh
```

### 4단계: 실행

```bash
# 로컬 서버 시작
python3 -m http.server 8000
```

브라우저에서 접속: **http://localhost:8000**

## 🔐 보안 설정

### SECRET_KEY 변경

**환경변수로 설정:**
```bash
export XOR_SECRET_KEY="YourCustomSecretKey123"
./build.sh
```

**주의:** JavaScript 파일(`index.html`, `tetris/game_wasm.html`)에서도 동일한 키를 사용해야 합니다:

```javascript
const SECRET_KEY = 'YourCustomSecretKey123'; // 여기를 변경
```

## 📚 주요 기능

### 1. Supabase 인증 (WASM)

```javascript
// 학생 로그인
const result = await wasmModule.authenticate_student(
    '홍길동',  // 학생 이름
    '3-1',     // 반
    '1234'     // 학번 뒷 4자리
);
```

### 2. XOR 암호화/복호화

**Python으로 암호화:**
```bash
python3 encrypt_data.py
```

**WASM으로 복호화:**
```javascript
const decrypted = wasmModule.decrypt_xor(encryptedBytes, SECRET_KEY);
const gameData = JSON.parse(decrypted);
```

### 3. 쿠키 자동 갱신 (30일)

```javascript
// 매 페이지 로드 시 자동으로 쿠키 30일 연장
wasmModule.refresh_cookies();
```

## 🎮 게임 데이터 추가/수정

1. `data_before/3A.json` 파일 편집:

```json
[
  {
    "group": 1,
    "problems": [
      {
        "description": "당신의 문제",
        "answer": "정답/을/ /입력/하세요"
      }
    ]
  }
]
```

2. 재암호화:

```bash
python3 encrypt_data.py
```

3. 브라우저 새로고침

## 🔧 개발 명령어

```bash
# WASM 빌드만
wasm-pack build --target web --out-dir tetris/pkg --release

# Rust 테스트
cargo test

# 데이터 암호화만
python3 encrypt_data.py

# 전체 빌드
./build.sh
```

## 📊 WASM API 참조

### 인증 함수
- `authenticate_student(name, class, password)` - 학생 인증
- `set_cookie(name, value, days)` - 쿠키 저장
- `get_cookie(name)` - 쿠키 읽기
- `delete_cookie(name)` - 쿠키 삭제
- `check_login_status()` - 로그인 상태 확인
- `refresh_cookies()` - 쿠키 갱신 (30일 연장)

### 암호화 함수
- `decrypt_xor(data, key)` - XOR 복호화
- `decrypt_xor_base64(data, key)` - Base64 복호화

### 유틸리티
- `get_version()` - 버전 정보
- `greet(name)` - 테스트 함수

## 🐛 문제 해결

### "Failed to fetch WASM module" 에러
**원인:** 로컬 파일 시스템에서 직접 열었을 때 CORS 제한

**해결:**
```bash
python3 -m http.server 8000
```

### 복호화 실패
**원인:** SECRET_KEY 불일치

**해결:**
1. `encrypt_data.py`와 JavaScript의 KEY가 동일한지 확인
2. 재암호화: `python3 encrypt_data.py`

### Supabase 연결 실패
**원인:** URL/KEY 오류 또는 CORS 설정

**해결:**
1. `src/auth.rs`에서 URL/KEY 확인
2. Supabase Dashboard → Settings → API에서 키 확인
3. 재빌드 필요

## 🚀 배포

### GitHub Pages

```bash
# 빌드 후 커밋
./build.sh
git add .
git commit -m "Build WASM"
git push

# GitHub Settings → Pages → Source: main branch
```

### Netlify

```bash
# netlify.toml 생성
cat > netlify.toml << EOF
[build]
  command = "./build.sh"
  publish = "."
EOF
```

## 📄 라이선스

MIT License

## 🤝 기여

이슈와 PR은 언제나 환영합니다!

---

**제작:** Rust + WebAssembly + Supabase  
**버전:** 0.1.0
