from core.mixins import ObservableMixin, StateMachineMixin
from typing import Optional
from datetime import datetime, timedelta


class AuthProvider(ObservableMixin):
    provider_id: str
    provider_name: str
    is_enabled: bool
    supported_flows: list[str]
    token_ttl_seconds: int

    def __init__(
        self,
        provider_id: str,
        provider_name: str,
        supported_flows: Optional[list[str]] = None,
        token_ttl_seconds: int = 3600,
    ) -> None:
        self._init_observable()
        self.provider_id = provider_id
        self.provider_name = provider_name
        self.is_enabled = True
        self.supported_flows = supported_flows or ["password"]
        self.token_ttl_seconds = token_ttl_seconds

    def authenticate(self, credentials: dict[str, str]) -> Optional[str]:
        raise NotImplementedError

    def validate_token(self, token: str) -> bool:
        raise NotImplementedError

    def revoke_token(self, token: str) -> None:
        raise NotImplementedError

    def supports_flow(self, flow: str) -> bool:
        return flow in self.supported_flows


class JWTAuthProvider(AuthProvider):
    secret_key: str
    algorithm: str
    issuer: str
    audience: list[str]
    refresh_token_ttl_seconds: int
    active_tokens: dict[str, datetime]

    def __init__(
        self,
        provider_id: str,
        secret_key: str,
        issuer: str,
        audience: Optional[list[str]] = None,
        algorithm: str = "HS256",
        token_ttl_seconds: int = 3600,
        refresh_token_ttl_seconds: int = 86400,
    ) -> None:
        super().__init__(
            provider_id, "JWT",
            supported_flows=["password", "refresh_token"],
            token_ttl_seconds=token_ttl_seconds,
        )
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.issuer = issuer
        self.audience = audience or []
        self.refresh_token_ttl_seconds = refresh_token_ttl_seconds
        self.active_tokens = {}

    def authenticate(self, credentials: dict[str, str]) -> Optional[str]:
        token = f"jwt.{credentials.get('username', '')}.token"
        self.active_tokens[token] = datetime.utcnow() + timedelta(seconds=self.token_ttl_seconds)
        self.emit("authenticated", credentials.get("username"))
        return token

    def validate_token(self, token: str) -> bool:
        expiry = self.active_tokens.get(token)
        return expiry is not None and datetime.utcnow() < expiry

    def revoke_token(self, token: str) -> None:
        self.active_tokens.pop(token, None)
        self.emit("token_revoked", token)

    def revoke_all_for_user(self, username: str) -> int:
        to_revoke = [t for t in self.active_tokens if username in t]
        for t in to_revoke:
            del self.active_tokens[t]
        return len(to_revoke)


class OAuthProvider(AuthProvider, StateMachineMixin):
    client_id: str
    client_secret: str
    authorization_endpoint: str
    token_endpoint: str
    scopes: list[str]
    authorization_codes: dict[str, str]
    issued_tokens: dict[str, dict[str, str]]

    def __init__(
        self,
        provider_id: str,
        client_id: str,
        client_secret: str,
        authorization_endpoint: str,
        token_endpoint: str,
        scopes: Optional[list[str]] = None,
        token_ttl_seconds: int = 3600,
    ) -> None:
        AuthProvider.__init__(
            self, provider_id, "OAuth2",
            supported_flows=["authorization_code", "client_credentials", "refresh_token"],
            token_ttl_seconds=token_ttl_seconds,
        )
        self._init_state_machine("idle")
        self.add_transition("idle", "start_auth", "authorizing")
        self.add_transition("authorizing", "complete", "authorized")
        self.add_transition("authorizing", "deny", "idle")
        self.add_transition("authorized", "revoke", "idle")
        self.client_id = client_id
        self.client_secret = client_secret
        self.authorization_endpoint = authorization_endpoint
        self.token_endpoint = token_endpoint
        self.scopes = scopes or ["openid", "profile", "email"]
        self.authorization_codes = {}
        self.issued_tokens = {}

    def authenticate(self, credentials: dict[str, str]) -> Optional[str]:
        code = credentials.get("code")
        if code and code in self.authorization_codes:
            token = f"oauth.{code}.access"
            self.issued_tokens[token] = {"code": code, "scope": " ".join(self.scopes)}
            self.trigger("complete")
            return token
        return None

    def validate_token(self, token: str) -> bool:
        return token in self.issued_tokens

    def revoke_token(self, token: str) -> None:
        self.issued_tokens.pop(token, None)
        self.trigger("revoke")

    def issue_auth_code(self, user_id: str) -> str:
        code = f"code.{user_id}.{datetime.utcnow().timestamp()}"
        self.authorization_codes[code] = user_id
        self.trigger("start_auth")
        return code
