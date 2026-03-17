"""
VPN Telegram Mini App - FastAPI Backend
"""
from fastapi import FastAPI, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, select, Numeric, Index, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Optional, Dict
from contextlib import asynccontextmanager
import secrets
import hashlib
import logging
import asyncio
import os
import json

# JWT
try:
    import jwt
    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False

# Rate limiting
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    SLOWAPI_AVAILABLE = True
except ImportError:
    SLOWAPI_AVAILABLE = False

logger = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# ============================================
# DATABASE
# ============================================

def get_database_url() -> str:
    try:
        override_path = "/app/data/db_override.json" if os.path.isdir("/app") else os.path.join(os.path.dirname(__file__), "data", "db_override.json")
        if os.path.exists(override_path):
            with open(override_path, "r") as f:
                override = json.load(f)
            url = override.get("database_url")
            if url:
                return url
    except Exception:
        pass
    url = os.getenv("DATABASE_URL")
    if not url:
        return "postgresql+asyncpg://placeholder:placeholder@localhost:5432/placeholder"
    return url


DATABASE_URL = get_database_url()
ENGINE_URL = DATABASE_URL
if ENGINE_URL.startswith("postgresql://"):
    ENGINE_URL = ENGINE_URL.replace("postgresql://", "postgresql+asyncpg://")
elif ENGINE_URL.startswith("postgres://"):
    ENGINE_URL = ENGINE_URL.replace("postgres://", "postgresql+asyncpg://")

engine = create_async_engine(
    ENGINE_URL,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    pool_size=int(os.getenv("DB_POOL_SIZE", "15")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_timeout=30,
)

async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session():
    db = async_session_maker()
    try:
        yield db
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


@asynccontextmanager
async def get_db_session():
    db = async_session_maker()
    try:
        yield db
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


# ============================================
# MODELS
# ============================================

class Base(DeclarativeBase):
    pass


class Settings(Base):
    __tablename__ = 'settings'
    key = Column(String(255), primary_key=True)
    value = Column(Text)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, nullable=True)


class Admins(Base):
    __tablename__ = 'admins'
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default='admin')
    active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=True)
    logs = relationship('AdminLog', back_populates='admin')

    __table_args__ = (
        Index('idx_admins_username', 'username'),
        Index('idx_admins_active', 'active'),
    )


class AdminLog(Base):
    __tablename__ = 'admin_logs'
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey('admins.id', ondelete='SET NULL'), nullable=True)
    admin_username = Column(String(255), nullable=True)
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=True)
    entity_name = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False)
    admin = relationship('Admins', back_populates='logs')


class SubscriptionPlans(Base):
    __tablename__ = 'subscription_plans'
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    duration_days = Column(Integer, nullable=False)
    active = Column(Boolean, default=True)
    device_limit = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=True)


# ============================================
# DB METHODS
# ============================================

async def get_setting(db: AsyncSession, key: str) -> Optional[str]:
    statement = select(Settings).filter(Settings.key == key)
    result = await db.execute(statement)
    setting = result.scalar_one_or_none()
    return setting.value if setting else None


async def get_settings(db: AsyncSession) -> Dict:
    statement = select(Settings)
    result = await db.execute(statement)
    rows = result.scalars().all()
    settings = {}
    for row in rows:
        value = row.value
        if value and value.strip().startswith(('{', '[')):
            try:
                settings[row.key] = json.loads(value)
                continue
            except (json.JSONDecodeError, TypeError):
                pass
        if value and value.lower() == 'true':
            settings[row.key] = True
        elif value and value.lower() == 'false':
            settings[row.key] = False
        else:
            settings[row.key] = value
    return settings


async def update_setting(db: AsyncSession, key: str, value: str):
    statement = select(Settings).filter(Settings.key == key)
    result = await db.execute(statement)
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
        setting.updated_at = datetime.now()
    else:
        setting = Settings(key=key, value=value, updated_at=datetime.now())
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


async def get_admin_by_username(db: AsyncSession, username: str) -> Optional[Admins]:
    statement = select(Admins).filter(Admins.username == username)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def verify_admin(db: AsyncSession, username: str, password: str) -> bool:
    admin = await get_admin_by_username(db, username)
    if not admin:
        return False
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    return admin.password_hash == password_hash


# ============================================
# TOKEN MANAGER
# ============================================

_refresh_tokens: Dict[str, Dict] = {}
_token_blacklist: set = set()


