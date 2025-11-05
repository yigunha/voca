/* tslint:disable */
/* eslint-disable */
export function init(): void;
export function authenticate_student(student_name: string, _class: string, password: string): Promise<any>;
export function save_manuscript(student_name: string, _class: string, title: string, content: string, cols: number): Promise<any>;
export function load_manuscript_list(student_name: string, _class: string): Promise<any>;
export function load_existing_files(student_name: string, _class: string): Promise<any>;
export function update_manuscript(id: number, content: string, cols: number): Promise<any>;
export function check_manuscript_exists(student_name: string, _class: string, title: string): Promise<any>;
export class InputHandler {
  free(): void;
  [Symbol.dispose](): void;
  constructor(cols: number, rows: number);
  set_position(pos: number): void;
  get_position(): number;
  start_composition(): void;
  end_composition(): void;
  is_composing(): boolean;
  update_composition(text: string): any;
  finalize_composition(text: string): any;
  process_input(text: string): any;
  handle_space(): any;
  handle_backspace(): any;
  handle_delete(): any;
  finalize_buffer(): any;
  place_char_and_move(ch: string): any;
  move_left(): boolean;
  move_right(): boolean;
  move_up(): boolean;
  move_down(): boolean;
  move_next_row(): boolean;
  get_buffer_state(): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_inputhandler_free: (a: number, b: number) => void;
  readonly inputhandler_new: (a: number, b: number) => number;
  readonly inputhandler_set_position: (a: number, b: number) => void;
  readonly inputhandler_get_position: (a: number) => number;
  readonly inputhandler_start_composition: (a: number) => void;
  readonly inputhandler_end_composition: (a: number) => void;
  readonly inputhandler_is_composing: (a: number) => number;
  readonly inputhandler_update_composition: (a: number, b: number, c: number) => any;
  readonly inputhandler_finalize_composition: (a: number, b: number, c: number) => any;
  readonly inputhandler_process_input: (a: number, b: number, c: number) => any;
  readonly inputhandler_handle_space: (a: number) => any;
  readonly inputhandler_handle_backspace: (a: number) => any;
  readonly inputhandler_finalize_buffer: (a: number) => any;
  readonly inputhandler_place_char_and_move: (a: number, b: number) => any;
  readonly inputhandler_move_left: (a: number) => number;
  readonly inputhandler_move_right: (a: number) => number;
  readonly inputhandler_move_up: (a: number) => number;
  readonly inputhandler_move_down: (a: number) => number;
  readonly inputhandler_move_next_row: (a: number) => number;
  readonly inputhandler_get_buffer_state: (a: number) => any;
  readonly inputhandler_handle_delete: (a: number) => any;
  readonly init: () => void;
  readonly authenticate_student: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly save_manuscript: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => any;
  readonly load_manuscript_list: (a: number, b: number, c: number, d: number) => any;
  readonly load_existing_files: (a: number, b: number, c: number, d: number) => any;
  readonly update_manuscript: (a: number, b: number, c: number, d: number) => any;
  readonly check_manuscript_exists: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly wasm_bindgen__convert__closures_____invoke__hd9967afd98a984bb: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__he0dfb8770d4ad62e: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h86ba8cdd7f9830c4: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
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
