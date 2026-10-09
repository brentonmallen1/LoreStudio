//! LoreStudio's desktop shell (macOS, Windows, Linux).
//!
//! The app is the same web app the Docker image serves. This shell starts the frozen backend
//! (`backend/lorestudio-backend` among the app's resources) on a kept port on 127.0.0.1 with a
//! one-time launch key, shows a "starting" page until it answers, then signs the window in
//! through the key. Quitting asks the backend to stop (POST /desktop/quit with the key), so the
//! database closes cleanly; if it does not stop in time, it is ended.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::webview::{DownloadEvent, NewWindowResponse};
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// How long a first start may take (the database is made and the demo story added).
const STARTUP_LIMIT: Duration = Duration::from_secs(120);
/// How long the backend has to stop cleanly when the app quits.
const STOP_LIMIT: Duration = Duration::from_secs(10);

struct Backend {
    child: Mutex<Option<Child>>,
    port: u16,
    key: String,
}

/// The same port every launch: the window's storage (theme, panel layout, the unsaved-draft
/// buffer) belongs to its address, so a new port would start it empty. The first launch picks
/// a free one and keeps it in the data folder; a new one is picked only if it is taken.
fn app_port(data_dir: &std::path::Path) -> u16 {
    let kept = data_dir.join(".port");
    if let Some(port) = std::fs::read_to_string(&kept)
        .ok()
        .and_then(|s| s.trim().parse().ok())
    {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    let port = TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .expect("no free port on 127.0.0.1");
    let _ = std::fs::create_dir_all(data_dir);
    let _ = std::fs::write(&kept, port.to_string());
    port
}

fn launch_key() -> String {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).expect("no randomness from the system");
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// One small HTTP/1.0 request to the backend; true if it answered 200.
fn ask(port: u16, request: &str) -> bool {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut reply = String::new();
    stream.write_all(request.as_bytes()).is_ok()
        && stream.read_to_string(&mut reply).is_ok()
        && reply.starts_with("HTTP/1.1 200")
}

/// The backend answers once its database is migrated and it is listening.
fn healthy(port: u16) -> bool {
    ask(
        port,
        &format!("GET /api/health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\n\r\n"),
    )
}

/// The frozen backend inside the app; `LORESTUDIO_BACKEND` points elsewhere while developing.
fn backend_path(app: &AppHandle) -> PathBuf {
    let name = if cfg!(windows) {
        "lorestudio-backend.exe"
    } else {
        "lorestudio-backend"
    };
    std::env::var_os("LORESTUDIO_BACKEND")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            app.path()
                .resource_dir()
                .expect("no resource folder")
                .join("backend")
                .join(name)
        })
}

fn start_backend(app: &AppHandle, port: u16, key: &str, data_dir: &std::path::Path) -> Child {
    let mut command = Command::new(backend_path(app));
    command
        .arg("--port")
        .arg(port.to_string())
        .arg("--data-dir")
        .arg(data_dir)
        .env("LORESTUDIO_DESKTOP_KEY", key);
    #[cfg(windows)]
    {
        // No console window beside the app's own.
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command.spawn().expect("the backend did not start")
}

fn is_ours(url: &Url, port: u16) -> bool {
    match url.scheme() {
        "tauri" | "about" | "blob" | "data" => true,
        // The starting page: tauri://localhost on macOS and Linux, http(s)://tauri.localhost on Windows.
        "http" | "https" if url.host_str() == Some("tauri.localhost") => true,
        "http" => url.host_str() == Some("127.0.0.1") && url.port() == Some(port),
        _ => false,
    }
}

/// Anything that is not the app opens in the person's own browser.
fn open_outside(app: &AppHandle, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

/// A window on the app: the main one, or one it opened (the side panel popped out).
fn app_window<'a>(
    app: &'a AppHandle,
    label: &str,
    url: WebviewUrl,
    port: u16,
) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    static OPENED: AtomicUsize = AtomicUsize::new(0);
    let downloads = app.path().download_dir().ok();
    let for_links = app.clone();
    let for_windows = app.clone();
    WebviewWindowBuilder::new(app, label, url)
        .title("LoreStudio")
        .on_navigation(move |url| {
            if is_ours(url, port) {
                return true;
            }
            open_outside(&for_links, url);
            false
        })
        .on_new_window(move |url, features| {
            if !is_ours(&url, port) {
                open_outside(&for_windows, &url);
                return NewWindowResponse::Deny;
            }
            let n = OPENED.fetch_add(1, Ordering::Relaxed);
            match app_window(
                &for_windows,
                &format!("opened-{n}"),
                WebviewUrl::External(url),
                port,
            )
            .window_features(features)
            .inner_size(420.0, 760.0)
            .build()
            {
                Ok(window) => NewWindowResponse::Create { window },
                Err(_) => NewWindowResponse::Deny,
            }
        })
        .on_download(move |_webview, event| {
            // Exports land in Downloads under the name the app gave them. A native Save
            // dialog is the next step past the proof of concept.
            if let (DownloadEvent::Requested { destination, .. }, Some(dir)) = (event, &downloads) {
                if let Some(name) = destination.file_name().map(|n| n.to_owned()) {
                    *destination = dir.join(name);
                }
            }
            true
        })
}

/// Ask the backend to stop (it folds its write-ahead log into the database on the way out),
/// wait for it, and end it only if it does not.
fn stop_backend(app: &AppHandle) {
    let Some(state) = app.try_state::<Backend>() else {
        return;
    };
    let Some(mut child) = state.child.lock().unwrap().take() else {
        return;
    };
    let port = state.port;
    let quit = format!(
        "POST /desktop/quit HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nX-LoreStudio-Key: {}\r\nContent-Length: 0\r\n\r\n",
        state.key
    );
    let _ = ask(port, &quit);
    let deadline = Instant::now() + STOP_LIMIT;
    while Instant::now() < deadline {
        if let Ok(Some(_)) = child.try_wait() {
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    let _ = child.kill();
}

fn main() {
    let app = tauri::Builder::default()
        // One LoreStudio at a time: a second would start a second backend on the same database.
        // Opening it again brings the window that is already open to the front.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = app.path().app_data_dir()?;
            let port = app_port(&data_dir);
            let key = launch_key();

            let child = start_backend(&handle, port, &key, &data_dir);
            app.manage(Backend {
                child: Mutex::new(Some(child)),
                port,
                key: key.clone(),
            });

            let window = app_window(&handle, "main", WebviewUrl::App("index.html".into()), port)
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 600.0)
                .build()?;

            std::thread::spawn(move || {
                let started = Instant::now();
                while started.elapsed() < STARTUP_LIMIT {
                    if healthy(port) {
                        let open = format!("http://127.0.0.1:{port}/desktop/open?key={key}");
                        let _ = window.navigate(open.parse().expect("a valid address"));
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(250));
                }
                let _ = window.eval(
                    "document.getElementById('status').textContent = 'LoreStudio did not start.';\
                     document.getElementById('problem').style.display = 'block';\
                     document.getElementById('problem').textContent = \
                     'Its backend did not answer within two minutes. Quit and open it again.';",
                );
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("LoreStudio could not start");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            stop_backend(handle);
        }
    });
}
