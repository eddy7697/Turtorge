use std::path::{Path, PathBuf};
use std::{env, fs};

/// Files that `portable-pty` sideloads from the executable directory when present.
/// See `vendor/conpty/win-x64/README.md` for provenance and the reason they exist.
const CONPTY_FILES: [&str; 2] = ["conpty.dll", "OpenConsole.exe"];

fn main() {
    stage_conpty_host();
    tauri_build::build()
}

/// Copies the vendored ConPTY host next to the produced Windows executable.
///
/// `OUT_DIR` is `<target>/<profile>/build/<crate>-<hash>/out`, so the profile
/// directory that receives `turtorge.exe` is three levels up. Both files must
/// travel together because `conpty.dll` starts `OpenConsole.exe` from its own
/// directory.
fn stage_conpty_host() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let vendor_dir = manifest_dir.join("vendor").join("conpty").join("win-x64");
    for file in CONPTY_FILES {
        println!("cargo:rerun-if-changed={}", vendor_dir.join(file).display());
    }
    if target_os != "windows" || target_arch != "x86_64" {
        return;
    }

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let profile_dir = out_dir
        .ancestors()
        .nth(3)
        .expect("OUT_DIR is nested three levels below the Cargo profile directory")
        .to_path_buf();
    for file in CONPTY_FILES {
        copy_if_changed(&vendor_dir.join(file), &profile_dir.join(file));
    }
}

fn copy_if_changed(source: &Path, destination: &Path) {
    let source_bytes = fs::read(source)
        .unwrap_or_else(|error| panic!("cannot read vendored {}: {error}", source.display()));
    if fs::read(destination).is_ok_and(|existing| existing == source_bytes) {
        return;
    }
    fs::write(destination, source_bytes).unwrap_or_else(|error| {
        panic!(
            "cannot stage {} next to the executable at {}: {error}",
            source.display(),
            destination.display()
        )
    });
}