class TokenManager:
    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.access_token_expire_minutes = 15
        self.refresh_token_expire_days = 7

    def create_access_token(self, data: Dict, expires_delta: Optional[timedelta] = None) -> str:
        if not JWT_AVAILABLE:
            raise RuntimeError("PyJWT is required. Install it: pip install PyJWT")
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=self.access_token_expire_minutes))
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, data: Dict) -> str:
        if not JWT_AVAILABLE:
            raise RuntimeError("PyJWT is required. Install it: pip install PyJWT")
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=self.refresh_token_expire_days)
        to_encode.update({"exp": expire, "type": "refresh"})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        _refresh_tokens[encoded_jwt] = {
            "username": data.get("username"),
            "created_at": datetime.utcnow(),
            "expires_at": expire
        }
        return encoded_jwt

    def verify_token(self, token: str, token_type: str = "access") -> Optional[Dict]:
        try:
            if token in _token_blacklist:
                return None
            if not JWT_AVAILABLE:
                raise RuntimeError("PyJWT is required.")
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            token_type_in_payload = payload.get("type")
            if token_type_in_payload is None:
                if token_type == "access":
                    return payload
                return None
            if token_type_in_payload != token_type:
                return None
            if token_type == "refresh" and token not in _refresh_tokens:
                return None
            return payload
        except jwt.ExpiredSignatureError:
            if token in _refresh_tokens:
                del _refresh_tokens[token]
            return None
        except jwt.InvalidTokenError:
            return None

    def revoke_token(self, token: str):
        _token_blacklist.add(token)
        if token in _refresh_tokens:
            del _refresh_tokens[token]


_token_manager: Optional[TokenManager] = None


def get_token_manager(secret_key: str) -> TokenManager:
    global _token_manager
    if _token_manager is None:
        _token_manager = TokenManager(secret_key)
    return _token_manager


# ============================================
# SECRETS MANAGER
# ============================================

async def get_or_create_secret(db: AsyncSession, key: str) -> str:
    settings = await get_settings(db)
    value = settings.get(key)
    if value:
        return str(value)
    env_value = os.getenv(key.upper())
    if env_value:
        await update_setting(db, key, env_value)
        return env_value
    generated = secrets.token_urlsafe(32)
    await update_setting(db, key, generated)
    return generated


async def get_admin_secret_key(db: AsyncSession) -> str:
    return await get_or_create_secret(db, "admin_secret_key")


# ============================================
# AUTH DEPENDENCY
# ============================================

security = HTTPBearer()


async def verify_token_dep(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_session)
):
    try:
        token = credentials.credentials
        secret_key = await get_admin_secret_key(db)
        tm = get_token_manager(secret_key)
        payload = tm.verify_token(token, token_type="access")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============================================
# RATE LIMITING
# ============================================

def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if SLOWAPI_AVAILABLE:
        return get_remote_address(request)
    return request.client.host if request.client else "127.0.0.1"


if SLOWAPI_AVAILABLE:
    limiter = Limiter(key_func=get_client_ip)

    def rate_limit_public():
        return limiter.limit("20/minute")

    def rate_limit_login():
        return limiter.limit("5/minute")
else:
    class _noop_decorator:
        def __call__(self, func):
            return func

    def rate_limit_public():
        return _noop_decorator()

    def rate_limit_login():
        return _noop_decorator()


# ============================================
# ADMIN LOG HELPER
# ============================================

async def log_action(db, request, admin_username, admin_id, action, entity_type, entity_name=None, entity_id=None, details=None):
    ip_address = request.client.host if request.client else "Unknown"
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    user_agent = request.headers.get("User-Agent", "")
    log = AdminLog(
        admin_id=admin_id,
        admin_username=admin_username,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        entity_name=entity_name,
        details=json.dumps(details) if details else None,
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else None,
        created_at=datetime.now()
    )
    db.add(log)
    await db.commit()


# ============================================
# VERIFICATION CODE STORAGE
# ============================================

_verification_codes: dict = {}


def generate_verification_code() -> str:
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


async def send_verification_code_to_telegram(bot_token: str, admin_tgid: int, code: str) -> bool:
    try:
        from aiogram import Bot
        from aiogram.enums import ParseMode
        message = (
            f"\U0001f510 <b>Код подтверждения</b>\n\n"
            f"Ваш код для завершения настройки админ-панели:\n\n"
            f"<code>{code}</code>\n\n"
            f"\u23f1 Код действителен 5 минут.\n"
            f"\u2757\ufe0f Никому не сообщайте этот код!"
        )
        bot = Bot(token=bot_token)
        try:
            await bot.send_message(chat_id=admin_tgid, text=message, parse_mode=ParseMode.HTML)
            return True
        finally:
            await bot.session.close()
    except Exception as e:
        logger.error(f"Error sending verification code: {e}")
        return False


