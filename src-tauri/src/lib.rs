//! Desktop shell for the Linear Transformation Visualizer.
//!
//! The whole app is the bundled web frontend; this crate only opens the window and exposes two
//! narrow file commands. Paths come from native open/save dialogs (tauri-plugin-dialog), and the
//! commands refuse anything that is not a small `.ltv` / `.json` scene file.

use std::path::Path;

const SCENE_EXTENSIONS: [&str; 2] = ["ltv", "json"];
/// Matches MAX_SCENE_BYTES in src/state/persistence.ts.
const MAX_SCENE_BYTES: u64 = 256 * 1024;

fn check_scene_path(path: &Path) -> Result<(), String> {
    let ok = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| SCENE_EXTENSIONS.iter().any(|x| x.eq_ignore_ascii_case(e)));
    if ok {
        Ok(())
    } else {
        Err("Scene files must end in .ltv or .json".into())
    }
}

#[tauri::command]
fn read_scene(path: String) -> Result<String, String> {
    let path = Path::new(&path);
    check_scene_path(path)?;
    let len = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if len > MAX_SCENE_BYTES {
        return Err("File is too large to be a scene".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_scene(path: String, contents: String) -> Result<(), String> {
    let path = Path::new(&path);
    check_scene_path(path)?;
    if contents.len() as u64 > MAX_SCENE_BYTES {
        return Err("Scene is too large".into());
    }
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_scene, write_scene])
        .run(tauri::generate_context!())
        .expect("error while running the application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_scene_extensions() {
        assert!(check_scene_path(Path::new("/a/b/shear.ltv")).is_ok());
        assert!(check_scene_path(Path::new("C:\\x\\scene.JSON")).is_ok());
        assert!(check_scene_path(Path::new("/etc/passwd")).is_err());
        assert!(check_scene_path(Path::new("/a/b/notes.txt")).is_err());
    }
}
