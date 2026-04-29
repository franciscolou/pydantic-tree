from core.base import AggregateRoot
from core.mixins import ObservableMixin, StateMachineMixin
from typing import Optional
from datetime import datetime


class UserAccount(AggregateRoot, ObservableMixin):
    username: str
    email: str
    display_name: str
    role: str
    login_count: int
    last_login: Optional[datetime]
    failed_login_count: int
    preferences: dict[str, str]
    two_factor_enabled: bool

    def __init__(
        self,
        username: str,
        email: str,
        display_name: str,
        role: str = "user",
        object_id: Optional[str] = None,
    ) -> None:
        AggregateRoot.__init__(self, object_id)
        self._init_observable()
        self.username = username
        self.email = email
        self.display_name = display_name
        self.role = role
        self.login_count = 0
        self.last_login = None
        self.failed_login_count = 0
        self.preferences = {}
        self.two_factor_enabled = False

    def record_login(self) -> None:
        self.login_count += 1
        self.last_login = datetime.utcnow()
        self.failed_login_count = 0
        self.apply({"type": "login", "user_id": self.object_id})
        self.emit("login", self)

    def record_failed_login(self) -> None:
        self.failed_login_count += 1
        self.emit("failed_login", self)

    def is_locked_out(self, max_failures: int = 5) -> bool:
        return self.failed_login_count >= max_failures

    def enable_2fa(self) -> None:
        self.two_factor_enabled = True
        self.apply({"type": "2fa_enabled"})

    def set_preference(self, key: str, value: str) -> None:
        self.preferences[key] = value

    def is_admin(self) -> bool:
        return self.role in ("admin", "superadmin")


class AdminAccount(UserAccount, StateMachineMixin):
    managed_user_ids: list[str]
    permissions: frozenset[str]
    audit_log: list[dict[str, Any]]
    access_level: int

    def __init__(
        self,
        username: str,
        email: str,
        display_name: str,
        access_level: int = 1,
        object_id: Optional[str] = None,
    ) -> None:
        UserAccount.__init__(self, username, email, display_name, role="admin", object_id=object_id)
        self._init_state_machine("active")
        self.add_transition("active", "suspend", "suspended")
        self.add_transition("suspended", "reinstate", "active")
        self.add_transition("active", "deactivate", "deactivated")
        self.managed_user_ids = []
        self.permissions = frozenset({"read", "write", "manage_users"})
        self.audit_log = []
        self.access_level = access_level

    def grant_permission(self, perm: str) -> None:
        self.permissions = self.permissions | {perm}
        self.audit_log.append({"action": "grant", "permission": perm, "at": datetime.utcnow().isoformat()})

    def revoke_permission(self, perm: str) -> None:
        self.permissions = self.permissions - {perm}
        self.audit_log.append({"action": "revoke", "permission": perm, "at": datetime.utcnow().isoformat()})

    def has_permission(self, perm: str) -> bool:
        return perm in self.permissions

    def can_manage(self, user_id: str) -> bool:
        return user_id in self.managed_user_ids or self.access_level >= 3


class ServiceAccount(UserAccount):
    service_name: str
    api_keys: list[str]
    rate_limit_rps: int
    allowed_ips: list[str]
    scopes: list[str]

    def __init__(
        self,
        service_name: str,
        email: str,
        rate_limit_rps: int = 100,
        scopes: Optional[list[str]] = None,
    ) -> None:
        super().__init__(
            username=f"svc.{service_name}",
            email=email,
            display_name=service_name,
            role="service",
        )
        self.service_name = service_name
        self.api_keys = []
        self.rate_limit_rps = rate_limit_rps
        self.allowed_ips = []
        self.scopes = scopes or []

    def add_api_key(self, key: str) -> None:
        self.api_keys.append(key)
        self.apply({"type": "api_key_added"})

    def allow_ip(self, ip: str) -> None:
        if ip not in self.allowed_ips:
            self.allowed_ips.append(ip)

    def has_scope(self, scope: str) -> bool:
        return scope in self.scopes
