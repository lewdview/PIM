// PIM : th3v4ult — Native Desktop Engine Core (Tauri 2.0)

#[tauri::command]
fn get_system_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "app": "PIM : th3v4ult",
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "identifier": "art.th3scr1b3.pim"
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_system_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running PIM : th3v4ult desktop engine");
}
