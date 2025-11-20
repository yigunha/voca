# 한국어 학습 게임 - 수정 완료

## 수정 사항

1. **Cargo.toml**
   - gloo-net = "0.6" 추가
   - urlencoding = "2.1" 추가
   - base64 = "0.22" 추가

2. **src/lib.rs**
   - pub mod auth; 추가
   - pub mod crypto; 추가

## 빌드 방법

```bash
wasm-pack build --target web --release
```

빌드 후 생성된 `pkg/` 폴더를 `tetris/pkg/`로 복사하세요.

## 프로젝트 구조

```
korean-game-wasm/
├── Cargo.toml
├── munpup.html
├── src/
│   ├── lib.rs
│   ├── auth.rs
│   └── crypto.rs
└── tetris/
    ├── game_wasm.html
    └── pkg/ (빌드 후 생성)
```
