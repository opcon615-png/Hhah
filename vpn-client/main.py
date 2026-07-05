"""
StealthVPN Desktop - Native Windows App
Opens the Next.js dashboard in a native window (no browser needed).
"""

import sys
import os
import subprocess
import threading
import time
import logging
import webview  # pip install pywebview

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("stealthvpn.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# === Config ===
DASHBOARD_URL = "http://localhost:3000"
WINDOW_TITLE = "StealthVPN"
WINDOW_WIDTH = 1200
WINDOW_HEIGHT = 750
MIN_WIDTH = 900
MIN_HEIGHT = 600


def is_server_running() -> bool:
    """Check if the Next.js dashboard is already running."""
    try:
        import urllib.request
        req = urllib.request.Request(DASHBOARD_URL, method="GET")
        with urllib.request.urlopen(req, timeout=3):
            return True
    except Exception:
        return False


def start_dashboard(dashboard_dir: str):
    """Start the Next.js dev server in background."""
    logger.info(f"Starting dashboard from: {dashboard_dir}")

    if sys.platform == "win32":
        cmd = ["cmd", "/c", "npm", "run", "dev"]
        creation_flags = subprocess.CREATE_NO_WINDOW  # type: ignore
        startupinfo = subprocess.STARTUPINFO()  # type: ignore
        startupinfo.wShowWindow = 0  # SW_HIDE
    else:
        cmd = ["npm", "run", "dev"]
        creation_flags = 0
        startupinfo = None

    process = subprocess.Popen(
        cmd,
        cwd=dashboard_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=creation_flags,
        startupinfo=startupinfo,
    )
    return process


class API:
    """Bridge between JavaScript and Python for system-level operations."""

    def __init__(self):
        self.window = None

    # --- exposed to JS via window.pywebview.api ---

    def minimize(self):
        """Minimize the window."""
        if self.window:
            self.window.minimize()

    def maximize(self):
        """Toggle maximize/restore."""
        if self.window:
            self.window.toggle_fullscreen()

    def close_app(self):
        """Close the application."""
        if self.window:
            self.window.destroy()

    def is_desktop(self):
        """Let the dashboard know it's running as a desktop app."""
        return True

    def get_platform(self):
        """Return the OS platform."""
        return sys.platform

    def notify(self, title: str, body: str):
        """Show a desktop notification."""
        if self.window:
            self.window.set_title(f"{WINDOW_TITLE} — {title}")
        # Windows toast notification
        if sys.platform == "win32":
            try:
                from ctypes import windll
                windll.user32.MessageBoxW(0, body, title, 0x40)
            except Exception:
                pass


def main():
    # Dashboard directory (same folder as this script)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dashboard_dir = script_dir

    # Check if dashboard is running
    server_running = is_server_running()
    server_process = None

    if not server_running:
        # Check if package.json exists (we're in the dashboard folder)
        if not os.path.isfile(os.path.join(dashboard_dir, "package.json")):
            logger.error("package.json not found! Run this from the vpn-dashboard folder.")
            print("Error: package.json not found. Run this script from the vpn-dashboard folder.")
            sys.exit(1)

        logger.info("Dashboard not running. Starting it...")
        server_process = start_dashboard(dashboard_dir)

        # Wait for server to be ready
        logger.info("Waiting for dashboard to start...")
        for i in range(30):
            time.sleep(1)
            if is_server_running():
                logger.info("Dashboard is ready!")
                break
        else:
            logger.error("Dashboard failed to start within 30 seconds.")
            print("Error: Dashboard failed to start. Make sure Node.js is installed.")
            if server_process:
                server_process.terminate()
            sys.exit(1)

    # Create API bridge
    api = API()

    # Create window
    window = webview.create_window(
        title=WINDOW_TITLE,
        url=DASHBOARD_URL,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        min_size=(MIN_WIDTH, MIN_HEIGHT),
        resizable=True,
        text_select=True,
        confirm_close=True,
    )
    api.window = window

    # Start the webview window (blocking)
    logger.info("Opening StealthVPN desktop window...")
    webview.start(debug=False)

    # Cleanup
    if server_process:
        logger.info("Stopping dashboard server...")
        server_process.terminate()
        try:
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill()

    logger.info("StealthVPN Desktop closed.")


if __name__ == "__main__":
    main()