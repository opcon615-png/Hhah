"""
StealthVPN Client - sing-box Engine Manager
Manages the sing-box process lifecycle.
"""

import subprocess
import json
import os
import sys
import platform
import tempfile
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class SingboxEngine:
    def __init__(self, singbox_path: str = None):
        self.process: Optional[subprocess.Popen] = None
        self.config_path = os.path.join(tempfile.gettempdir(), "singbox_config.json")
        self.singbox_path = singbox_path or self._find_singbox()
        self.is_running = False

    def _find_singbox(self) -> str:
        """Find sing-box binary in common locations."""
        if platform.system() == "Windows":
            candidates = [
                "sing-box.exe",
                os.path.join(os.path.dirname(sys.executable), "sing-box.exe"),
                os.path.join(os.environ.get("PROGRAMFILES", ""), "sing-box", "sing-box.exe"),
                os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "sing-box.exe"),
            ]
        else:
            candidates = [
                "sing-box",
                "/usr/local/bin/sing-box",
                "/usr/bin/sing-box",
                os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin", "sing-box"),
            ]
        for path in candidates:
            if os.path.isfile(path):
                return path
        return "sing-box" if platform.system() != "Windows" else "sing-box.exe"

    def write_config(self, config: dict) -> str:
        """Write sing-box config to temp file."""
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        logger.info(f"Config written to {self.config_path}")
        return self.config_path

    def start(self, config: dict) -> bool:
        """Start sing-box with the given configuration."""
        if self.is_running:
            logger.warning("sing-box is already running")
            return False

        config_path = self.write_config(config)

        if not os.path.isfile(self.singbox_path):
            # Try to find it
            self.singbox_path = self._find_singbox()

        try:
            creation_flags = 0
            if platform.system() == "Windows":
                creation_flags = subprocess.CREATE_NO_WINDOW  # type: ignore

            self.process = subprocess.Popen(
                [self.singbox_path, "run", "-c", config_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=creation_flags,
            )
            self.is_running = True
            logger.info(f"sing-box started (PID: {self.process.pid})")
            return True
        except FileNotFoundError:
            logger.error(f"sing-box not found at: {self.singbox_path}")
            logger.error("Download sing-box from: https://github.com/SagerNet/sing-box/releases")
            return False
        except Exception as e:
            logger.error(f"Failed to start sing-box: {e}")
            return False

    def stop(self) -> bool:
        """Stop the sing-box process."""
        if not self.process or not self.is_running:
            return True

        try:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=3)
            logger.info("sing-box stopped")
        except Exception as e:
            logger.error(f"Error stopping sing-box: {e}")
        finally:
            self.process = None
            self.is_running = False

        # Cleanup temp config
        try:
            if os.path.exists(self.config_path):
                os.remove(self.config_path)
        except OSError:
            pass

        return True

    def restart(self, config: dict) -> bool:
        """Restart sing-box with new config."""
        self.stop()
        return self.start(config)

    @property
    def status(self) -> str:
        if self.is_running and self.process:
            ret = self.process.poll()
            if ret is None:
                return "running"
            else:
                self.is_running = False
                return f"crashed (exit code: {ret})"
        return "stopped"

    def cleanup(self):
        """Clean up resources."""
        self.stop()
        try:
            if os.path.exists(self.config_path):
                os.remove(self.config_path)
        except OSError:
            pass