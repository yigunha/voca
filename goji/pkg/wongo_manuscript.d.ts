/* tslint:disable */
/* eslint-disable */
export function authenticate_student(name: string, password: string): Promise<any>;
export function authenticate_teacher(name: string, password: string): Promise<any>;
export function save_manuscript(id: number | null | undefined, student_name: string, _class: string, title: string, content: string, modified_text: string | null | undefined, error_text: string | null | undefined, cols: number): Promise<any>;
export function load_manuscripts(student_name?: string | null, _class?: string | null): Promise<any>;
export function load_manuscript_by_id(id: number): Promise<any>;
export class ManuscriptEngine {
  free(): void;
  [Symbol.dispose](): void;
  constructor(cols: number, rows: number);
  set_teacher_mode(is_teacher: boolean): void;
  get_state(): any;
  process_char(input: string): any;
  backspace(): any;
  move_left(): any;
  move_right(): any;
  toggle_error_mark(row: number, col: number): any;
  clear_error_marks(): any;
  load_content(student_text: string, teacher_text?: string | null, error_text?: string | null): any;
  get_teacher_text(): string;
  get_student_text(): string;
  get_error_text(): string;
  copy_student_to_teacher(): any;
  clear_teacher_cells(): any;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_manuscriptengine_free: (a: number, b: number) => void;
  readonly manuscriptengine_new: (a: number, b: number) => number;
  readonly manuscriptengine_set_teacher_mode: (a: number, b: number) => void;
  readonly manuscriptengine_get_state: (a: number) => any;
  readonly manuscriptengine_process_char: (a: number, b: number, c: number) => any;
  readonly manuscriptengine_backspace: (a: number) => any;
  readonly manuscriptengine_move_left: (a: number) => any;
  readonly manuscriptengine_move_right: (a: number) => any;
  readonly manuscriptengine_toggle_error_mark: (a: number, b: number, c: number) => any;
  readonly manuscriptengine_clear_error_marks: (a: number) => any;
  readonly manuscriptengine_load_content: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => any;
  readonly manuscriptengine_get_teacher_text: (a: number) => [number, number];
  readonly manuscriptengine_get_student_text: (a: number) => [number, number];
  readonly manuscriptengine_get_error_text: (a: number) => [number, number];
  readonly manuscriptengine_copy_student_to_teacher: (a: number) => any;
  readonly manuscriptengine_clear_teacher_cells: (a: number) => any;
  readonly authenticate_student: (a: number, b: number, c: number, d: number) => any;
  readonly authenticate_teacher: (a: number, b: number, c: number, d: number) => any;
  readonly save_manuscript: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number) => any;
  readonly load_manuscripts: (a: number, b: number, c: number, d: number) => any;
  readonly load_manuscript_by_id: (a: number) => any;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly closure78_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure95_externref_shim: (a: number, b: number, c: any, d: any) => void;
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
