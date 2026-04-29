from base_entity import BaseEntity
from typing import Optional
from datetime import datetime


class User(BaseEntity):
    username: str
    email: str
    display_name: str
    role: str
    login_count: int
    last_login: Optional[datetime]
    preferences: dict[str, str]

    def __init__(
        self,
        username: str,
        email: str,
        display_name: str,
        role: str = "user",
        created_by: Optional[str] = None,
    ) -> None:
        super().__init__(created_by=created_by)
        self.username = username
        self.email = email
        self.display_name = display_name
        self.role = role
        self.login_count = 0
        self.last_login = None
        self.preferences = {}

    def _run_validations(self) -> None:
        if not self.username or len(self.username) < 3:
            self._add_error("Username must be at least 3 characters.")
        if "@" not in self.email:
            self._add_error("Email must contain @.")

    def record_login(self) -> None:
        self.login_count += 1
        self.last_login = datetime.utcnow()
        self.mark_updated()
        self.emit("login", self.username)

    def is_admin(self) -> bool:
        return self.role == "admin"

    def set_preference(self, key: str, value: str) -> None:
        self.preferences[key] = value


class AdminUser(User):
    managed_user_ids: list[str]
    permissions: list[str]
    can_delete: bool
    audit_log: list[str]

    def __init__(
        self,
        username: str,
        email: str,
        display_name: str,
        can_delete: bool = False,
        created_by: Optional[str] = None,
    ) -> None:
        super().__init__(username, email, display_name, role="admin", created_by=created_by)
        self.managed_user_ids = []
        self.permissions = ["read", "write", "manage_users"]
        self.can_delete = can_delete
        self.audit_log = []
        if can_delete:
            self.permissions.append("delete")

    def grant_permission(self, permission: str) -> None:
        if permission not in self.permissions:
            self.permissions.append(permission)
            self.audit_log.append(f"granted:{permission}")

    def revoke_permission(self, permission: str) -> None:
        self.permissions = [p for p in self.permissions if p != permission]
        self.audit_log.append(f"revoked:{permission}")

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def manage_user(self, user_id: str) -> None:
        if user_id not in self.managed_user_ids:
            self.managed_user_ids.append(user_id)


class ServiceAccount(User):
    service_name: str
    api_keys: list[str]
    rate_limit_per_minute: int
    allowed_ips: list[str]

    def __init__(
        self,
        service_name: str,
        email: str,
        rate_limit_per_minute: int = 100,
    ) -> None:
        super().__init__(
            username=f"svc_{service_name}",
            email=email,
            display_name=service_name,
            role="service",
        )
        self.service_name = service_name
        self.api_keys = []
        self.rate_limit_per_minute = rate_limit_per_minute
        self.allowed_ips = []

    def add_api_key(self, key: str) -> None:
        self.api_keys.append(key)

    def allow_ip(self, ip: str) -> None:
        if ip not in self.allowed_ips:
            self.allowed_ips.append(ip)

    def is_ip_allowed(self, ip: str) -> bool:
        return not self.allowed_ips or ip in self.allowed_ips