async def send_admin_login_notification(username: str, ip_address: str, user_agent: str):
    try:
        from aiogram import Bot
        from aiogram.enums import ParseMode
        async with get_db_session() as db:
            bot_token = await get_setting(db, "bot_token")
            admin_tgid_str = await get_setting(db, "admin_tgid")
        if not bot_token or not admin_tgid_str:
            return
        admin_tgid = int(admin_tgid_str)
        browser = "Unknown"
        if user_agent:
            ua_lower = user_agent.lower()
            if "chrome" in ua_lower and "edg" not in ua_lower:
                browser = "Chrome"
            elif "firefox" in ua_lower:
                browser = "Firefox"
            elif "safari" in ua_lower and "chrome" not in ua_lower:
                browser = "Safari"
            elif "edg" in ua_lower:
                browser = "Edge"
        now = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        message = (
            f"\U0001f510 <b>Вход в админ-панель</b>\n\n"
            f"\U0001f464 Администратор: <b>{username}</b>\n"
            f"\U0001f310 IP: <code>{ip_address}</code>\n"
            f"\U0001f5a5 Браузер: {browser}\n"
            f"\U0001f550 Время: {now}"
        )
        bot = Bot(token=bot_token)
        try:
            await bot.send_message(chat_id=admin_tgid, text=message, parse_mode=ParseMode.HTML)
        finally:
            await bot.session.close()
    except Exception as e:
        logger.error(f"Error sending login notification: {e}")


# ============================================
# DATABASE INIT
# ============================================

async def init_db():
    from sqlalchemy import text
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"PostgreSQL connection error: {e}")
        return False

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("PostgreSQL tables created/verified")

    async with get_db_session() as session:
        # Subscription plans
        try:
            result = await session.execute(select(SubscriptionPlans))
            existing_plans = result.scalars().all()
            if not existing_plans:
                plans = [
                    SubscriptionPlans(plan_id='trial', name='Пробный', price=0, duration_days=14, active=True, created_at=datetime.now()),
                    SubscriptionPlans(plan_id='1month', name='1 месяц', price=150, duration_days=30, active=True, created_at=datetime.now()),
                    SubscriptionPlans(plan_id='3months', name='3 месяца', price=280, duration_days=90, active=True, created_at=datetime.now()),
                    SubscriptionPlans(plan_id='6months', name='6 месяцев', price=520, duration_days=180, active=True, created_at=datetime.now()),
                    SubscriptionPlans(plan_id='1year', name='1 год', price=950, duration_days=365, active=True, created_at=datetime.now()),
                ]
                for p in plans:
                    session.add(p)
                await session.commit()
        except Exception as e:
            logger.error(f"Error creating plans: {e}")
            await session.rollback()

        # Default settings
        try:
            result = await session.execute(select(Settings))
            existing_keys = {s.key for s in result.scalars().all()}
            defaults = {
                'device_limit': '0', 'bot_name': 'VPN',
                'default_language': 'ru', 'admin_id': '', 'bot_token': '',
                'telegram_stars_enabled': 'false', 'yoomoney_enabled': 'false',
                'yoomoney_token': '', 'yoomoney_wallet': '', 'yookassa_enabled': 'false',
                'yookassa_shop_id': '', 'yookassa_secret_key': '', 'cryptomus_enabled': 'false',
                'cryptomus_api_key': '', 'cryptomus_merchant_id': '', 'cryptobot_enabled': 'false',
                'cryptobot_token': '', 'referral_mode': 'days', 'referral_invite_bonus_days': '3',
                'referral_purchase_bonus_days': json.dumps({"1month": 14, "3months": 30, "6months": 60, "1year": 120}),
                'traffic_sync_interval': '5', 'admin_session_hours': '24',
                'referral_percent': '10', 'referral_min_withdrawal': '500',
                'freekassa_api_key': '',
                'hero_type': 'default', 'hero_sticker_url': '',
                'bg_gradient_dark': '', 'bg_gradient_light': '',
                'bg_header_dark': '', 'bg_header_light': '',
                'sticker_payment_url': '', 'sticker_setup_url': '',
            }
            added = 0
            for key, value in defaults.items():
                if key not in existing_keys:
                    session.add(Settings(key=key, value=value, updated_at=datetime.now()))
                    added += 1
            if added:
                await session.commit()
        except Exception as e:
            logger.error(f"Error creating settings: {e}")
            await session.rollback()

    # Load env settings into DB on first run
    async with get_db_session() as session:
        bot_token = await get_setting(session, "bot_token")
        if not bot_token:
            env_bot = os.getenv("BOT_TOKEN_SETUP")
            if env_bot:
                await update_setting(session, "bot_token", env_bot)
                logger.info("bot_token loaded from BOT_TOKEN_SETUP env")

        admin_tgid = await get_setting(session, "admin_tgid")
        if not admin_tgid:
            env_tgid = os.getenv("ADMIN_TGID_SETUP")
            if env_tgid:
                await update_setting(session, "admin_tgid", env_tgid)
                logger.info("admin_tgid loaded from ADMIN_TGID_SETUP env")

        setup_token = await get_setting(session, "setup_token")
        if not setup_token:
            env_setup = os.getenv("SETUP_TOKEN")
            if env_setup:
                await update_setting(session, "setup_token", env_setup)
                logger.info("setup_token loaded from SETUP_TOKEN env")

        # Admin secret key
        await get_admin_secret_key(session)

    return True


