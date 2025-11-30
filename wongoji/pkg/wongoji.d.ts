/* tslint:disable */
/* eslint-disable */
export function get_current_layer(): string;
export function load_full_data_rs(student_json: string, teacher_json: string, markings_json: string, cols: number): void;
export function switch_layer_rs(layer: string): void;
export function render_paper_rs(rows: number, cols: number): void;
export function toggle_empty_rows_rs(hide: boolean): void;
export function fill_grid_content(text: string, layer: string, cols: number): void;
export function read_grid_content(rows: number, cols: number): string;
export function update_cell_content(idx: number, text: string): void;
export function clear_cell_content(idx: number): void;
export function get_cell_content_rs(idx: number): string;
export function set_cell_temp(idx: number, text: string): void;
export function update_active_cell_rs(idx: number): void;
export function clear_active_cell_rs(): void;
export function draw_markings_rs(markings_json: string, cols: number): void;
export function clear_markings_rs(): void;
export function set_cell_mode(mode: string): void;
export function undo(): void;
export function redo(): void;
export function init_input_state(rows: number, cols: number): void;
export function set_cursor_pos(idx: number): void;
export function paste_external_text(text: string): void;
export function handle_paste_flow(system_text: string): void;
export function paste_text_at_cursor(text: string): void;
export function handle_input_event(data: string): void;
export function handle_composition_start(): void;
export function handle_composition_update(data: string): void;
export function handle_composition_end(data: string): void;
export function handle_keydown(e: KeyboardEvent): void;
export function handle_cell_mousedown(idx: number, shift_key: boolean): void;
export function handle_cell_mouseenter(idx: number): void;
export function handle_global_mouseup(): void;
export function get_selected_text(): string;
export function delete_selected_cells(): void;
export function force_stop_composition(): void;
export function init_app(): void;
export function login_student(student_name: string, _class: string, password: string): Promise<any>;
export function set_cookie(name: string, value: string, days: number): void;
export function get_cookie(name: string): string;
export function logout_student(): void;
export function fetch_my_manuscripts(): Promise<any>;
export function save_student_content(id_f64: number, content: string): Promise<any>;
export function create_new_manuscript(title: string, cols: number): Promise<any>;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly get_current_layer: () => [number, number];
  readonly load_full_data_rs: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
  readonly switch_layer_rs: (a: number, b: number) => void;
  readonly render_paper_rs: (a: number, b: number) => [number, number];
  readonly toggle_empty_rows_rs: (a: number) => [number, number];
  readonly fill_grid_content: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly read_grid_content: (a: number, b: number) => [number, number, number, number];
  readonly update_cell_content: (a: number, b: number, c: number) => [number, number];
  readonly clear_cell_content: (a: number) => [number, number];
  readonly get_cell_content_rs: (a: number) => [number, number, number, number];
  readonly set_cell_temp: (a: number, b: number, c: number) => [number, number];
  readonly update_active_cell_rs: (a: number) => [number, number];
  readonly clear_active_cell_rs: () => [number, number];
  readonly draw_markings_rs: (a: number, b: number, c: number) => [number, number];
  readonly clear_markings_rs: () => [number, number];
  readonly set_cell_mode: (a: number, b: number) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly init_input_state: (a: number, b: number) => void;
  readonly paste_external_text: (a: number, b: number) => void;
  readonly handle_paste_flow: (a: number, b: number) => void;
  readonly handle_input_event: (a: number, b: number) => void;
  readonly handle_composition_start: () => void;
  readonly handle_composition_update: (a: number, b: number) => void;
  readonly handle_composition_end: (a: number, b: number) => void;
  readonly handle_keydown: (a: any) => void;
  readonly handle_cell_mousedown: (a: number, b: number) => void;
  readonly get_selected_text: () => [number, number];
  readonly force_stop_composition: () => void;
  readonly paste_text_at_cursor: (a: number, b: number) => void;
  readonly handle_cell_mouseenter: (a: number) => void;
  readonly handle_global_mouseup: () => void;
  readonly set_cursor_pos: (a: number) => void;
  readonly delete_selected_cells: () => void;
  readonly init_app: () => void;
  readonly login_student: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
  readonly set_cookie: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly get_cookie: (a: number, b: number) => [number, number, number, number];
  readonly logout_student: () => void;
  readonly fetch_my_manuscripts: () => any;
  readonly save_student_content: (a: number, b: number, c: number) => any;
  readonly create_new_manuscript: (a: number, b: number, c: number) => any;
  readonly wasm_bindgen__convert__closures_____invoke__ha773d59f2f8084c9: (a: number, b: number, c: any) => void;
  readonly wasm_bindgen__closure__destroy__h7478a835394e7be4: (a: number, b: number) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h20e9c373f166664a: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
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
