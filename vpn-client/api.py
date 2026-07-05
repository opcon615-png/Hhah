"""
StealthVPN Client - Dashboard API Client
Communicates with the web dashboard for config management.
"""

import requests
import json
from typing import Optional


class DashboardAPI:
    def __init__(self, dashboard_url: str = "http://localhost:3000"):
        self.base_url = dashboard_url.rstrip("/")
        self.session = requests.Session()
        self.session.timeout = 10

    def _get(self, path: str) -> Optional[dict | list]:
        try:
            r = self.session.get(f"{self.base_url}{path}")
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            return None

    def _post(self, path: str, data: dict = None) -> Optional[dict]:
        try:
            r = self.session.post(
                f"{self.base_url}{path}",
                json=data or {},
                headers={"Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            return None

    def _delete(self, path: str) -> bool:
        try:
            r = self.session.delete(f"{self.base_url}{path}")
            return r.ok
        except requests.RequestException:
            return False

    # === Configs ===
    def get_configs(self) -> list:
        data = self._get("/api/configs")
        return data if isinstance(data, list) else []

    def get_active_config(self) -> Optional[dict]:
        configs = self.get_configs()
        for c in configs:
            if c.get("isActive"):
                return c
        return None

    def set_active_config(self, config_id: str) -> bool:
        result = self._put(f"/api/configs/{config_id}", {"isActive": True})
        return result is not None

    def _put(self, path: str, data: dict) -> Optional[dict]:
        try:
            r = self.session.put(
                f"{self.base_url}{path}",
                json=data,
                headers={"Content-Type": "application/json"},
            )
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            return None

    def deactivate_all_configs(self) -> bool:
        configs = self.get_configs()
        for c in configs:
            if c.get("isActive"):
                self._put(f"/api/configs/{c['id']}", {"isActive": False})
        return True

    def import_config(self, data: str, config_type: str = "auto") -> Optional[dict]:
        return self._post("/api/configs/import", {"type": config_type, "data": data})

    # === sing-box Config ===
    def get_singbox_config(self) -> Optional[dict]:
        """Get the complete sing-box configuration from dashboard."""
        return self._get("/api/singbox/config")

    # === Split Tunneling ===
    def get_split_tunneling_rules(self) -> list:
        data = self._get("/api/split-tunneling")
        return data if isinstance(data, list) else []

    # === Ping ===
    def ping_targets(self, targets: list[str]) -> Optional[dict]:
        return self._post("/api/ping/test", {"targets": targets})

    def get_ping_targets(self) -> list:
        data = self._get("/api/ping/targets")
        return data if isinstance(data, list) else []

    # === DNS ===
    def get_dns_configs(self) -> list:
        data = self._get("/api/dns")
        return data if isinstance(data, list) else []

    def get_active_dns(self) -> Optional[dict]:
        configs = self.get_dns_configs()
        for c in configs:
            if c.get("isActive"):
                return c
        return None

    # === Subscriptions ===
    def get_subscriptions(self) -> list:
        data = self._get("/api/subscriptions")
        return data if isinstance(data, list) else []

    def fetch_subscription(self, sub_id: str) -> Optional[dict]:
        return self._post(f"/api/subscriptions/{sub_id}/fetch")

    def fetch_all_subscriptions(self) -> Optional[dict]:
        return self._post("/api/subscriptions/fetch-all")

    # === Health Check ===
    def is_dashboard_reachable(self) -> bool:
        try:
            r = self.session.get(f"{self.base_url}/api/configs", timeout=3)
            return r.ok
        except requests.RequestException:
            return False