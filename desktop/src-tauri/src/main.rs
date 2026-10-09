//! LoreStudio's desktop shell (macOS proof of concept).
//!
//! The app is the same web app the Docker image serves. This shell starts the frozen backend
//! (`Resources/backend/lorestudio-backend`) on a free port on 127.0.0.1 with a one-time launch
//! key, shows a "starting" page until it answers, then signs the window in through the key.
//! Quitting asks the backend to stop (SIGTERM), so the database closes cleanly.

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

/// How long a first start may take (the database is made and the demo story added).
const STARTUP_LIMIT: Duration = Duration::from_secs(120);

struct Backend(Mutex<Option<Child>>);

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

/// The backend answers once its database is migrated and it is listening.
fn healthy(port: u16) -> bool {
    let Ok(mut stream) = TcpStream::connect(("127.0.0.1", port)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let request = format!("GET /api/health HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\n\r\n");
    let mut reply = String::new();
    stream.write_all(request.as_bytes()).is_ok()
        && stream.read_to_string(&mut reply).is_ok()
        && reply.starts_with("HTTP/1.1 200")
}

/// The frozen backend inside the app; `LORESTUDIO_BACKEND` points elsewhere while developing.
fn backend_path(app: &AppHandle) -> PathBuf {
    std::env::var_os("LORESTUDIO_BACKEND")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            app.path()
                .resource_dir()
                .expect("no resource folder")
                .join("backend/lorestudio-backend")
        })
}

fn is_ours(url: &Url, port: u16) -> bool {
    match url.scheme() {
        "tauri" | "about" | "blob" | "data" => true,
        "http" => url.host_str() == Some("127.0.0.1") && url.port() == Some(port),
        _ => false,
    }
}

/// Anything that is not the app opens in the person's own browser.
fn open_outside(url: &Url) {
    let _ = Command::new("open").arg(url.as_str()).spawn();
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
    let handle = app.clone();
    WebviewWindowBuilder::new(app, label, url)
        .title("LoreStudio")
        .on_navigation(move |url| {
            if is_ours(url, port) {
                return true;
            }
            open_outside(url);
            false
        })
        .on_new_window(move |url, features| {
            if !is_ours(&url, port) {
                open_outside(&url);
                return NewWindowResponse::Deny;
            }
            let n = OPENED.fetch_add(1, Ordering::Relaxed);
            match app_window(
                &handle,
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

fn stop_backend(app: &AppHandle) {
    let Some(state) = app.try_state::<Backend>() else {
        return;
    };
    let Some(mut child) = state.0.lock().unwrap().take() else {
        return;
    };
    // SIGTERM lets uvicorn finish its requests and close the database; then wait a little.
    unsafe {
        libc::kill(child.id() as libc::pid_t, libc::SIGTERM);
    }
    let deadline = Instant::now() + Duration::from_secs(10);
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
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = app.path().app_data_dir()?;
            let port = app_port(&data_dir);
            let key = launch_key();

            let child = Command::new(backend_path(&handle))
                .arg("--port")
                .arg(port.to_string())
                .arg("--data-dir")
                .arg(&data_dir)
                .env("LORESTUDIO_DESKTOP_KEY", &key)
                .spawn()?;
            app.manage(Backend(Mutex::new(Some(child))));

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
