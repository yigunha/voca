/* tslint:disable */
/* eslint-disable */
export function get_version(): string;
export function verify_location(): boolean;
export function get_cookie(name: string): string | undefined;
export function set_cookie(name: string, value: string, days: number): void;
export function delete_cookie(name: string): void;
export function refresh_cookies(): void;
export function check_login_status(): boolean;
export function decrypt_xor(data: Uint8Array): string;
export function encrypt_xor(data: string): Uint8Array;
export function hash_answer(answer: string): string;
export function verify_answer(user_answer: string, correct_hash: string): boolean;
export function create_answer_hash(answer: string): string;
export function generate_block_sequence(correct_blocks_json: string, fake_blocks_json: string, seed: number): string;
export function get_block_color(block_text: string): string;
export function calculate_score(level: number, time_seconds: number, mistakes: number, undos: number): number;
export function create_game_token(level: number, user_answer: string, timestamp: bigint): string;
export function verify_game_token(level: number, user_answer: string, timestamp: bigint, token: string): boolean;
export function verify_timing(_level: number, elapsed_seconds: number): boolean;
export function can_use_bomb(level: number): boolean;
export function reset_bomb_usage(): void;
export function can_undo(): boolean;
export function increment_undo(): void;
export function reset_undo_count(): void;
export function get_undo_count(): number;
export function encrypt_score_data(student_name: string, student_class: string, level: string, scores: Uint32Array, timestamp: bigint): Uint8Array;
export function decrypt_score_data(encrypted: Uint8Array): string;
export function generate_seed(): number;
export function init(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly get_version: () => [number, number];
  readonly verify_location: () => number;
  readonly get_cookie: (a: number, b: number) => [number, number];
  readonly set_cookie: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly delete_cookie: (a: number, b: number) => void;
  readonly refresh_cookies: () => void;
  readonly check_login_status: () => number;
  readonly encrypt_xor: (a: number, b: number) => [number, number];
  readonly verify_answer: (a: number, b: number, c: number, d: number) => number;
  readonly create_answer_hash: (a: number, b: number) => [number, number];
  readonly generate_block_sequence: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly get_block_color: (a: number, b: number) => [number, number];
  readonly calculate_score: (a: number, b: number, c: number, d: number) => number;
  readonly create_game_token: (a: number, b: number, c: number, d: bigint) => [number, number];
  readonly verify_game_token: (a: number, b: number, c: number, d: bigint, e: number, f: number) => number;
  readonly verify_timing: (a: number, b: number) => number;
  readonly can_use_bomb: (a: number) => number;
  readonly reset_bomb_usage: () => void;
  readonly can_undo: () => number;
  readonly increment_undo: () => void;
  readonly reset_undo_count: () => void;
  readonly get_undo_count: () => number;
  readonly encrypt_score_data: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: bigint) => [number, number];
  readonly decrypt_score_data: (a: number, b: number) => [number, number];
  readonly generate_seed: () => number;
  readonly init: () => void;
  readonly hash_answer: (a: number, b: number) => [number, number];
  readonly decrypt_xor: (a: number, b: number) => [number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
