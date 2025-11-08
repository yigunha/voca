/* tslint:disable */
/* eslint-disable */
/**
 * 학생 인증 함수
 */
export function authenticate_student(student_name: string, _class: string, password: string): Promise<any>;
/**
 * 쿠키 설정 (30일)
 */
export function set_cookie(name: string, value: string, days: number): void;
/**
 * 쿠키 읽기
 */
export function get_cookie(name: string): string;
/**
 * 쿠키 삭제
 */
export function delete_cookie(name: string): void;
/**
 * 로그인 상태 확인
 */
export function check_login_status(): boolean;
/**
 * 쿠키 갱신 (30일 연장)
 */
export function refresh_cookies(): void;
/**
 * XOR cipher를 사용하여 데이터를 복호화합니다.
 * Python의 encrypt_data.py와 동일한 알고리즘을 사용합니다.
 * SECRET_KEY는 WASM 내부에 저장되어 JavaScript에서 접근할 수 없습니다.
 */
export function decrypt_xor(encrypted_data: Uint8Array): string;
/**
 * Base64로 인코딩된 암호화 데이터를 복호화합니다.
 */
export function decrypt_xor_base64(encrypted_base64: string): string;
/**
 * 도메인 체크 함수
 */
export function check_domain(): boolean;
/**
 * WASM 모듈 초기화
 */
export function main(): void;
/**
 * 버전 정보 반환
 */
export function get_version(): string;
/**
 * 간단한 테스트 함수
 */
export function greet(name: string): string;
/**
 * 현재 도메인 정보 반환 (디버깅용)
 */
export function get_current_domain(): string;
/**
 * 허용된 도메인 목록 반환 (디버깅용)
 */
export function get_allowed_domains(): any[];

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly authenticate_student: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly set_cookie: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly get_cookie: (a: number, b: number) => [number, number, number, number];
  readonly delete_cookie: (a: number, b: number) => [number, number];
  readonly check_login_status: () => number;
  readonly refresh_cookies: () => [number, number];
  readonly decrypt_xor: (a: number, b: number) => [number, number, number, number];
  readonly decrypt_xor_base64: (a: number, b: number) => [number, number, number, number];
  readonly check_domain: () => [number, number, number];
  readonly main: () => void;
  readonly get_version: () => [number, number];
  readonly greet: (a: number, b: number) => [number, number];
  readonly get_current_domain: () => [number, number, number, number];
  readonly get_allowed_domains: () => [number, number];
  readonly wasm_bindgen__convert__closures_____invoke__h1531974488df2bb8: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__he4e11a560d193a5b: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h154ba7a3ea507bfe: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_drop_slice: (a: number, b: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
