
    export function copy_to_clipboard(text) { try { navigator.clipboard.writeText(text); } catch(e) { console.error(e); } }
    export function request_read_clipboard() { 
        try { 
            navigator.clipboard.readText().then(text => { 
                if (text) wasm_bindgen.handle_paste_flow(text); 
            }); 
        } catch(e) { console.error(e); } 
    }