# ============================================
# APP LIFESPAN
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application...")
    await init_db()
    logger.info("Application started successfully")
    yield
    logger.info("Application shutting down...")


# ============================================
# FASTAPI APP
# ============================================

app = FastAPI(title="VPN Telegram Mini App", lifespan=lifespan)

# CORS
domain = os.getenv("DOMAIN", "localhost")
cors_origins_env = os.getenv("CORS_ORIGINS", f"https://{domain}")
cors_origins = [o.strip() for o in cors_origins_env.split(",")]
cors_origins.extend(["http://localhost:3001", "http://localhost:5174", "http://localhost:8001"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Rate limiting
if SLOWAPI_AVAILABLE:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ============================================
# PYDANTIC SCHEMAS
# ============================================

class LoginRequest(BaseModel):
    username: str
    password: str


class SetupStatusResponse(BaseModel):
    setup_required: bool
    setup_token_required: bool
    bot_configured: bool
    admin_tgid_configured: bool


class VerifySetupTokenRequest(BaseModel):
    setup_token: str


class RegisterCredentialsRequest(BaseModel):
    setup_token: str
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)


class VerifyCodeRequest(BaseModel):
    setup_token: str
    code: str = Field(..., min_length=6, max_length=6)


# ============================================
# HEALTH
# ============================================

@app.get("/health")
async def health():
    return {"status": "ok"}


# ============================================
# WEBSOCKET ENDPOINT (stub - sends empty state)
# ============================================

async def verify_ws_token(token: str) -> Optional[Dict]:
    """Verify JWT token for WebSocket connections."""
    try:
        async with get_db_session() as db:
            secret_key = await get_admin_secret_key(db)
            tm = get_token_manager(secret_key)
            payload = tm.verify_token(token, token_type="access")
            return payload
    except Exception:
        return None


@app.websocket("/ws/admin/servers")
async def websocket_servers(websocket: WebSocket, token: str = Query(default="")):
    # Verify token
    payload = await verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    logger.info(f"WebSocket connected: {payload.get('username')}")

    try:
        # Send initial empty state
        await websocket.send_json({
            "type": "initial_state",
            "data": {
                "servers": [],
                "active_connections": {},
                "app_online": {
                    "count": 0,
                    "user_ids": []
                }
            },
            "timestamp": datetime.utcnow().isoformat()
        })

        # Keep connection alive with periodic pings
        while True:
            try:
                # Wait for messages from client (ping/pong, metric requests, etc.)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    msg = json.loads(data)
                    msg_type = msg.get("type", "")
                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
                    elif msg_type == "request_metrics":
                        # Send empty metrics response
                        await websocket.send_json({
                            "type": "metrics",
                            "server_id": msg.get("server_id"),
                            "data": {},
                            "timestamp": datetime.utcnow().isoformat()
                        })
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                # Send keepalive ping
                try:
                    await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {payload.get('username')}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")


# ============================================
# SETUP ROUTES (REAL)
# ============================================

@app.get("/api/setup/status", response_model=SetupStatusResponse)
async def get_setup_status(db: AsyncSession = Depends(get_session)):
    try:
        setup_completed = await get_setting(db, "setup_completed")
        if setup_completed == "true":
            return SetupStatusResponse(
                setup_required=False, setup_token_required=False,
                bot_configured=True, admin_tgid_configured=True
            )
        setup_token = await get_setting(db, "setup_token")
        bot_token = await get_setting(db, "bot_token")
        admin_tgid = await get_setting(db, "admin_tgid")
        return SetupStatusResponse(
            setup_required=True, setup_token_required=bool(setup_token),
            bot_configured=bool(bot_token), admin_tgid_configured=bool(admin_tgid)
        )
    except Exception as e:
        logger.error(f"Error getting setup status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/setup/verify-token")
@rate_limit_public()
async def verify_setup_token(request: Request, data: VerifySetupTokenRequest, db: AsyncSession = Depends(get_session)):
    try:
        setup_completed = await get_setting(db, "setup_completed")
        if setup_completed == "true":
            raise HTTPException(status_code=400, detail="Setup already completed")
        stored_token = await get_setting(db, "setup_token")
        if not stored_token:
            raise HTTPException(status_code=400, detail="Setup token not configured")
        if data.setup_token.strip().lower() != stored_token.strip().lower():
            logger.warning(f"Invalid setup token attempt from {request.client.host}")
            raise HTTPException(status_code=401, detail="Invalid setup token")
        return {"valid": True, "message": "Setup token verified"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying setup token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/setup/register")
@rate_limit_public()
async def register_credentials(request: Request, data: RegisterCredentialsRequest, db: AsyncSession = Depends(get_session)):
    try:
        stored_token = await get_setting(db, "setup_token")
        if not stored_token or data.setup_token.strip().lower() != stored_token.strip().lower():
            raise HTTPException(status_code=401, detail="Invalid setup token")
        setup_completed = await get_setting(db, "setup_completed")
        if setup_completed == "true":
            raise HTTPException(status_code=400, detail="Setup already completed")
        bot_token = await get_setting(db, "bot_token")
        admin_tgid_str = await get_setting(db, "admin_tgid")
        if not bot_token or not admin_tgid_str:
            raise HTTPException(status_code=400, detail="Bot token or admin Telegram ID not configured. Check your deployment settings.")
        try:
            admin_tgid = int(admin_tgid_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid admin Telegram ID format")
        existing_admin = await get_admin_by_username(db, data.username)
        if existing_admin:
            raise HTTPException(status_code=400, detail="Username already exists")
        code = generate_verification_code()
        pw_hash = hash_password(data.password)
        _verification_codes[admin_tgid] = {
            "code": code,
            "expires": datetime.now() + timedelta(minutes=5),
            "username": data.username,
            "password_hash": pw_hash
        }
        sent = await send_verification_code_to_telegram(bot_token, admin_tgid, code)
        if not sent:
            raise HTTPException(status_code=500, detail="Failed to send verification code. Check bot token and admin Telegram ID.")
        tgid_str = str(admin_tgid)
        masked_tgid = tgid_str[:3] + "***" + tgid_str[-3:] if len(tgid_str) > 6 else "***"
        return {"success": True, "message": "Verification code sent", "masked_tgid": masked_tgid}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in register: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/setup/verify-code")
@rate_limit_public()
async def verify_code(request: Request, data: VerifyCodeRequest, db: AsyncSession = Depends(get_session)):
    try:
        stored_token = await get_setting(db, "setup_token")
        if not stored_token or data.setup_token.strip().lower() != stored_token.strip().lower():
            raise HTTPException(status_code=401, detail="Invalid setup token")
        admin_tgid_str = await get_setting(db, "admin_tgid")
        if not admin_tgid_str:
            raise HTTPException(status_code=400, detail="Admin Telegram ID not configured")
        admin_tgid = int(admin_tgid_str)
        verification_data = _verification_codes.get(admin_tgid)
        if not verification_data:
            raise HTTPException(status_code=400, detail="No pending verification. Please register first.")
        if datetime.now() > verification_data["expires"]:
            del _verification_codes[admin_tgid]
            raise HTTPException(status_code=400, detail="Verification code expired. Please try again.")
        if data.code != verification_data["code"]:
            raise HTTPException(status_code=401, detail="Invalid verification code")
        username = verification_data["username"]
        password_hash = verification_data["password_hash"]
        existing_admin = await get_admin_by_username(db, username)
        if existing_admin:
            raise HTTPException(status_code=400, detail="Admin already exists")
        admin = Admins(username=username, password_hash=password_hash, role="admin", active=True)
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        await update_setting(db, "setup_completed", "true")
        await update_setting(db, "setup_token", "")
        del _verification_codes[admin_tgid]
        try:
            bot_token = await get_setting(db, "bot_token")
            from aiogram import Bot
            from aiogram.enums import ParseMode
            bot = Bot(token=bot_token)
            try:
                await bot.send_message(
                    chat_id=admin_tgid,
                    text=(
                        f"\u2705 <b>Настройка завершена!</b>\n\n"
                        f"Админ-панель готова к использованию.\n"
                        f"Логин: <code>{username}</code>\n\n"
                        f"\u26a0\ufe0f Не забудьте сохранить пароль!"
                    ),
                    parse_mode=ParseMode.HTML
                )
            finally:
                await bot.session.close()
        except Exception:
            pass
        return {"success": True, "message": "Setup completed successfully", "username": username}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/setup/resend-code")
@rate_limit_public()
async def resend_code(request: Request, data: VerifySetupTokenRequest, db: AsyncSession = Depends(get_session)):
    try:
        stored_token = await get_setting(db, "setup_token")
        if not stored_token or data.setup_token.strip().lower() != stored_token.strip().lower():
            raise HTTPException(status_code=401, detail="Invalid setup token")
        bot_token = await get_setting(db, "bot_token")
        admin_tgid_str = await get_setting(db, "admin_tgid")
        if not bot_token or not admin_tgid_str:
            raise HTTPException(status_code=400, detail="Bot not configured")
        admin_tgid = int(admin_tgid_str)
        verification_data = _verification_codes.get(admin_tgid)
        if not verification_data:
            raise HTTPException(status_code=400, detail="No pending verification. Please register first.")
        code = generate_verification_code()
        verification_data["code"] = code
        verification_data["expires"] = datetime.now() + timedelta(minutes=5)
        sent = await send_verification_code_to_telegram(bot_token, admin_tgid, code)
        if not sent:
            raise HTTPException(status_code=500, detail="Failed to send verification code")
        return {"success": True, "message": "Verification code resent"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resending code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================
# AUTH ROUTES (REAL)
# ============================================

@app.post("/api/login")
@rate_limit_login()
async def login(request: Request, credentials: LoginRequest, db: AsyncSession = Depends(get_session)):
    is_valid = await verify_admin(db, credentials.username, credentials.password)
    if is_valid:
        secret_key = await get_admin_secret_key(db)
        tm = get_token_manager(secret_key)
        admin = await get_admin_by_username(db, credentials.username)
        admin_role = admin.role if admin else 'admin'
        session_hours_str = await get_setting(db, "admin_session_hours")
        session_hours = int(session_hours_str) if session_hours_str else 24
        access_token = tm.create_access_token(
            data={"username": credentials.username, "admin_id": admin.id if admin else None, "role": admin_role},
            expires_delta=timedelta(hours=session_hours)
        )
        refresh_token = tm.create_refresh_token(
            data={"username": credentials.username, "admin_id": admin.id if admin else None, "role": admin_role}
        )
        ip_address = request.client.host if request.client else "Unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip_address = forwarded_for.split(",")[0].strip()
        user_agent = request.headers.get("User-Agent", "")
        await log_action(db=db, request=request, admin_username=credentials.username,
                         admin_id=admin.id if admin else None, action="login",
                         entity_type="admin", entity_name=credentials.username)
        asyncio.create_task(send_admin_login_notification(credentials.username, ip_address, user_agent))
        return {
            "token": access_token, "access_token": access_token,
            "refresh_token": refresh_token, "token_type": "bearer",
            "username": credentials.username, "role": admin_role
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/api/refresh")
@rate_limit_public()
async def refresh_token_endpoint(request: Request, db: AsyncSession = Depends(get_session)):
    try:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            refresh_token = auth_header.split(" ")[1]
        else:
            try:
                body = await request.json()
                refresh_token = body.get("refresh_token")
            except:
                refresh_token = None
        if not refresh_token:
            raise HTTPException(status_code=401, detail="Refresh token required")
        secret_key = await get_admin_secret_key(db)
        tm = get_token_manager(secret_key)
        payload = tm.verify_token(refresh_token, token_type="refresh")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        username = payload.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        admin = await get_admin_by_username(db, username)
        admin_role = admin.role if admin else payload.get("role", "admin")
        admin_id = admin.id if admin else payload.get("admin_id")
        session_hours_str = await get_setting(db, "admin_session_hours")
        session_hours = int(session_hours_str) if session_hours_str else 24
        new_access_token = tm.create_access_token(
            data={"username": username, "admin_id": admin_id, "role": admin_role},
            expires_delta=timedelta(hours=session_hours)
        )
        return {"access_token": new_access_token, "token_type": "bearer", "role": admin_role}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/logout")
async def logout_endpoint(request: Request, db: AsyncSession = Depends(get_session)):
    try:
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        secret_key = await get_admin_secret_key(db)
        tm = get_token_manager(secret_key)
        if token:
            tm.revoke_token(token)
        try:
            body = await request.json()
            rt = body.get("refresh_token")
            if rt:
                tm.revoke_token(rt)
        except:
            pass
        return {"message": "Logged out successfully"}
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================
# STUB ADMIN ENDPOINTS (return empty data)
# ============================================

# --- Stats ---
@app.get("/api/stats")
async def get_stats(payload: dict = Depends(verify_token_dep)):
    return {"total_users": 0, "active_users": 0, "total_keys": 0, "active_keys": 0, "total_payments": 0, "monthly_revenue": 0}

@app.get("/api/stats/users")
async def get_stats_users(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "active": 0, "inactive": 0, "pending": 0}

@app.get("/api/stats/keys")
async def get_stats_keys(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "active": 0, "expired": 0, "created_today": 0}

@app.get("/api/stats/payments")
async def get_stats_payments(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "successful": 0, "pending": 0, "failed": 0, "monthly_revenue": 0}

@app.get("/api/stats/promocodes")
async def get_stats_promos(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "active": 0, "total_uses": 0, "avg_percent": 0, "total_discount_given": 0}

@app.get("/api/stats/withdrawals")
async def get_stats_withdrawals(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "pending": 0, "paid_total": 0, "paid_monthly": 0}

# --- Dashboard ---
@app.get("/api/dashboard")
async def get_dashboard(payload: dict = Depends(verify_token_dep)):
    return {
        "users": {"total": 0, "active": 0, "inactive": 0, "new_today": 0, "new_week": 0},
        "keys": {"total": 0, "active": 0, "expired": 0, "created_today": 0},
        "payments": {"total": 0, "successful": 0, "pending": 0, "failed": 0, "monthly_revenue": 0, "today_revenue": 0},
        "servers": {"total": 0, "online": 0, "offline": 0},
        "revenue_chart": [],
        "recent_payments": [],
        "period": "month"
    }

@app.get("/api/analytics")
async def get_analytics(payload: dict = Depends(verify_token_dep)):
    return {"total_users": 0, "paying_users": 0, "trial_users": 0, "revenue_7d": 0, "revenue_30d": 0, "arpu": 0, "ltv": 0}

# --- Users ---
@app.get("/api/users")
async def get_users(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/users/with-subscription")
async def get_users_with_sub(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/users/without-subscription")
async def get_users_without_sub(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/users/{user_id}")
async def get_user(user_id: str, payload: dict = Depends(verify_token_dep)):
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/api/users/by-tgid/{tgid}")
async def get_user_by_tgid(tgid: int, payload: dict = Depends(verify_token_dep)):
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/api/users/export/{export_type}")
async def export_users(export_type: str, payload: dict = Depends(verify_token_dep)):
    raise HTTPException(status_code=404, detail="No data to export")

# --- Locations & Servers ---
@app.get("/api/locations")
async def get_locations(payload: dict = Depends(verify_token_dep)):
    return []

@app.post("/api/locations")
async def create_location(request: Request, payload: dict = Depends(verify_token_dep)):
    return {"id": 0, "message": "Location created"}

@app.get("/api/countries")
async def get_countries(payload: dict = Depends(verify_token_dep)):
    return {"countries": []}

@app.get("/api/servers")
async def get_servers(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/servers/problematic")
async def get_problematic_servers(payload: dict = Depends(verify_token_dep)):
    return {"offline_agents": [], "offline_servers": [], "degraded_servers": []}

@app.get("/api/servers/ranking")
async def get_server_ranking(payload: dict = Depends(verify_token_dep)):
    return []

# --- Keys ---
@app.get("/api/keys")
async def get_keys(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/subscription-paths")
async def get_subscription_paths(payload: dict = Depends(verify_token_dep)):
    return {"premium": [], "trial": []}

# --- Payments ---
@app.get("/api/payments")
async def get_payments(payload: dict = Depends(verify_token_dep)):
    return []

# --- Promocodes ---
@app.get("/api/promocodes")
async def get_promocodes(payload: dict = Depends(verify_token_dep)):
    return []

# --- Referrals ---
@app.get("/api/referrals")
async def get_referrals(payload: dict = Depends(verify_token_dep)):
    return []

# --- Tracking ---
@app.get("/api/tracking")
async def get_tracking(payload: dict = Depends(verify_token_dep)):
    return []

# --- Broadcasts ---
@app.get("/api/broadcasts")
async def get_broadcasts(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/broadcasts/stats")
async def get_broadcast_stats(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "sent": 0, "scheduled": 0}

# --- Support ---
@app.get("/api/support/conversations")
async def get_support_conversations(payload: dict = Depends(verify_token_dep)):
    return []

@app.get("/api/support/unread-count")
async def get_unread_count(payload: dict = Depends(verify_token_dep)):
    return {"count": 0}

# --- Withdrawals ---
@app.get("/api/withdrawals")
async def get_withdrawals(payload: dict = Depends(verify_token_dep)):
    return []

# --- Settings ---
@app.get("/api/settings")
async def get_settings_endpoint(payload: dict = Depends(verify_token_dep), db: AsyncSession = Depends(get_session)):
    settings = await get_settings(db)
    # Mask sensitive values
    masked = dict(settings)
    for key in ['bot_token', 'yoomoney_token', 'yookassa_secret_key', 'cryptobot_token',
                'cryptomus_api_key', 'admin_secret_key', 'encryption_key', 'freekassa_api_key']:
        if key in masked and masked[key]:
            val = str(masked[key])
            if len(val) > 8:
                masked[key] = val[:4] + "***" + val[-4:]
    return masked

@app.post("/api/settings")
async def update_settings_endpoint(request: Request, payload: dict = Depends(verify_token_dep), db: AsyncSession = Depends(get_session)):
    body = await request.json()
    for key, value in body.items():
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        elif isinstance(value, bool):
            value = json.dumps(value)
        elif value is None:
            value = ''
        else:
            value = str(value)
        await update_setting(db, key, value)
    return await get_settings(db)

# --- Plans ---
@app.get("/api/plans")
async def get_plans(payload: dict = Depends(verify_token_dep), db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(SubscriptionPlans))
    plans = result.scalars().all()
    return [{"id": p.id, "plan_id": p.plan_id, "name": p.name, "price": float(p.price),
             "duration_days": p.duration_days, "active": p.active, "device_limit": p.device_limit} for p in plans]

@app.post("/api/plans")
async def update_plans(request: Request, payload: dict = Depends(verify_token_dep), db: AsyncSession = Depends(get_session)):
    body = await request.json()
    for plan_data in body:
        plan_id = plan_data.get("plan_id")
        if plan_id:
            result = await db.execute(select(SubscriptionPlans).filter(SubscriptionPlans.plan_id == plan_id))
            plan = result.scalar_one_or_none()
            if plan:
                if "price" in plan_data:
                    plan.price = plan_data["price"]
                if "name" in plan_data:
                    plan.name = plan_data["name"]
                if "duration_days" in plan_data:
                    plan.duration_days = plan_data["duration_days"]
                if "active" in plan_data:
                    plan.active = plan_data["active"]
                if "device_limit" in plan_data:
                    plan.device_limit = plan_data["device_limit"]
    await db.commit()
    return {"message": "Plans updated", "updated": len(body)}

# --- Admin Info ---
@app.get("/api/admins/me")
async def get_current_admin(payload: dict = Depends(verify_token_dep)):
    return {"username": payload.get("username"), "role": payload.get("role", "admin")}

# --- Admin Logs ---
@app.get("/api/admin-logs")
async def get_admin_logs(payload: dict = Depends(verify_token_dep), db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(AdminLog).order_by(AdminLog.created_at.desc()).limit(50))
    logs = result.scalars().all()
    return [{
        "id": l.id, "admin_id": l.admin_id, "admin_username": l.admin_username,
        "action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id,
        "entity_name": l.entity_name, "details": l.details,
        "ip_address": l.ip_address, "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in logs]

@app.get("/api/admin-logs/filters")
async def get_admin_log_filters(payload: dict = Depends(verify_token_dep)):
    return {"admins": [], "actions": ["login"], "entity_types": ["admin"]}

@app.get("/api/admin-logs/stats")
async def get_admin_log_stats(payload: dict = Depends(verify_token_dep)):
    return {"total": 0, "today": 0, "week": 0}

# --- Webhooks ---
@app.get("/api/webhooks/status")
async def get_webhooks_status(payload: dict = Depends(verify_token_dep)):
    return {"configured": False, "webhooks": []}

@app.post("/api/webhooks/configure")
async def configure_webhooks(request: Request, payload: dict = Depends(verify_token_dep)):
    return {"status": "ok", "message": "Webhooks configured"}

# --- Database ---
@app.get("/api/database/status")
async def get_database_status(payload: dict = Depends(verify_token_dep)):
    return {"connected": True, "type": "postgresql", "version": "15"}

# --- Payment Systems ---
@app.get("/api/payment-systems/info")
async def get_payment_systems_info(payload: dict = Depends(verify_token_dep)):
    return {}

# --- Subscription Domain ---
@app.get("/api/admin/settings/subscription-domain/status")
async def get_sub_domain_status(payload: dict = Depends(verify_token_dep)):
    return {"configured": False, "domain": None}

# --- Health Check Trigger ---
@app.post("/api/health-check/trigger")
async def trigger_health_check(payload: dict = Depends(verify_token_dep)):
    return {"status": "ok", "message": "Health check triggered"}

# --- Notifications Test ---
@app.post("/api/notifications/test")
async def test_notification(payload: dict = Depends(verify_token_dep)):
    return {"success": True, "message": "Test notification sent"}

# --- Keys Cleanup ---
@app.post("/api/keys/cleanup/trigger")
async def trigger_keys_cleanup(payload: dict = Depends(verify_token_dep)):
    return {"status": "ok", "message": "Keys cleanup triggered"}

# --- Servers sync ---
@app.post("/api/servers/sync-capacity")
async def sync_capacity(payload: dict = Depends(verify_token_dep)):
    return {"status": "ok", "message": "Capacity synced"}

# --- Catch-all for any unhandled admin API routes ---
@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all(path: str, request: Request):
    # Check if auth is present
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if request.method == "GET":
        return []
    return {"status": "ok"}
