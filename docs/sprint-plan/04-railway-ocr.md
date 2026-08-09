> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 4 — Railway backend v1 + the OCR pipeline

**Sprint goal** — stand up the Python compute tier properly (FastAPI, signed tickets, job queue, quotas, kill-switch, hardening, observability), proven by shipping one real server-backed tool.
**Duration** — 2 weeks. **Depends on** — Sprint 1 (registry, ToolShell). Per the Part II review, schedule this **after Gate 2**, not before.

### Part A — Platform

**Scope:** everything that has to exist before a single tool can offload work to Python. No tool logic here — Part B builds the tools on top of this.
**Total: 23.5h** across RWY-01 … RWY-13.

Two decisions made up front, because six tickets depend on them:

**Monorepo folder, not a separate repo.** The HMAC ticket contract (payload shape, audience names, error codes) spans TypeScript and Python, and in a solo repo a single commit changing both sides is the only thing preventing schema skew during a deploy. Railway's *Root Directory* + *Watch Paths* settings already give the Python service an independent build and deploy trigger, so the second repo buys nothing but a coordination tax.

**One Railway service running both the API and the worker.** The API writes the uploaded file to disk and the worker reads it — on Railway those are different containers with different filesystems, and Railway volumes attach to exactly one service. The choices are object storage (Cloudflare R2) or colocation; for v1 traffic, colocation via a `Procfile` costs one service instead of three and eliminates an entire failure mode. When the OCR worker starts starving the API, the fix is R2 + service split, not a rewrite — the handler already reads and writes through a `scratch_path()` helper.

---

### [RWY-01] Service layout, dependencies, and hardened Dockerfile
**Estimate:** 3h · **Depends on:** — · **Files:** `services/compute/pyproject.toml`, `services/compute/Dockerfile`, `services/compute/Procfile`, `services/compute/docker-compose.yml`, `services/compute/.dockerignore`

**Why.** `ocrmypdf` is not a Python library you `pip install` and forget — it is a driver for five C programs, and if any one of them is missing the failure surfaces at runtime, inside a job, as an unhelpful `MissingDependencyError`. Building the exact apt set into a pinned image is the difference between "OCR works" and "OCR works on my Mac". The hardening in this ticket (non-root, no shell for the app user, capabilities dropped, a single writable directory) is the containment boundary for RWY-09 — every mitigation there assumes a compromised Ghostscript can only write to `/scratch`.

**Implementation**

`services/compute/pyproject.toml`

```toml
[project]
name = "compute"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "pydantic>=2.9.0",
  "pydantic-settings>=2.6.0",
  "python-multipart>=0.0.12",
  "redis>=5.2.0",
  "arq>=0.26.0",
  "httpx>=0.27.0",
  "orjson>=3.10.0",
  "prometheus-client>=0.21.0",
  "honcho>=2.0.0",
  # PDF work. pikepdf is MPL-2.0 and wraps qpdf (Apache-2.0).
  # PyMuPDF is deliberately absent: AGPL, and we ship a hosted commercial-ish service.
  "ocrmypdf>=16.5.0",
  "pikepdf>=9.4.0",
  "pillow>=11.0.0",
]

[dependency-groups]
dev = ["pytest>=8.3.0", "pytest-asyncio>=0.24.0", "ruff>=0.7.0", "mypy>=1.13.0"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.mypy]
strict = true
plugins = []
```

`services/compute/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7

########## builder ##########
FROM python:3.12-slim-bookworm AS builder

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /build

# Dependency layer first so app edits don't invalidate the wheel cache.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY app ./app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

########## runtime ##########
FROM python:3.12-slim-bookworm AS runtime

# The apt set ocrmypdf actually requires, plus the optional ones it will
# silently skip (and quietly produce worse output) if they are absent:
#   tesseract-ocr        OCR engine (Apache-2.0)
#   tesseract-ocr-sin    Sinhala traineddata
#   tesseract-ocr-tam    Tamil traineddata
#   tesseract-ocr-eng    English (NOT pulled in automatically by tesseract-ocr)
#   ghostscript          PDF/A production + rasterisation (AGPL; fine hosted)
#   qpdf                 linearisation/repair, and the lib pikepdf links against
#   unpaper              optional --clean / --clean-final deskew+despeckle
#   pngquant             optional lossy PNG recompression of image layers
# jbig2enc is NOT in Debian; we do not use --jbig2-lossy.
RUN apt-get update && apt-get install --no-install-recommends -y \
      tesseract-ocr \
      tesseract-ocr-eng \
      tesseract-ocr-sin \
      tesseract-ocr-tam \
      ghostscript \
      qpdf \
      unpaper \
      pngquant \
      libjpeg62-turbo \
      zlib1g \
      tini \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Non-root, no login shell, no home directory to write into.
RUN groupadd --gid 10001 compute \
 && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin compute

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata \
    SCRATCH_DIR=/scratch \
    TMPDIR=/scratch \
    MPLCONFIGDIR=/scratch \
    OMP_THREAD_LIMIT=1

COPY --from=builder /opt/venv /opt/venv
WORKDIR /srv
COPY --chown=root:root app ./app
COPY --chown=root:root Procfile ./Procfile

# Application code is root-owned and read-only to the runtime user.
RUN chmod -R a-w /srv /opt/venv

# The ONLY writable path. 0700, owned by the app user.
RUN install -d -o 10001 -g 10001 -m 0700 /scratch
VOLUME ["/scratch"]

USER 10001:10001
EXPOSE 8080

# tini reaps the zombie ghostscript/tesseract children honcho's kids leave behind.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["honcho", "-f", "/srv/Procfile", "start"]
```

`services/compute/Procfile`

```procfile
api: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2 --no-server-header --timeout-keep-alive 15
worker: arq app.jobs.worker.WorkerSettings
```

honcho propagates SIGTERM to both and exits when either dies, so a crashed worker restarts the whole container rather than leaving a live API with a dead queue.

`services/compute/docker-compose.yml` (local dev — and the place the *real* kernel-level hardening is expressed, see the caveat below)

```yaml
services:
  redis:
    image: redis:7.4-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no", "--maxmemory", "256mb", "--maxmemory-policy", "noeviction"]
    ports: ["6379:6379"]

  compute:
    build: .
    read_only: true                 # rootfs immutable
    tmpfs:
      - /scratch:rw,noexec,nosuid,nodev,size=512m,mode=0700,uid=10001,gid=10001
    cap_drop: ["ALL"]
    security_opt: ["no-new-privileges:true"]
    pids_limit: 256
    mem_limit: 2g
    cpus: 2.0
    environment:
      REDIS_URL: redis://redis:6379/0
      TICKET_SECRET: dev-secret-not-for-prod
      ENVIRONMENT: development
    ports: ["8080:8080"]
    depends_on: [redis]
```

**Honest caveat, and the mitigation.** Railway does not let you pass `--read-only`, `--tmpfs`, `--cap-drop`, or `--pids-limit`; it runs the image with its own defaults and a writable ephemeral rootfs. So in production those four lines are aspirational. What actually survives the trip to Railway is: UID 10001 with no shell, `chmod -R a-w /srv /opt/venv` (so even a code-execution bug cannot rewrite the app), `/scratch` as the only 0700-owned directory, and `TMPDIR=/scratch` so every library's temp file lands inside the one directory the reaper (RWY-10) sweeps. Add a startup assertion so drift is loud rather than silent:

```python
# app/hardening.py
import os, stat
from pathlib import Path

def assert_runtime_hardening() -> None:
    if os.geteuid() == 0:
        raise RuntimeError("refusing to start as root")
    srv = Path("/srv")
    if srv.exists() and os.access(srv, os.W_OK):
        raise RuntimeError("/srv is writable by the runtime user")
    scratch = Path(os.environ.get("SCRATCH_DIR", "/scratch"))
    scratch.mkdir(parents=True, exist_ok=True)
    mode = stat.S_IMODE(scratch.stat().st_mode)
    if mode & 0o077:
        raise RuntimeError(f"{scratch} mode is {mode:o}, expected 0700")
```

**Acceptance criteria**
- [ ] `docker build` produces an image under 1.2 GB and `docker run --rm IMG ocrmypdf --version` prints a version.
- [ ] `docker run --rm IMG tesseract --list-langs` lists `eng`, `sin`, and `tam`.
- [ ] `docker run --rm IMG id` prints `uid=10001`, and `docker run --rm IMG sh -c 'touch /srv/x'` fails.
- [ ] `docker compose up` runs with `read_only: true` and no process writes outside `/scratch`.
- [ ] `assert_runtime_hardening()` raises if the container is started as root.
- [ ] `uv.lock` is committed; the build uses `--frozen` and fails on lockfile drift.

---

### [RWY-02] FastAPI skeleton, typed settings, and liveness vs readiness
**Estimate:** 1.5h · **Depends on:** RWY-01 · **Files:** `services/compute/app/config.py`, `app/redis.py`, `app/errors.py`, `app/main.py`, `app/routers/health.py`

**Why.** The single most common way a small Python service on a PaaS goes down and *stays* down is conflating liveness with readiness. If `/healthz` pings Redis and Railway is configured to restart on health-check failure, then a 30-second Redis blip kills a container that was otherwise fine, and if Redis is properly down you get a restart loop that keeps the container cold forever. Liveness answers "is this process wedged" and must depend on nothing. Readiness answers "should traffic reach me" and must fail while Redis is down, because without Redis we cannot burn a jti and every request would be replayable.

**Implementation**

```python
# app/config.py
from functools import lru_cache
from pydantic import Field, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="forbid", frozen=True)

    environment: str = "production"
    port: int = 8080

    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")
    scratch_dir: str = "/scratch"

    # --- ticket auth (RWY-04/05) ---
    ticket_secret: str
    ticket_clock_skew_seconds: int = 30
    ticket_max_ttl_seconds: int = 180

    # --- origin lock (RWY-12) ---
    allowed_origins: list[str] = ["https://kavithakanchana.me"]
    origin_shared_token: str | None = None

    # --- limits ---
    max_upload_bytes: int = 25 * 1024 * 1024
    subprocess_timeout_seconds: int = 120
    job_deadline_seconds: int = 300

    # --- quotas / spend (RWY-08) ---
    daily_jobs_per_ip: int = 20
    daily_spend_cap_usd: float = 3.0
    rate_usd_per_vcpu_second: float = 0.0000129
    rate_usd_per_gb_second: float = 0.0000077
    assumed_vcpu: float = 1.0
    assumed_gb: float = 1.0

    # --- retention (RWY-09) ---
    output_retention_seconds: int = 900  # 15 minutes, stated on every tool page

    # --- observability (RWY-10) ---
    metrics_token: str | None = None
    log_level: str = "INFO"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

```python
# app/redis.py
from arq import create_pool
from arq.connections import ArqRedis, RedisSettings
from app.config import get_settings

_pool: ArqRedis | None = None


async def init_redis() -> ArqRedis:
    """arq's pool IS a redis.asyncio.Redis subclass, so one pool serves the
    queue, the jti burns, the quota counters and the job records."""
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(str(get_settings().redis_url)))
    return _pool


def redis() -> ArqRedis:
    if _pool is None:
        raise RuntimeError("redis pool not initialised")
    return _pool


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
```

```python
# app/errors.py
from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, code: str, message: str, status: int = 400,
                 extra: dict | None = None) -> None:
        self.code, self.message, self.status = code, message, status
        self.extra = extra or {}
        super().__init__(f"{code}: {message}")


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"error": {"code": exc.code, "message": exc.message, **exc.extra}},
    )
```

```python
# app/routers/health.py
from fastapi import APIRouter, Response
from redis.exceptions import RedisError
from app.redis import redis

router = APIRouter(tags=["health"])


@router.get("/healthz", include_in_schema=False)
async def healthz() -> dict[str, str]:
    """Liveness. Touches NOTHING external. If this fails the process is wedged
    and restarting is the correct response."""
    return {"status": "ok"}


@router.get("/readyz", include_in_schema=False)
async def readyz(response: Response) -> dict[str, object]:
    """Readiness. MUST fail while Redis is down: without Redis we cannot burn a
    jti, so every ticket becomes infinitely replayable. Serving traffic in that
    state is worse than serving none."""
    checks: dict[str, bool] = {}
    try:
        await redis().ping()
        checks["redis"] = True
    except (RedisError, RuntimeError, OSError):
        checks["redis"] = False

    ok = all(checks.values())
    response.status_code = 200 if ok else 503
    return {"status": "ready" if ok else "not_ready", "checks": checks}
```

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import ApiError, api_error_handler
from app.hardening import assert_runtime_hardening
from app.logging import RequestContextMiddleware, configure_logging
from app.redis import close_redis, init_redis
from app.routers import health, jobs, metrics
from app.uploads.middleware import MaxBodySizeMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    assert_runtime_hardening()
    configure_logging(settings.log_level)
    await init_redis()
    yield
    await close_redis()


app = FastAPI(
    title="compute",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(MaxBodySizeMiddleware, max_bytes=settings.max_upload_bytes)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,     # exact origins, never "*"
    allow_credentials=False,                    # we authenticate with a ticket, not cookies
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Compute-Ticket"],
    max_age=600,
)
app.add_exception_handler(ApiError, api_error_handler)

app.include_router(health.router)
app.include_router(jobs.router)
app.include_router(metrics.router)
```

**Acceptance criteria**
- [ ] `/healthz` returns 200 with Redis stopped; `/readyz` returns 503 with `{"checks":{"redis":false}}`.
- [ ] Railway health-check path is set to `/healthz`, not `/readyz`.
- [ ] Missing `TICKET_SECRET` makes the process exit at import with a pydantic validation error, not at first request.
- [ ] `extra="forbid"` means a typo'd env var fails the boot loudly.
- [ ] `/docs` and `/openapi.json` are 404 when `ENVIRONMENT=production`.
- [ ] A cross-origin `fetch` from `https://evil.test` is blocked by CORS preflight.

---

### [RWY-03] Turnstile server-side verification before anything expensive
**Estimate:** 1h · **Depends on:** — · **Files:** `src/lib/tools/turnstile.ts`, `src/components/tools/turnstile-gate.tsx`

**Why.** The Turnstile widget on the client is decoration. The only thing that matters is `siteverify`: an attacker scripting the endpoint never renders the widget at all, so if we do not call Cloudflare from the server before minting a ticket, we have shipped a client-side check — which is to say, none. Gating at *ticket mint* rather than at the compute endpoint means the expensive service never sees an unverified request, and Cloudflare's `idempotency`/single-use token semantics line up exactly with our single-use ticket.

**Implementation**

```ts
// src/lib/tools/turnstile.ts
// Runs on the Vercel edge runtime. No Node APIs.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true }
  | { ok: false; code: 'turnstile_missing' | 'turnstile_failed' | 'turnstile_unavailable' };

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
}

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp: string | undefined,
  expectedAction: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Fail CLOSED in production. A missing secret must not silently disable the gate.
    return process.env.VERCEL_ENV === 'production'
      ? { ok: false, code: 'turnstile_unavailable' }
      : { ok: true };
  }
  if (!token) return { ok: false, code: 'turnstile_missing' };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  // idempotency_key lets us retry the POST without burning the token twice.
  body.set('idempotency_key', crypto.randomUUID());

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, code: 'turnstile_unavailable' };
  }

  if (!res.ok) return { ok: false, code: 'turnstile_unavailable' };

  const data = (await res.json()) as SiteverifyResponse;
  if (!data.success) return { ok: false, code: 'turnstile_failed' };

  // Bind the token to the action we asked for, so a token minted on a cheap
  // widget cannot be spent on an expensive one.
  if (data.action && data.action !== expectedAction) {
    return { ok: false, code: 'turnstile_failed' };
  }
  return { ok: true };
}
```

```tsx
// src/components/tools/turnstile-gate.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Renders an invisible Turnstile widget and hands the parent a
 *  `getToken()` that resolves fresh on every call. Tokens are single-use. */
export function useTurnstile(action: string) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<((t: string) => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || !hostRef.current) return;

    let cancelled = false;
    const mount = () => {
      if (cancelled || !window.turnstile || !hostRef.current) return;
      widgetId.current = window.turnstile.render(hostRef.current, {
        sitekey: siteKey,
        action,
        size: 'flexible',
        appearance: 'interaction-only',
        callback: (token: string) => {
          pending.current?.(token);
          pending.current = null;
        },
      });
      setReady(true);
    };

    if (window.turnstile) {
      mount();
    } else {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
    };
  }, [action]);

  const getToken = useCallback(async (): Promise<string> => {
    if (!window.turnstile || !widgetId.current) return '';
    window.turnstile.reset(widgetId.current);
    return new Promise<string>((resolve) => {
      pending.current = resolve;
      setTimeout(() => {
        if (pending.current === resolve) {
          pending.current = null;
          resolve('');
        }
      }, 20_000);
    });
  }, []);

  const Slot = useCallback(
    () => <div ref={hostRef} className="min-h-[0px]" aria-hidden />,
    [],
  );

  return { Slot, getToken, ready };
}
```

**Acceptance criteria**
- [ ] `curl -X POST /api/tools/ticket` with no `turnstileToken` returns 403 `turnstile_missing`.
- [ ] A token replayed a second time returns 403 `turnstile_failed`.
- [ ] With `TURNSTILE_SECRET_KEY` unset and `VERCEL_ENV=production`, minting returns 503 `turnstile_unavailable` (fails closed).
- [ ] Cloudflare siteverify timing out for 4s returns `turnstile_unavailable`, not a 500.
- [ ] The widget renders in `interaction-only` mode and is invisible for a normal user.

---

### [RWY-04] Minting the signed ticket on the Vercel edge
**Estimate:** 1.5h · **Depends on:** RWY-03 · **Files:** `src/lib/tools/compute.ts`, `src/app/api/tools/ticket/route.ts`

**Why.** Railway has no idea who our users are and must not, so the ticket is the entire trust transfer: Vercel says "this request came from our origin, passed Turnstile, and is allowed to run exactly this job kind, for the next two minutes, once." Everything the Python side needs to make a policy decision must be *inside the signature* — including the IP hash, so quota accounting cannot be forged by a client sending its own header. This route is the one function invocation in the whole tools system; the tool pages themselves stay static and never import `@db`, as locked.

**Implementation**

```ts
// src/lib/tools/compute.ts
// Shared, dependency-free contract. Imported by the edge route and the client hook.

/** Audiences map 1:1 to job kinds on the Python side. Adding a tool means
 *  adding a string here AND a handler in app/jobs/handlers/. */
export const COMPUTE_AUDIENCES = ['ocr-pdf', 'pdf-compress', 'pdf-split', 'image-upscale'] as const;
export type ComputeAudience = (typeof COMPUTE_AUDIENCES)[number];

export function isComputeAudience(v: unknown): v is ComputeAudience {
  return typeof v === 'string' && (COMPUTE_AUDIENCES as readonly string[]).includes(v);
}

export const TICKET_TTL_SECONDS = 120;
export const TICKET_HEADER = 'X-Compute-Ticket';

export interface TicketPayload {
  v: 1;
  aud: ComputeAudience;
  jti: string;
  iat: number;
  exp: number;
  /** SHA-256(salt || client ip), truncated. Lets Python do per-IP quotas
   *  without ever seeing an IP and without trusting a client header. */
  iph: string;
}

export type ComputeErrorCode =
  | 'ticket_expired'
  | 'ticket_replayed'
  | 'ticket_bad_signature'
  | 'ticket_wrong_audience'
  | 'ticket_malformed'
  | 'quota_exceeded'
  | 'service_paused'
  | 'file_too_large'
  | 'file_type_rejected'
  | 'job_failed'
  | 'job_not_found';

export interface ComputeErrorBody {
  error: { code: ComputeErrorCode; message: string; [k: string]: unknown };
}
```

```ts
// src/app/api/tools/ticket/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  TICKET_TTL_SECONDS,
  isComputeAudience,
  type TicketPayload,
} from '@/lib/tools/compute';
import { verifyTurnstile } from '@/lib/tools/turnstile';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}|${ip}`));
  return b64url(new Uint8Array(digest)).slice(0, 22);
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  return (
    req.ip ??
    (xff ? xff.split(',')[0]!.trim() : '') ||
    req.headers.get('cf-connecting-ip') ||
    '0.0.0.0'
  );
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.COMPUTE_TICKET_SECRET;
  const salt = process.env.COMPUTE_IP_SALT;
  const base = process.env.NEXT_PUBLIC_COMPUTE_BASE_URL;
  if (!secret || !salt || !base) {
    return fail('service_paused', 'Compute service is not configured.', 503);
  }

  // Same-origin only. The ticket is the credential; do not mint one for a
  // page we did not serve.
  const origin = req.headers.get('origin');
  const allowed = (process.env.COMPUTE_ALLOWED_ORIGINS ?? 'https://kavithakanchana.me')
    .split(',')
    .map((s) => s.trim());
  if (origin && !allowed.includes(origin)) {
    return fail('ticket_wrong_audience', 'Origin not allowed.', 403);
  }

  let body: { audience?: unknown; turnstileToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('ticket_malformed', 'Body must be JSON.', 400);
  }

  const { audience, turnstileToken } = body;
  if (!isComputeAudience(audience)) {
    return fail('ticket_wrong_audience', 'Unknown tool.', 400);
  }

  const ip = clientIp(req);
  const human = await verifyTurnstile(
    typeof turnstileToken === 'string' ? turnstileToken : undefined,
    ip,
    audience,
  );
  if (!human.ok) {
    const status = human.code === 'turnstile_unavailable' ? 503 : 403;
    return fail(human.code, 'Could not verify that you are human. Try again.', status);
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: TicketPayload = {
    v: 1,
    aud: audience,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + TICKET_TTL_SECONDS,
    iph: await hashIp(ip, salt),
  };

  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payloadB64));
  const ticket = `${payloadB64}.${b64url(new Uint8Array(sig))}`;

  return NextResponse.json(
    { ticket, expiresAt: payload.exp, endpoint: `${base}/v1/jobs/${audience}` },
    { headers: { 'cache-control': 'no-store' } },
  );
}
```

Design notes worth defending: the signature covers the base64url *string*, not the re-serialised object, so Python never has to reproduce JavaScript's key ordering. The TTL is 120 s — long enough for a user to pick a file after the widget solves, short enough that a leaked ticket is worthless before it can be shared. And `iph` is a truncated salted hash, not an IP: rotating `COMPUTE_IP_SALT` invalidates all historical correlation, and the Python service never stores a PII value.

**Acceptance criteria**
- [ ] A valid POST returns `{ticket, expiresAt, endpoint}` and `cache-control: no-store`.
- [ ] `audience: "nonsense"` → 400 `ticket_wrong_audience`.
- [ ] Two calls produce different `jti` values.
- [ ] The route runs on the edge runtime (confirmed in the Vercel build output) and pulls in no Node built-ins.
- [ ] `Origin: https://evil.test` → 403.
- [ ] No tool page under `src/app/(tools)/` imports this module; `next build` still reports every tool page as static.

---

### [RWY-05] Verifying the ticket in FastAPI and burning the jti atomically
**Estimate:** 2h · **Depends on:** RWY-02, RWY-04 · **Files:** `services/compute/app/security/ticket.py`, `services/compute/tests/test_ticket.py`

**Why.** Signature verification is the easy half. The half that actually costs money is single use: OCR is roughly $0.008 per operation, so a ticket that can be spent twenty times in parallel is a twenty-times bill amplifier, and an attacker does not need a botnet — one `xargs -P 20` against one honest ticket is enough. A read-then-write check (`if await r.get(key): reject; await r.set(key)`) has a window of tens of microseconds between the GET and the SET during which all twenty concurrent requests read "absent" and all twenty proceed. `SET key value NX EX ttl` collapses that into one command; Redis executes commands one at a time on a single thread, so exactly one of the twenty gets `OK` and the other nineteen get `None`. That is the whole defence, and it is one line.

**Implementation**

```python
# app/security/ticket.py
import base64
import hashlib
import hmac
import json
import time
from typing import Annotated, Literal

from fastapi import Depends, Header
from pydantic import BaseModel, ValidationError

from app.config import Settings, get_settings
from app.errors import ApiError
from app.redis import redis

TICKET_HEADER = "X-Compute-Ticket"


class TicketClaims(BaseModel):
    v: Literal[1]
    aud: str
    jti: str
    iat: int
    exp: int
    iph: str


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _expect(code: str, message: str, status: int) -> ApiError:
    return ApiError(code=code, message=message, status=status)


def parse_and_verify(raw: str, settings: Settings) -> TicketClaims:
    """Pure, synchronous, no I/O — so it is trivially unit-testable and so a
    malformed ticket costs us zero Redis round-trips."""
    if raw.count(".") != 1:
        raise _expect("ticket_malformed", "Ticket is not well formed.", 401)
    payload_b64, sig_b64 = raw.split(".", 1)

    # 1. Signature FIRST. Nothing inside an unverified payload is trustworthy,
    #    including its own exp field.
    expected = hmac.new(
        settings.ticket_secret.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        provided = _b64url_decode(sig_b64)
    except Exception as exc:  # noqa: BLE001
        raise _expect("ticket_bad_signature", "Ticket signature is invalid.", 401) from exc
    if not hmac.compare_digest(expected, provided):
        raise _expect("ticket_bad_signature", "Ticket signature is invalid.", 401)

    # 2. Now the payload can be believed.
    try:
        claims = TicketClaims.model_validate(json.loads(_b64url_decode(payload_b64)))
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        raise _expect("ticket_malformed", "Ticket payload is invalid.", 401) from exc

    now = int(time.time())
    skew = settings.ticket_clock_skew_seconds

    # 3. Expiry, both directions. A far-future exp means either a clock problem
    #    or a leaked secret being used to mint eternal tickets; refuse both.
    if claims.exp < now - skew:
        raise _expect("ticket_expired", "This request took too long. Please try again.", 401)
    if claims.exp - claims.iat > settings.ticket_max_ttl_seconds:
        raise _expect("ticket_expired", "Ticket lifetime is out of policy.", 401)
    if claims.iat > now + skew:
        raise _expect("ticket_expired", "Ticket is not yet valid.", 401)

    return claims


async def burn_jti(claims: TicketClaims, settings: Settings) -> None:
    """Atomic single-use enforcement.

    SET NX EX is ONE Redis command. Redis runs commands serially on one thread,
    so among N concurrent requests carrying the same jti exactly one receives
    True and the rest receive None. A GET-then-SET pair has a race window
    between the two round-trips wide enough for a trivial `xargs -P 20` to
    slip an entire parallel batch of $0.008 OCR jobs through one ticket.

    TTL is the ticket's own remaining lifetime plus skew: shorter would let a
    ticket outlive its burn marker and become replayable again; longer just
    wastes a few bytes.
    """
    ttl = max(1, claims.exp - int(time.time()) + settings.ticket_clock_skew_seconds)
    acquired = await redis().set(f"jti:{claims.jti}", b"1", nx=True, ex=ttl)
    if not acquired:
        raise _expect(
            "ticket_replayed",
            "This request was already used. Please start again.",
            409,
        )


def require_ticket(audience: str):
    """Dependency factory. Binding the audience at route-declaration time means
    a ticket minted for `pdf-compress` (cheap) physically cannot be spent on
    `ocr-pdf` (expensive)."""

    async def _dep(
        settings: Annotated[Settings, Depends(get_settings)],
        ticket: Annotated[str | None, Header(alias=TICKET_HEADER)] = None,
    ) -> TicketClaims:
        if not ticket:
            raise _expect("ticket_malformed", "Missing ticket.", 401)

        claims = parse_and_verify(ticket, settings)

        if claims.aud != audience:
            raise _expect(
                "ticket_wrong_audience",
                "This ticket is not valid for this tool.",
                401,
            )

        # Burn LAST. If we burned before validating audience/expiry, an attacker
        # could fill Redis with jti keys using tickets that were never going to
        # be honoured anyway.
        await burn_jti(claims, settings)
        return claims

    return _dep
```

Error contract, exactly:

| Condition | HTTP | body |
|---|---|---|
| HMAC mismatch, or unparseable signature | 401 | `{"error":{"code":"ticket_bad_signature","message":"Ticket signature is invalid."}}` |
| `exp` in the past, `iat` in the future, or TTL over policy | 401 | `{"error":{"code":"ticket_expired","message":"This request took too long. Please try again."}}` |
| `aud` ≠ the route's job kind | 401 | `{"error":{"code":"ticket_wrong_audience","message":"This ticket is not valid for this tool."}}` |
| `jti` already burned | 409 | `{"error":{"code":"ticket_replayed","message":"This request was already used. Please start again."}}` |
| header absent, wrong shape, bad JSON | 401 | `{"error":{"code":"ticket_malformed","message":"…"}}` |

409 for replay rather than 401 is deliberate: the client hook uses it to distinguish "your ticket is bad, get a new one and stop" from "you double-submitted, this is a client bug", and it makes the replay counter in `/metrics` meaningful instead of drowning in generic auth noise.

```python
# tests/test_ticket.py  (the concurrency test is the one that matters)
import asyncio
import pytest
from app.errors import ApiError
from app.security.ticket import burn_jti, TicketClaims

@pytest.mark.asyncio
async def test_concurrent_burns_admit_exactly_one(settings, fake_now):
    claims = TicketClaims(v=1, aud="ocr-pdf", jti="j-1", iat=fake_now,
                          exp=fake_now + 120, iph="h")
    results = await asyncio.gather(
        *(burn_jti(claims, settings) for _ in range(25)), return_exceptions=True
    )
    ok = [r for r in results if r is None]
    replayed = [r for r in results if isinstance(r, ApiError) and r.code == "ticket_replayed"]
    assert len(ok) == 1
    assert len(replayed) == 24
```

**Acceptance criteria**
- [ ] A ticket minted by the real edge route verifies against the real Python code (round-trip integration test, same secret).
- [ ] Flipping one character of the signature → 401 `ticket_bad_signature`.
- [ ] A ticket with `exp` one second in the past → 401 `ticket_expired`.
- [ ] An `ocr-pdf` ticket POSTed to `/v1/jobs/pdf-compress` → 401 `ticket_wrong_audience`, and no `jti:` key is created.
- [ ] The 25-way concurrency test passes: exactly one success, twenty-four 409s.
- [ ] `hmac.compare_digest` is used; no `==` on secrets anywhere.

---

### [RWY-06] Job queue, state machine, and worker entrypoint
**Estimate:** 3h · **Depends on:** RWY-02, RWY-05 · **Files:** `services/compute/app/jobs/state.py`, `app/jobs/queue.py`, `app/jobs/worker.py`, `app/jobs/handlers/__init__.py`, `app/routers/jobs.py`

**Why.** OCR on a 40-page scan takes 30–90 seconds. Holding an HTTP connection open for that is how you discover that Cloudflare's proxy read timeout is 100 s, that Railway's is different, and that a Sri Lankan mobile connection is neither. Jobs are the locked pattern; this ticket makes them real.

**arq over RQ.** The service is asyncio end-to-end — FastAPI, httpx, redis.asyncio — and arq's pool *is* a `redis.asyncio.Redis`, so the queue, the jti burns, the quota counters, and the job records all share one connection pool instead of RQ needing a second synchronous one. RQ's genuine advantage is fork-per-job memory isolation, but every dangerous thing we run (Ghostscript, Tesseract, unpaper) already runs in its own subprocess with its own rlimits, so we would be paying for a second isolation boundary we already have. arq also ships per-job timeouts, result TTLs, `_job_id` deduplication, and cron in the box.

**Polling over SSE, for this workload specifically.** Four reasons, in order of weight. (1) SSE holds a connection open, which is the exact thing the locked decision forbids — and behind Cloudflare plus Railway's proxy it means two more intermediaries with independent idle timeouts to tune. (2) The worker that runs the job is not necessarily the process that would hold the SSE stream, so SSE needs a Redis pub/sub fan-out layer that polling does not. (3) A 60-second job polled with backoff costs about 8 requests — trivially rate-limitable at the Cloudflare edge, trivially cacheable for 1 s, and it degrades gracefully when a phone switches from wifi to 4G, where an SSE stream just dies. (4) The happy accident: on a Railway service with App Sleeping enabled (RWY-13), the poll traffic is what keeps the container awake for the duration of the job. SSE would too, but polling gets it for free without a persistent socket.

**Implementation**

```python
# app/jobs/state.py
from __future__ import annotations

import enum
import time
import uuid
from typing import Any

import orjson

from app.errors import ApiError
from app.redis import redis

JOB_RECORD_TTL = 3600  # a job record outlives its output file by design


class JobState(str, enum.Enum):
    QUEUED = "queued"
    VALIDATING = "validating"
    PROCESSING = "processing"
    FINALIZING = "finalizing"
    DONE = "done"
    FAILED = "failed"


# The state machine is explicit so a buggy handler cannot resurrect a failed
# job or report "done" without having produced anything.
ALLOWED: dict[JobState, set[JobState]] = {
    JobState.QUEUED: {JobState.VALIDATING, JobState.FAILED},
    JobState.VALIDATING: {JobState.PROCESSING, JobState.FAILED},
    JobState.PROCESSING: {JobState.FINALIZING, JobState.FAILED},
    JobState.FINALIZING: {JobState.DONE, JobState.FAILED},
    JobState.DONE: set(),
    JobState.FAILED: set(),
}

PROGRESS_FLOOR: dict[JobState, int] = {
    JobState.QUEUED: 0,
    JobState.VALIDATING: 5,
    JobState.PROCESSING: 15,
    JobState.FINALIZING: 90,
    JobState.DONE: 100,
    JobState.FAILED: 100,
}


def key(job_id: str) -> str:
    return f"job:{job_id}"


async def create(kind: str, iph: str, input_name: str, input_bytes: int) -> tuple[str, str]:
    job_id = uuid.uuid4().hex
    result_token = uuid.uuid4().hex  # required to fetch the output; not guessable
    await redis().hset(
        key(job_id),
        mapping={
            "id": job_id,
            "kind": kind,
            "state": JobState.QUEUED.value,
            "progress": "0",
            "iph": iph,
            "input_name": input_name,
            "input_bytes": str(input_bytes),
            "created_at": str(int(time.time())),
            "result_token": result_token,
        },
    )
    await redis().expire(key(job_id), JOB_RECORD_TTL)
    return job_id, result_token


async def read(job_id: str) -> dict[str, str]:
    raw: dict[bytes, bytes] = await redis().hgetall(key(job_id))
    if not raw:
        raise ApiError("job_not_found", "That job no longer exists.", 404)
    return {k.decode(): v.decode() for k, v in raw.items()}


async def transition(
    job_id: str,
    to: JobState,
    *,
    progress: int | None = None,
    detail: str | None = None,
    result: dict[str, Any] | None = None,
    error_code: str | None = None,
) -> None:
    record = await read(job_id)
    current = JobState(record["state"])
    if to not in ALLOWED[current]:
        raise RuntimeError(f"illegal transition {current.value} -> {to.value} for {job_id}")

    fields: dict[str, str | bytes] = {
        "state": to.value,
        "progress": str(progress if progress is not None else PROGRESS_FLOOR[to]),
        "updated_at": str(int(time.time())),
    }
    if detail:
        fields["detail"] = detail
    if result is not None:
        fields["result"] = orjson.dumps(result)
    if error_code:
        fields["error_code"] = error_code

    await redis().hset(key(job_id), mapping=fields)
    await redis().expire(key(job_id), JOB_RECORD_TTL)


async def bump_progress(job_id: str, progress: int, detail: str | None = None) -> None:
    """Progress within the current state. Never moves the state itself."""
    fields: dict[str, str] = {"progress": str(min(99, max(0, progress)))}
    if detail:
        fields["detail"] = detail
    await redis().hset(key(job_id), mapping=fields)
```

```python
# app/jobs/queue.py
from arq.connections import ArqRedis
from app.redis import redis


async def enqueue(job_id: str) -> None:
    pool: ArqRedis = redis()
    # _job_id makes enqueue idempotent: a retried POST cannot double-run a job.
    await pool.enqueue_job("run_job", job_id, _job_id=f"arq:{job_id}")
```

```python
# app/jobs/handlers/__init__.py
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from app.jobs.handlers import ocr_pdf


class Progress(Protocol):
    async def __call__(self, pct: int, detail: str | None = None) -> None: ...


@dataclass(frozen=True)
class JobSpec:
    kind: str
    accepted_mime: frozenset[str]
    max_input_bytes: int
    subprocess_timeout: float
    # Conservative floor cost per op, from the locked planning number.
    cost_floor_usd: float
    run: Callable[[Path, Path, Progress], Awaitable[dict[str, Any]]]


SPECS: dict[str, JobSpec] = {
    "ocr-pdf": JobSpec(
        kind="ocr-pdf",
        accepted_mime=frozenset({"application/pdf"}),
        max_input_bytes=25 * 1024 * 1024,
        subprocess_timeout=180.0,
        cost_floor_usd=0.008,  # ~$8 / 1000 ops
        run=ocr_pdf.run,
    ),
}
```

```python
# app/jobs/worker.py
import asyncio
import logging
import time
from pathlib import Path

from arq import cron
from arq.connections import RedisSettings

from app.config import get_settings
from app.hardening import assert_runtime_hardening
from app.jobs.handlers import SPECS
from app.jobs.state import JobState, bump_progress, read, transition
from app.logging import configure_logging
from app.redis import close_redis, init_redis
from app.retention import reap_expired_outputs, scratch_paths
from app.security.quota import record_spend

log = logging.getLogger("compute.worker")
settings = get_settings()


async def run_job(ctx: dict, job_id: str) -> None:
    started = time.monotonic()
    record = await read(job_id)
    spec = SPECS[record["kind"]]
    inp, out = scratch_paths(job_id)

    async def progress(pct: int, detail: str | None = None) -> None:
        await bump_progress(job_id, pct, detail)

    try:
        await transition(job_id, JobState.VALIDATING)
        if not inp.exists():
            raise FileNotFoundError("input vanished before processing")

        await transition(job_id, JobState.PROCESSING)
        result = await asyncio.wait_for(
            spec.run(inp, out, progress),
            timeout=settings.job_deadline_seconds,
        )

        await transition(job_id, JobState.FINALIZING)
        if not out.exists() or out.stat().st_size == 0:
            raise RuntimeError("handler reported success but produced no output")
        result["output_bytes"] = out.stat().st_size
        result["expires_at"] = int(time.time()) + settings.output_retention_seconds

        await transition(job_id, JobState.DONE, result=result)

    except asyncio.TimeoutError:
        await transition(job_id, JobState.FAILED, error_code="job_timeout")
        log.warning("job timed out", extra={"job_id": job_id, "kind": record["kind"]})
        out.unlink(missing_ok=True)
    except Exception as exc:  # noqa: BLE001
        await transition(job_id, JobState.FAILED, error_code="job_failed")
        log.exception("job failed", extra={"job_id": job_id, "kind": record["kind"]})
        out.unlink(missing_ok=True)
        del exc
    finally:
        # RETENTION: the input is destroyed the instant processing ends,
        # on every path, including the crash path.
        inp.unlink(missing_ok=True)
        await record_spend(record["kind"], time.monotonic() - started)


async def on_startup(ctx: dict) -> None:
    assert_runtime_hardening()
    configure_logging(settings.log_level)
    await init_redis()
    # A sleeping Railway service misses cron ticks; catch up on wake.
    await reap_expired_outputs(ctx)


async def on_shutdown(ctx: dict) -> None:
    await close_redis()


class WorkerSettings:
    functions = [run_job]
    cron_jobs = [cron(reap_expired_outputs, minute=set(range(0, 60, 5)), run_at_startup=False)]
    redis_settings = RedisSettings.from_dsn(str(settings.redis_url))
    on_startup = on_startup
    on_shutdown = on_shutdown
    max_jobs = 2                     # colocated with the API; do not starve it
    job_timeout = settings.job_deadline_seconds + 30
    keep_result = 0                  # our own job: hash is the source of truth
    max_tries = 1                    # OCR is expensive; never silently retry
    health_check_interval = 30
```

`max_tries = 1` is a cost decision, not a laziness one: an automatic retry on an expensive job doubles the bill for exactly the inputs most likely to fail again.

```python
# app/routers/jobs.py
from typing import Annotated

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

import orjson

from app.config import Settings, get_settings
from app.errors import ApiError
from app.jobs import queue, state
from app.jobs.handlers import SPECS
from app.retention import scratch_paths
from app.security.quota import assert_not_paused, consume_quota
from app.security.ticket import TicketClaims, require_ticket
from app.uploads.receive import receive_upload

router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


def _register(kind: str) -> None:
    spec = SPECS[kind]

    @router.post(f"/{kind}", status_code=202, name=f"create_{kind}")
    async def create(  # noqa: ANN202
        request: Request,
        settings: Annotated[Settings, Depends(get_settings)],
        claims: Annotated[TicketClaims, Depends(require_ticket(kind))],
        file: Annotated[UploadFile, File()],
    ):
        await assert_not_paused(settings)
        await consume_quota(claims.iph, settings)

        job_id_placeholder = state.uuid.uuid4().hex
        inp, _ = scratch_paths(job_id_placeholder)
        size, safe_name = await receive_upload(file, inp, spec)

        job_id, result_token = await state.create(kind, claims.iph, safe_name, size)
        # rename into the real job's slot now that we have an id
        real_in, _ = scratch_paths(job_id)
        inp.rename(real_in)

        await queue.enqueue(job_id)
        return JSONResponse(
            status_code=202,
            content={
                "job_id": job_id,
                "result_token": result_token,
                "state": "queued",
                "poll_after_ms": 800,
            },
            headers={"cache-control": "no-store"},
        )


for _kind in SPECS:
    _register(_kind)


@router.get("/{job_id}")
async def get_job(job_id: str) -> JSONResponse:
    record = await state.read(job_id)
    body: dict[str, object] = {
        "job_id": record["id"],
        "kind": record["kind"],
        "state": record["state"],
        "progress": int(record.get("progress", "0")),
    }
    if detail := record.get("detail"):
        body["detail"] = detail
    if record["state"] == state.JobState.DONE.value:
        body["result"] = orjson.loads(record["result"])
        body["result_url"] = f"/v1/jobs/{job_id}/result"
    if record["state"] == state.JobState.FAILED.value:
        body["error"] = {
            "code": record.get("error_code", "job_failed"),
            "message": "That file could not be processed.",
        }
    return JSONResponse(body, headers={"cache-control": "no-store"})


@router.get("/{job_id}/result")
async def get_result(job_id: str, t: str) -> FileResponse:
    record = await state.read(job_id)
    if record["state"] != state.JobState.DONE.value:
        raise ApiError("job_not_found", "No result available.", 404)
    import hmac as _hmac
    if not _hmac.compare_digest(t, record.get("result_token", "")):
        raise ApiError("job_not_found", "No result available.", 404)

    _, out = scratch_paths(job_id)
    if not out.exists():
        raise ApiError("job_not_found", "That file has expired and was deleted.", 410)

    return FileResponse(
        out,
        media_type="application/pdf",
        filename=record.get("input_name", "output.pdf"),
        # One-shot: the file is gone the moment the download completes.
        background=BackgroundTask(out.unlink, missing_ok=True),
        headers={"cache-control": "no-store", "x-content-type-options": "nosniff"},
    )
```

**Acceptance criteria**
- [ ] `POST /v1/jobs/ocr-pdf` with a valid ticket and a real PDF returns 202 with `job_id`, `result_token`, `poll_after_ms`.
- [ ] `GET /v1/jobs/{id}` walks `queued → validating → processing → finalizing → done` and progress is monotonic.
- [ ] `transition()` raises on an illegal edge (unit test: `done → processing`).
- [ ] A handler that raises leaves the job `failed`, deletes both scratch files, and never leaves a `processing` job stuck.
- [ ] Enqueuing the same `job_id` twice runs the handler once (arq `_job_id` dedupe).
- [ ] `GET /v1/jobs/{id}/result` without the correct `t` returns 404, not 403 (no oracle).
- [ ] Downloading the result twice: first 200, second 410.

---

### [RWY-07] Client-side job hook with backoff
**Estimate:** 1.5h · **Depends on:** RWY-04, RWY-06 · **Files:** `src/lib/tools/use-compute-job.ts`

**Why.** Every tool widget in Part B will need the same six steps — get a Turnstile token, mint a ticket, upload, poll, download, clean up — and if each one reimplements the polling loop we will have four subtly different backoff bugs. Fixed-interval polling is the specific bug to avoid: it hammers the endpoint during a 90-second OCR and looks like an attack to the Cloudflare rate limiter we are about to install in RWY-12.

**Implementation**

```ts
// src/lib/tools/use-compute-job.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComputeAudience, ComputeErrorCode } from '@/lib/tools/compute';

export type JobState =
  | 'idle' | 'authorizing' | 'uploading'
  | 'queued' | 'validating' | 'processing' | 'finalizing'
  | 'done' | 'failed';

export interface JobStatus {
  state: JobState;
  progress: number;
  detail?: string;
  errorCode?: ComputeErrorCode | 'network' | 'cancelled';
  message?: string;
  download?: { url: string; filename: string; expiresAt: number };
}

const TERMINAL = new Set<JobState>(['done', 'failed']);

const FRIENDLY: Partial<Record<string, string>> = {
  ticket_expired: 'That took a little too long. Press convert again.',
  ticket_replayed: 'That request was already sent. Press convert again.',
  ticket_bad_signature: 'Something went wrong verifying your session. Reload the page.',
  ticket_wrong_audience: 'Something went wrong verifying your session. Reload the page.',
  quota_exceeded: "You've hit today's free limit. Try again tomorrow.",
  service_paused: 'This tool is taking a short break. Try again in an hour.',
  file_too_large: 'That file is too big for this tool.',
  file_type_rejected: "That doesn't look like the file type this tool accepts.",
  job_failed: 'That file could not be processed. It may be corrupted or password-protected.',
  network: 'Lost connection. Check your network and try again.',
};

/** 800ms → ×1.35 → capped at 4s. ~8 requests across a 60s job. */
function nextDelay(prev: number): number {
  return Math.min(4000, Math.round(prev * 1.35));
}

const OVERALL_DEADLINE_MS = 6 * 60 * 1000;

export function useComputeJob(audience: ComputeAudience) {
  const [status, setStatus] = useState<JobStatus>({ state: 'idle', progress: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const set = useCallback((next: JobStatus) => {
    if (aliveRef.current) setStatus(next);
  }, []);

  const fail = useCallback(
    (code: string) =>
      set({
        state: 'failed',
        progress: 100,
        errorCode: code as JobStatus['errorCode'],
        message: FRIENDLY[code] ?? 'Something went wrong. Please try again.',
      }),
    [set],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    set({ state: 'idle', progress: 0 });
  }, [set]);

  const run = useCallback(
    async (file: File, turnstileToken: string) => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      const deadline = Date.now() + OVERALL_DEADLINE_MS;

      try {
        set({ state: 'authorizing', progress: 2 });
        const tRes = await fetch('/api/tools/ticket', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ audience, turnstileToken }),
          signal: ctl.signal,
        });
        if (!tRes.ok) {
          const b = await tRes.json().catch(() => null);
          return fail(b?.error?.code ?? 'network');
        }
        const { ticket, endpoint } = (await tRes.json()) as {
          ticket: string; endpoint: string;
        };

        set({ state: 'uploading', progress: 5 });
        const form = new FormData();
        form.append('file', file, file.name);
        const cRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'X-Compute-Ticket': ticket },
          body: form,
          signal: ctl.signal,
        });
        if (cRes.status !== 202) {
          const b = await cRes.json().catch(() => null);
          return fail(b?.error?.code ?? 'network');
        }
        const created = (await cRes.json()) as {
          job_id: string; result_token: string; poll_after_ms: number;
        };

        const base = endpoint.slice(0, endpoint.lastIndexOf('/v1/jobs/'));
        let delay = created.poll_after_ms;
        let consecutiveNetworkErrors = 0;

        for (;;) {
          if (Date.now() > deadline) return fail('network');
          await new Promise((r) => setTimeout(r, delay));
          if (ctl.signal.aborted) return;

          let poll: Response;
          try {
            poll = await fetch(`${base}/v1/jobs/${created.job_id}`, {
              signal: ctl.signal, cache: 'no-store',
            });
          } catch {
            if (ctl.signal.aborted) return;
            // Transient network blips must not kill a job that is still running.
            if (++consecutiveNetworkErrors >= 5) return fail('network');
            delay = nextDelay(delay);
            continue;
          }
          consecutiveNetworkErrors = 0;

          if (poll.status === 503) return fail('service_paused');
          if (!poll.ok) return fail('network');

          const body = (await poll.json()) as {
            state: JobState; progress: number; detail?: string;
            error?: { code: ComputeErrorCode };
            result?: { expires_at: number };
          };

          if (!TERMINAL.has(body.state)) {
            set({ state: body.state, progress: body.progress, detail: body.detail });
            delay = nextDelay(delay);
            continue;
          }

          if (body.state === 'failed') return fail(body.error?.code ?? 'job_failed');

          set({
            state: 'done',
            progress: 100,
            download: {
              url: `${base}/v1/jobs/${created.job_id}/result?t=${created.result_token}`,
              filename: file.name,
              expiresAt: body.result?.expires_at ?? 0,
            },
          });
          return;
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        fail('network');
      }
    },
    [audience, fail, set],
  );

  return { status, run, cancel };
}
```

**Acceptance criteria**
- [ ] A 60-second job issues ≤ 10 poll requests (counted in the network panel).
- [ ] Unmounting the component mid-job aborts every in-flight fetch; no state-update-after-unmount warning.
- [ ] Killing the network for 3 polls and restoring it resumes without failing the job.
- [ ] Every `ComputeErrorCode` maps to a human sentence; no raw code reaches the UI.
- [ ] `expiresAt` is surfaced so the widget can say "this download expires in 15 minutes".
- [ ] `tsc --noEmit` passes under strict mode.

---

### [RWY-08] Per-IP quotas and the global spend kill switch
**Estimate:** 2h · **Depends on:** RWY-02 · **Files:** `services/compute/app/security/quota.py`

**Why.** A free public OCR endpoint is, in economic terms, a donation button attached to a stranger's automation. The per-IP quota stops casual abuse; the global spend guard is the thing that stops the 3am scenario where a residential-proxy pool defeats the per-IP quota and the only remaining question is whether the bill stops at $30 or $3,000. The guard has to be global and it has to fail closed.

**Estimating spend without a billing API.** Railway exposes no per-request cost, so we synthesise it. Railway bills roughly by resource-minutes — memory GB-minutes and vCPU-minutes — so we measure the one thing we actually know exactly, job wall-clock seconds, multiply by the container's provisioned vCPU and GB, and apply published per-second rates. That systematically *under*-counts (it ignores egress and idle), so we clamp each job to a floor derived from the locked planning figure of $8/1000 OCR ops and take `max(measured, floor)`. Under-estimating spend is the only failure mode that costs real money, so every rounding decision goes the pessimistic way. The result is not an invoice; it is a governor.

**Implementation**

```python
# app/security/quota.py
import datetime as dt
import logging

from redis.commands.core import AsyncScript

from app.config import Settings, get_settings
from app.errors import ApiError
from app.jobs.handlers import SPECS
from app.redis import redis

log = logging.getLogger("compute.quota")

# INCR + conditional EXPIRE must be one atomic unit. Without the Lua script a
# process that dies between INCR and EXPIRE leaves an immortal counter that
# permanently bans an IP.
_INCR_WITH_TTL = """
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
"""

_incr_script: AsyncScript | None = None


def _today() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y%m%d")


def _seconds_until_utc_midnight() -> int:
    now = dt.datetime.now(dt.UTC)
    tomorrow = (now + dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(60, int((tomorrow - now).total_seconds()))


async def _incr_with_ttl(key: str, ttl: int) -> int:
    global _incr_script
    if _incr_script is None:
        _incr_script = redis().register_script(_INCR_WITH_TTL)
    return int(await _incr_script(keys=[key], args=[ttl]))


# ---------------------------------------------------------------- per-IP quota

async def consume_quota(iph: str, settings: Settings) -> None:
    """iph comes from inside the signed ticket, so a client cannot spoof it by
    sending its own header."""
    key = f"quota:{_today()}:{iph}"
    count = await _incr_with_ttl(key, _seconds_until_utc_midnight())
    if count > settings.daily_jobs_per_ip:
        raise ApiError(
            "quota_exceeded",
            f"You've used all {settings.daily_jobs_per_ip} free conversions for today.",
            429,
            extra={"retry_after_seconds": _seconds_until_utc_midnight()},
        )


# ------------------------------------------------------------- spend estimator

def estimate_job_cost_usd(kind: str, wall_seconds: float, settings: Settings) -> float:
    """Railway bills resource-minutes and gives us no per-request figure, so we
    reconstruct it from the one number we measure exactly: wall time.

        measured = wall_s * (vcpu * $/vcpu-s + gb * $/gb-s)

    This ignores egress and idle, so it under-counts — and under-counting is
    the only error that costs money. Clamp to the planning floor
    ($8/1000 ops for OCR) and take the larger.
    """
    measured = wall_seconds * (
        settings.assumed_vcpu * settings.rate_usd_per_vcpu_second
        + settings.assumed_gb * settings.rate_usd_per_gb_second
    )
    floor = SPECS[kind].cost_floor_usd if kind in SPECS else 0.0
    return max(measured, floor)


async def record_spend(kind: str, wall_seconds: float) -> None:
    settings = get_settings()
    cost = estimate_job_cost_usd(kind, wall_seconds, settings)
    key = f"spend:{_today()}"
    total = float(await redis().incrbyfloat(key, cost))
    await redis().expire(key, _seconds_until_utc_midnight() + 86_400)

    ratio = total / settings.daily_spend_cap_usd
    if ratio >= 1.0:
        # Latch it. A latched flag survives a Redis float being reset and makes
        # "why is it 503ing" answerable with one GET.
        await redis().set("killswitch:auto", b"1", ex=_seconds_until_utc_midnight())
        log.error("spend cap reached; API paused",
                  extra={"spend_usd": round(total, 4), "cap_usd": settings.daily_spend_cap_usd})
    elif ratio >= 0.7:
        log.warning("spend at %d%% of daily cap", int(ratio * 100),
                    extra={"spend_usd": round(total, 4)})


# ----------------------------------------------------------------- kill switch

async def assert_not_paused(settings: Settings) -> None:
    """Two switches: `killswitch:manual` is me, from redis-cli, when something
    is on fire. `killswitch:auto` is the spend guard. Either one pauses
    everything expensive; health checks stay green so Railway does not
    restart-loop the container while it is deliberately paused."""
    manual, auto = await redis().mget("killswitch:manual", "killswitch:auto")
    if not (manual or auto):
        return
    raise ApiError(
        "service_paused",
        "These tools are taking a short break to keep them free. "
        "Please try again in an hour.",
        503,
        extra={"retry_after_seconds": 3600, "reason": "manual" if manual else "budget"},
    )


async def current_spend_usd() -> float:
    raw = await redis().get(f"spend:{_today()}")
    return float(raw) if raw else 0.0
```

Two operational details that matter more than the code. First, the auto switch clears at UTC midnight by TTL, so a bad day does not become a bad week and does not need me awake to fix it. Second, `assert_not_paused` runs *before* `consume_quota` in the route, so a paused service does not burn a user's daily allowance on a request it was never going to serve.

**Acceptance criteria**
- [ ] The 21st job from one `iph` in a UTC day returns 429 `quota_exceeded` with `retry_after_seconds`.
- [ ] The counter key carries a TTL after the very first increment (verified with `TTL`).
- [ ] `estimate_job_cost_usd("ocr-pdf", 5.0, s)` returns the 0.008 floor, not the smaller measured value.
- [ ] Pushing `spend:YYYYMMDD` past the cap makes every `POST /v1/jobs/*` return 503 `service_paused` while `/healthz` stays 200.
- [ ] `redis-cli SET killswitch:manual 1` pauses the API within one request, with no deploy.
- [ ] `killswitch:auto` expires at UTC midnight.

---

### [RWY-09] File-upload security hardening
**Estimate:** 3h · **Depends on:** RWY-01, RWY-06 · **Files:** `services/compute/app/uploads/middleware.py`, `app/uploads/sniff.py`, `app/uploads/receive.py`, `app/proc.py`

**Why.** This is the highest-risk surface in the project by a wide margin: we accept arbitrary binaries from anonymous strangers and feed them to a stack of C programs with a long, ongoing history of memory-safety and command-injection bugs. The threat model is not "someone uploads a big file" — it is "someone uploads a file crafted to make Ghostscript run a command." Every control below exists to make that either impossible or worthless.

**The CVE history, one honest sentence each.**
- **Ghostscript** has repeatedly had sandbox escapes where crafted PostScript reaches the operating system — CVE-2023-36664 being the notorious recent one, where filenames beginning with `%pipe%` (or `|`) caused command execution — so assume any Ghostscript exposed to untrusted PDFs is one unpatched month away from RCE.
- **ImageMagick** shipped ImageTragick (CVE-2016-3714) and a steady stream of successors in which a crafted image triggers a delegate command, and since the only real defence is a hand-maintained `policy.xml` denylist, we simply do not install ImageMagick at all.
- **PDF parsers** (MuPDF/PyMuPDF, poppler, and pikepdf's underlying qpdf) carry a long tail of heap overflows and infinite loops in font, JBIG2, and JPEG2000 decoders reachable from a single malformed page, which is why parsing runs in a subprocess with a wall-clock timeout and an address-space limit rather than inside the API process.

**Why `-dSAFER=false.pdf` is dangerous.** POSIX command-line convention says a leading `-` marks an option, and argument parsers apply that rule to whatever position the string lands in. If we ever build a command as a string for a shell, or pass a user-controlled filename into a tool's argv in a position where the parser still accepts flags, then a file named `-dSAFER=false.pdf` stops being a filename and becomes an instruction that disables Ghostscript's sandbox. Three layers defeat it, and we use all three: (1) `shell=False` with an explicit argv list, so no shell ever performs word-splitting, globbing, or `$()` on any part of the command; (2) the user's filename is never passed to any subprocess at all — the file is written to `/scratch/<32-hex-job-id>.in` and only that path is ever an argument; (3) every path we do pass is absolute, beginning with `/`, so it is structurally incapable of being read as a flag, and options always precede positionals in our argv construction.

**Implementation**

```python
# app/uploads/middleware.py
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class MaxBodySizeMiddleware:
    """Cap the request body at the ASGI layer.

    Necessary because Starlette spools an UploadFile to a temp file as it
    arrives: by the time a route handler runs, a 2 GB body has already been
    written to disk. This counts bytes on the receive channel and cuts the
    request off mid-stream.
    """

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        declared = headers.get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > self.max_bytes:
                    await self._reject(send)
                    return
            except ValueError:
                await self._reject(send)
                return

        received = 0

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # Chunked encoding declares no length; this is the real cap.
                    raise _BodyTooLarge
            return message

        try:
            await self.app(scope, counting_receive, send)
        except _BodyTooLarge:
            await self._reject(send)

    async def _reject(self, send: Send) -> None:
        body = (
            b'{"error":{"code":"file_too_large",'
            b'"message":"That file is larger than this tool accepts."}}'
        )
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"),
                                (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})


class _BodyTooLarge(Exception):
    pass
```

```python
# app/uploads/sniff.py
"""Magic-byte sniffing. The client's Content-Type is a suggestion written by
the attacker; the first bytes of the file are the only evidence we have."""

_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"II*\x00", "image/tiff"),
    (b"MM\x00*", "image/tiff"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
)


def sniff(head: bytes) -> str | None:
    for magic, mime in _SIGNATURES:
        if head.startswith(magic):
            return mime

    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"

    # The PDF spec tolerates junk before %PDF-, and real-world PDFs exploit
    # that. Accept the marker anywhere in the first 1 KiB and nowhere else.
    idx = head[:1024].find(b"%PDF-")
    if idx != -1:
        return "application/pdf"

    return None
```

```python
# app/uploads/receive.py
import re
import unicodedata
from pathlib import Path

from fastapi import UploadFile

from app.errors import ApiError
from app.uploads.sniff import sniff

CHUNK = 64 * 1024
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]+")


def safe_display_name(raw: str | None, fallback: str) -> str:
    """Sanitised name used ONLY for the Content-Disposition on the way back
    out. It is never given to a subprocess and never used as a path."""
    if not raw:
        return fallback
    name = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    name = Path(name).name                    # strip any directory component
    name = _SAFE_NAME.sub("_", name).lstrip(".-")   # kill leading dot and dash
    return name[:80] or fallback


async def receive_upload(upload: UploadFile, dest: Path, spec) -> tuple[int, str]:
    """Stream to disk with a hard byte cap, sniff the head, delete on reject."""
    total = 0
    head = b""

    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with dest.open("wb") as out:
            while chunk := await upload.read(CHUNK):
                total += len(chunk)
                if total > spec.max_input_bytes:
                    raise ApiError(
                        "file_too_large",
                        f"This tool accepts files up to "
                        f"{spec.max_input_bytes // (1024 * 1024)} MB.",
                        413,
                    )
                if len(head) < 4096:
                    head += chunk[: 4096 - len(head)]
                out.write(chunk)

        if total == 0:
            raise ApiError("file_type_rejected", "That file is empty.", 400)

        detected = sniff(head)
        if detected not in spec.accepted_mime:
            raise ApiError(
                "file_type_rejected",
                "That doesn't look like the kind of file this tool accepts.",
                415,
            )
    except Exception:
        dest.unlink(missing_ok=True)   # never leave a rejected file on disk
        raise

    return total, safe_display_name(upload.filename, "output.pdf")
```

```python
# app/proc.py
import asyncio
import logging
import os
import resource
import signal
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger("compute.proc")

# Minimal, explicit environment. Nothing inherited that a subprocess could be
# steered by (LD_PRELOAD, GS_OPTIONS, PYTHONPATH, ...).
SAFE_ENV: dict[str, str] = {
    "PATH": "/usr/local/bin:/usr/bin:/bin",
    "LANG": "C.UTF-8",
    "LC_ALL": "C.UTF-8",
    "HOME": "/scratch",
    "TMPDIR": "/scratch",
    "TESSDATA_PREFIX": "/usr/share/tesseract-ocr/5/tessdata",
    "OMP_THREAD_LIMIT": "1",
}


@dataclass(frozen=True)
class ProcResult:
    returncode: int
    stdout: bytes
    stderr: bytes


def _apply_limits() -> None:
    """Runs in the child between fork and exec. Belt and braces around the
    wall-clock timeout: an infinite loop in a JBIG2 decoder hits RLIMIT_CPU,
    a decompression bomb hits RLIMIT_AS, a fork bomb hits RLIMIT_NPROC, and a
    runaway writer hits RLIMIT_FSIZE."""
    os.setsid()
    resource.setrlimit(resource.RLIMIT_AS, (2 * 1024**3, 2 * 1024**3))     # 2 GiB
    resource.setrlimit(resource.RLIMIT_CPU, (180, 190))                    # CPU seconds
    resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
    resource.setrlimit(resource.RLIMIT_FSIZE, (512 * 1024**2, 512 * 1024**2))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))                       # no core dumps


async def run_argv(argv: list[str], *, timeout: float, cwd: Path) -> ProcResult:
    """Run an external program safely.

    shell=False is implicit in create_subprocess_exec — there is no shell, so
    no word splitting, no globbing, no $(), no `|`, no redirection, whatever
    bytes end up in argv.

    Every element of argv must be either a literal we wrote or an ABSOLUTE
    path we generated. User-supplied filenames never appear here: a file
    called `-dSAFER=false.pdf` would be parsed as an option by any tool that
    still accepts flags at that position, and disabling Ghostscript's SAFER
    mode is a full sandbox escape. Our paths start with '/', so they cannot
    be mistaken for flags, and options always precede positionals.
    """
    if any(not isinstance(a, str) or "\x00" in a for a in argv):
        raise ValueError("argv must be NUL-free strings")
    for a in argv[1:]:
        if a.startswith("/") and not Path(a).is_absolute():
            raise ValueError("path arguments must be absolute")

    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(cwd),
        env=SAFE_ENV,
        preexec_fn=_apply_limits,   # noqa: PLW1509 — worker is single-threaded per job
        start_new_session=True,
    )

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        # proc.kill() only kills the direct child. ocrmypdf spawns ghostscript
        # and tesseract children; without the process-group kill they survive
        # as orphans and keep burning the CPU we are being billed for.
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except ProcessLookupError:
            pass
        await proc.wait()
        log.warning("subprocess timed out", extra={"argv0": argv[0], "timeout": timeout})
        raise

    return ProcResult(proc.returncode or 0, stdout, stderr)
```

And the one real handler, showing argv construction end to end:

```python
# app/jobs/handlers/ocr_pdf.py
from pathlib import Path
from typing import Any

from app.proc import run_argv

# Language codes are validated against this set — never interpolated from input.
_ALLOWED_LANGS = {"eng", "sin", "tam"}


async def run(src: Path, dst: Path, progress) -> dict[str, Any]:
    await progress(20, "Reading pages")

    langs = "+".join(sorted(_ALLOWED_LANGS & {"eng", "sin"}))

    argv = [
        "/usr/local/bin/ocrmypdf",
        "--language", langs,
        "--output-type", "pdfa",
        "--skip-text",          # never re-OCR pages that already have text
        "--optimize", "1",
        "--jobs", "1",
        "--quiet",
        "--",                   # end of options; everything after is positional
        str(src.resolve()),     # /scratch/<hex>.in  — absolute, ours, not the user's name
        str(dst.resolve()),     # /scratch/<hex>.out
    ]

    await progress(35, "Recognising text")
    result = await run_argv(argv, timeout=180.0, cwd=src.parent)

    # ocrmypdf: 0 = ok, 2 = input is not a PDF, 6 = already has text (with --skip-text
    # this is success), 15 = other error.
    if result.returncode not in (0, 6):
        raise RuntimeError(f"ocrmypdf exited {result.returncode}")

    await progress(85, "Writing PDF")
    return {"engine": "tesseract", "languages": langs}
```

**Acceptance criteria**
- [ ] A 200 MB body is rejected with 413 `file_too_large` and nothing over 25 MB is ever written to `/scratch`.
- [ ] A chunked request with no `Content-Length` is still cut off at the cap.
- [ ] A `.pdf` file whose bytes are actually a ZIP → 415 `file_type_rejected`, and the partial file is deleted.
- [ ] Uploading a file literally named `-dSAFER=false.pdf` succeeds normally, and the process listing shows `/scratch/<hex>.in`, never the user's name.
- [ ] `run_argv` raises on any argv element containing a NUL byte.
- [ ] A crafted PDF that hangs Ghostscript is killed at 180 s and `ps` shows zero surviving `gs` processes.
- [ ] `grep -rn "shell=True\|os.system\|subprocess.run(f\"" app/` returns nothing (wired into CI).
- [ ] Only `run_argv` may spawn processes — enforced by a ruff rule banning `subprocess.` outside `app/proc.py`.

---

### [RWY-10] Retention: delete inputs immediately, outputs on a timer
**Estimate:** 1.5h · **Depends on:** RWY-06 · **Files:** `services/compute/app/retention.py`

**Why.** The tool pages will say "your file is deleted within 15 minutes" because that is the single most common question about any online file tool. The claim is only worth making if it is enforced by code that runs whether or not the job succeeded, whether or not the download happened, and whether or not the container was asleep for three hours. Three independent mechanisms, because any one of them can miss.

**Implementation**

```python
# app/retention.py
import logging
import time
from pathlib import Path

from app.config import get_settings

log = logging.getLogger("compute.retention")


def scratch_root() -> Path:
    return Path(get_settings().scratch_dir)


def scratch_paths(job_id: str) -> tuple[Path, Path]:
    """Both filenames are derived from a server-generated hex id. No part of
    any user-supplied name reaches the filesystem."""
    if not job_id.isalnum() or len(job_id) != 32:
        raise ValueError("job_id must be 32 hex chars")
    root = scratch_root()
    return root / f"{job_id}.in", root / f"{job_id}.out"


async def reap_expired_outputs(_ctx: dict | None = None) -> int:
    """Mechanism 3 of 3, the backstop.

    1. Inputs are unlinked in run_job's `finally`, so they die the moment
       processing ends, on the success path AND the crash path.
    2. Outputs are unlinked by a BackgroundTask the moment they are downloaded.
    3. This sweep catches everything else: outputs nobody downloaded, files
       from a job that was killed by SIGKILL before its finally block ran,
       and stray temp files any library left in TMPDIR.

    Runs every 5 minutes via arq cron AND once at worker startup, because a
    Railway service with App Sleeping enabled misses every cron tick while it
    is asleep — without the startup run, a 15-minute promise silently becomes
    a "until the next request" promise.
    """
    settings = get_settings()
    cutoff = time.time() - settings.output_retention_seconds
    removed = 0

    root = scratch_root()
    if not root.exists():
        return 0

    for path in root.iterdir():
        try:
            if not path.is_file():
                continue
            st = path.stat()
            # Inputs get a much shorter grace period: if one is still here
            # after 30 minutes, its job died and nothing will ever read it.
            limit = cutoff if path.suffix != ".in" else time.time() - 1800
            if st.st_mtime < limit:
                path.unlink(missing_ok=True)
                removed += 1
        except OSError as exc:
            log.warning("reaper could not remove %s: %s", path, exc)

    if removed:
        log.info("reaped %d expired files", removed,
                 extra={"retention_seconds": settings.output_retention_seconds})
    return removed
```

The stated window is a single constant, `output_retention_seconds`, and the tool page copy reads it rather than hardcoding "15 minutes" — so changing the policy changes the promise, and the two can never drift apart:

```ts
// src/lib/tools/compute.ts (addition)
export const OUTPUT_RETENTION_MINUTES = 15;
export const RETENTION_COPY =
  `Your file is processed on our server and deleted automatically. ` +
  `The uploaded file is erased the moment processing finishes; ` +
  `the result is erased within ${OUTPUT_RETENTION_MINUTES} minutes, or immediately after you download it.`;
```

**Acceptance criteria**
- [ ] After a successful job, `<job>.in` is gone before the job reaches `done`.
- [ ] After a failed job, both scratch files are gone.
- [ ] An output nobody downloads is gone within 15 minutes + 5 (verified by fast-forwarding `output_retention_seconds` to 10 s in a test).
- [ ] A downloaded output is gone immediately; a second download returns 410.
- [ ] The reaper runs on worker startup, not only on cron.
- [ ] `scratch_paths("../../etc/passwd")` raises `ValueError`.
- [ ] The retention sentence on every tool page is generated from `OUTPUT_RETENTION_MINUTES`.

---

### [RWY-11] Observability: JSON logs, token-gated `/metrics`, and exactly three alerts
**Estimate:** 1.5h · **Depends on:** RWY-02 · **Files:** `services/compute/app/logging.py`, `app/routers/metrics.py`

**Why.** With 15–20 hours a week, the constraint is not what I *can* monitor, it is what I will still be reading in six weeks. Structured logs cost nothing and make Railway's log search usable; a `/metrics` endpoint gives a real dashboard for free. The alerting discipline is the actual content of this ticket.

**Why exactly three alerts.** An alert is only worth existing if it maps to a distinct action I would take at 2am, and a solo developer who gets paged for something they cannot act on will mute the channel within a fortnight — after which they have zero alerts, not four. There are exactly three distinct actions available to me: *pause it*, *restart or roll it back*, and *ship a fix*. So: (1) **spend at 70% of the daily cap** — action: decide whether to lower the quota or let the kill switch do its job, and this is the only alert that is about money. (2) **`/readyz` failing for 3 consecutive minutes** (external uptime check, not self-reported) — action: restart, or check whether Redis died; this is the only alert that means "it is down". (3) **job failure ratio above 25% over 15 minutes with at least 10 jobs** — action: roll back the last deploy, because a healthy service returning garbage is invisible to an uptime check and is precisely what a bad `ocrmypdf` flag change looks like. Everything else I might want — p95 latency, queue depth, per-tool volume — is a *dashboard*: I look at it when one of the three fires, or on a Sunday. Promoting any of them to an alert would add noise without adding an action.

**Implementation**

```python
# app/logging.py
import contextvars
import logging
import sys
import time
import uuid

import orjson
from starlette.types import ASGIApp, Receive, Scope, Send

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

_STDLIB = frozenset(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {
    "message", "asctime", "taskName",
}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": request_id_var.get(),
        }
        for k, v in record.__dict__.items():
            if k not in _STDLIB and not k.startswith("_"):
                payload[k] = v
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return orjson.dumps(payload).decode()


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    # uvicorn's own access log is unstructured and duplicates ours.
    logging.getLogger("uvicorn.access").disabled = True


class RequestContextMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.log = logging.getLogger("compute.access")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        rid = uuid.uuid4().hex[:12]
        token = request_id_var.set(rid)
        started = time.monotonic()
        status_holder = {"status": 500}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", rid.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            self.log.info(
                "request",
                extra={
                    "method": scope.get("method"),
                    "path": scope.get("path"),
                    "status": status_holder["status"],
                    "duration_ms": round((time.monotonic() - started) * 1000, 1),
                },
            )
            request_id_var.reset(token)
```

```python
# app/routers/metrics.py
import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

from app.config import Settings, get_settings
from app.errors import ApiError
from app.security.quota import current_spend_usd

router = APIRouter(tags=["ops"])

JOBS = Counter("compute_jobs_total", "Jobs by kind and terminal state", ["kind", "state"])
JOB_SECONDS = Histogram(
    "compute_job_duration_seconds", "Wall time per job", ["kind"],
    buckets=(1, 2.5, 5, 10, 20, 40, 80, 160, 320),
)
TICKETS = Counter("compute_ticket_rejections_total", "Ticket rejections", ["code"])
QUOTA = Counter("compute_quota_rejections_total", "Quota rejections")
SPEND = Gauge("compute_estimated_spend_usd_today", "Estimated spend today (USD)")
PAUSED = Gauge("compute_paused", "1 when the kill switch is engaged")


async def require_metrics_token(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """/metrics leaks volume, failure rates and spend. Cloudflare blocks it at
    the edge (RWY-12) and this is the second lock."""
    expected = settings.metrics_token
    if not expected:
        raise ApiError("job_not_found", "Not found.", 404)
    provided = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(provided, expected):
        raise ApiError("job_not_found", "Not found.", 404)


@router.get("/metrics", include_in_schema=False, dependencies=[Depends(require_metrics_token)])
async def metrics() -> Response:
    SPEND.set(await current_spend_usd())
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

**Acceptance criteria**
- [ ] Every log line is one valid JSON object; `railway logs | jq -c 'select(.level=="ERROR")'` works.
- [ ] Every response carries `x-request-id`, and that id appears on the access log line for the same request.
- [ ] `/metrics` without a bearer token returns **404** (not 401 — no existence oracle).
- [ ] `compute_jobs_total{kind="ocr-pdf",state="done"}` increments on success and `state="failed"` on failure.
- [ ] `compute_estimated_spend_usd_today` matches `redis GET spend:YYYYMMDD`.
- [ ] Exactly three alert rules exist, wired to one channel, each documented with the action it implies.
- [ ] No log line ever contains a filename, an IP address, or a ticket.

---

### [RWY-12] Cloudflare in front of Railway (and why rate limiting stays out of `src/middleware.ts`)
**Estimate:** 1h · **Depends on:** RWY-02 · **Files:** `services/compute/app/security/origin.py`, `docs/cloudflare.md`

**Why.** Rate limiting has to happen where it is cheapest, which is before a request costs me anything. Cloudflare drops abusive traffic at their edge for free; anything I do in application code has already paid for a TLS handshake, a container wake, and an ASGI dispatch.

**Why not `src/middleware.ts`.** Four reasons, and the first is decisive. Next.js middleware runs on **every request matching its matcher**, and the tools system's entire premise — locked in Sprint 1 — is that tool pages are statically generated with zero function invocations. Adding a rate-limit matcher that touches `/tools/*` converts every one of those free static page loads into a billed middleware invocation with added latency, which is exactly the property we designed the system around. Second, the existing middleware matcher is scoped to `/admin` for a reason, and widening it is a permanent tax to solve a temporary problem. Third, middleware runs in isolated edge instances with no shared memory, so an in-process counter does not actually rate limit anything — it would need a network round-trip to Redis or Upstash on every request, which makes the cost problem worse, not better. Fourth and most simply: the traffic that needs limiting goes to **Railway**, not to Vercel. Putting the limiter on Vercel guards a door the attacker is not using.

**Implementation** (`docs/cloudflare.md`, applied in the dashboard)

```
Zone: kavithakanchana.me
DNS:  api-tools  CNAME  <service>.up.railway.app   [Proxied — orange cloud]
SSL/TLS: Full (strict).  Railway serves a valid cert on its own domain, so
         strict works; Flexible would leave Cloudflare→Railway unencrypted.

Rate limiting rules (Free tier allows one; Pro allows several — order matters)
  1. "compute-create"     expression: (http.request.uri.path matches "^/v1/jobs/[a-z-]+$"
                                       and http.request.method eq "POST")
     characteristics: IP
     rate: 10 requests / 1 minute       action: Block, 60s
     -> the expensive door. Ten job creations a minute is far above any human.

  2. "compute-poll"       expression: (http.request.uri.path matches "^/v1/jobs/[a-f0-9]{32}$")
     characteristics: IP
     rate: 120 requests / 1 minute      action: Managed Challenge
     -> generous, because our own backoff hook uses ~8 per job.

WAF custom rules
  3. Block  (http.request.uri.path eq "/metrics")            unless ip.src in $ops_ips
  4. Block  (http.request.uri.path eq "/docs" or ... "/openapi.json")
  5. Managed Challenge  (cf.threat_score gt 20 and http.request.method eq "POST")

Cache rules
  6. Bypass cache for /v1/*   (job state must never be cached)

Other
  - Security Level: Medium.  Bot Fight Mode: ON.
  - Max upload size is a plan limit: 100 MB on Free/Pro. Our app cap is 25 MB,
    comfortably inside it.
  - Proxy read timeout is 100s on Free. Irrelevant to us BECAUSE jobs are
    async and polled — this is one of the concrete reasons SSE was rejected.
```

The gap Cloudflare cannot close on its own: `<service>.up.railway.app` stays publicly reachable, and Railway offers no origin IP allowlist. Close it with a shared secret that only Cloudflare sends:

```python
# app/security/origin.py
import hmac
from typing import Annotated

from fastapi import Depends, Header

from app.config import Settings, get_settings
from app.errors import ApiError


async def require_edge(
    settings: Annotated[Settings, Depends(get_settings)],
    x_edge_token: Annotated[str | None, Header()] = None,
) -> None:
    """Railway has no IP allowlist and the *.up.railway.app hostname stays
    publicly resolvable, so an attacker can bypass every Cloudflare rule by
    hitting the origin directly. A Cloudflare Transform Rule injects
    X-Edge-Token on every proxied request; requests without it did not come
    through the edge and are refused."""
    expected = settings.origin_shared_token
    if not expected:
        return  # unset in local dev
    if not x_edge_token or not hmac.compare_digest(x_edge_token, expected):
        raise ApiError("job_not_found", "Not found.", 404)
```

Applied to the job router with `dependencies=[Depends(require_edge)]`, and paired with a Cloudflare Transform Rule: *Modify Request Header → Set static → `X-Edge-Token` = `<secret>`* on all requests to `api-tools.kavithakanchana.me`. Rotating it is two dashboard edits and one Railway variable.

**Acceptance criteria**
- [ ] `api-tools.kavithakanchana.me` resolves to Cloudflare IPs and responses carry `cf-ray`.
- [ ] SSL/TLS mode is Full (strict) and `curl -I` shows a valid chain.
- [ ] 11 rapid POSTs to `/v1/jobs/ocr-pdf` from one IP get blocked by Cloudflare, and Railway logs show only 10.
- [ ] `curl https://<service>.up.railway.app/v1/jobs/ocr-pdf` returns 404 (no edge token).
- [ ] `/metrics` from a non-ops IP is blocked at Cloudflare and 404s at the origin.
- [ ] `src/middleware.ts` matcher is unchanged and still `['/admin', '/admin/((?!login|api).*)']`.
- [ ] `next build` still reports every `/tools/*` page as `● SSG`.

---

### [RWY-13] Railway configuration: services, variables, disk, cold starts, idle cost
**Estimate:** 1.5h · **Depends on:** RWY-01 · **Files:** `services/compute/railway.toml`, `docs/railway.md`

**Why.** Railway's defaults are tuned for an always-on app with a database. Ours is a low-traffic service that must cost near nothing on a quiet Tuesday and must not lose files between two containers. Both of those need deliberate configuration, and one of them (the disk) is a correctness bug, not a cost optimisation.

**Implementation**

```toml
# services/compute/railway.toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "services/compute/Dockerfile"
watchPatterns = ["services/compute/**"]   # a Next.js commit must not rebuild Python

[deploy]
startCommand = "honcho -f /srv/Procfile start"
healthcheckPath = "/healthz"              # liveness, NOT /readyz — see RWY-02
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
numReplicas = 1                           # more than one needs R2, not a volume
```

**Services.** Two, not four.

| Service | What it is | Public domain |
|---|---|---|
| `compute` | this image; honcho runs uvicorn **and** the arq worker | `api-tools.kavithakanchana.me` via Cloudflare |
| `redis` | Railway's Redis template | none, private network only |

**Volumes vs ephemeral disk — and the trap.** The instinct is to attach a Railway volume for `/scratch`. Do not. A volume attaches to exactly one service and pins it to one replica, and worse, it makes files *survive restarts*, which directly contradicts the retention promise in RWY-10: a crash would leave user PDFs on persistent disk indefinitely. Use the **ephemeral container disk**. Every file has a lifetime under 15 minutes, and a restart wiping `/scratch` is the correct behaviour, not data loss — a job in flight fails, the client's hook reports it, the user retries.

This is precisely why the API and worker are colocated. If they were separate services, the API would write `/scratch/<id>.in` into container A's ephemeral disk and the worker would look for it on container B's, and every single job would fail with `FileNotFoundError`. Splitting them requires Cloudflare R2 (or a Railway volume plus a rewrite to a single service anyway), and that is a v2 decision triggered by real contention, not a v1 default.

**Environment variables.**

| Variable | Service | Notes |
|---|---|---|
| `REDIS_URL` | compute | `${{Redis.REDIS_URL}}` — private network, no egress cost |
| `TICKET_SECRET` | compute | 32 random bytes, base64. **Must equal** Vercel's `COMPUTE_TICKET_SECRET` |
| `ORIGIN_SHARED_TOKEN` | compute | matches the Cloudflare Transform Rule (RWY-12) |
| `METRICS_TOKEN` | compute | bearer token for `/metrics` |
| `ALLOWED_ORIGINS` | compute | `https://kavithakanchana.me` |
| `DAILY_SPEND_CAP_USD` | compute | `3.0` to start; raise once real numbers exist |
| `ENVIRONMENT` | compute | `production` — disables `/docs` |
| `COMPUTE_TICKET_SECRET` | Vercel | the shared HMAC key |
| `COMPUTE_IP_SALT` | Vercel | rotating this breaks all historical IP correlation, by design |
| `NEXT_PUBLIC_COMPUTE_BASE_URL` | Vercel | `https://api-tools.kavithakanchana.me` |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel | RWY-03 |

Secret rotation is the one operation with a sharp edge: changing `TICKET_SECRET` on Railway invalidates every ticket Vercel has already minted, so tickets in flight fail with `ticket_bad_signature`. With a 120-second TTL the blast radius is two minutes of retries, which is acceptable — rotate Railway first, then Vercel, and accept a short window rather than building dual-key support nobody needs at this traffic level.

**Cold starts and not paying for idle.** Enable **App Sleeping** on the `compute` service. On a portfolio site the tools will be idle for most of every day, and sleeping takes that from "billed continuously" to "billed for the minutes it runs". The cost is a wake latency of roughly 5–15 seconds on the first request after a nap. Three mitigations, in order:

1. **Warm on intent, not on load.** The ticket route is already a network call the user makes *before* uploading, so the client fires a `fetch(base + '/healthz', {mode:'no-cors'})` the moment a file is selected — the container is waking while the user is still reading the upload confirmation.
2. **Polling keeps it awake.** App Sleeping triggers on absent inbound traffic; our poll loop supplies a request every 0.8–4 s for the whole job. An SSE stream would too, but this is a free property of the design we already chose.
3. **The reaper runs at startup**, because a sleeping service misses cron ticks — already handled in RWY-10, and this is the reason it exists.

Keep `redis` awake (it is tiny, and a sleeping Redis makes `/readyz` flap). Set `restartPolicyMaxRetries = 5` so a genuinely broken deploy stops instead of crash-looping into a bill.

**Acceptance criteria**
- [ ] A commit touching only `src/` does not trigger a Railway build (watchPatterns verified).
- [ ] Health check is `/healthz`; stopping Redis makes `/readyz` 503 while the container stays up.
- [ ] `/scratch` is ephemeral: a restart empties it, and no volume is attached.
- [ ] An end-to-end job succeeds with API and worker in the same container.
- [ ] With App Sleeping on, the first request after 30 idle minutes succeeds within 20 s and the warm ping fires on file-select.
- [ ] `TICKET_SECRET` and `COMPUTE_TICKET_SECRET` are identical; a deliberate mismatch produces `ticket_bad_signature` and nothing else.
- [ ] A day with zero traffic shows no compute charge on the Railway usage graph.

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Malicious PDF achieves code execution via Ghostscript | Low | Critical | Non-root UID 10001, read-only app tree, `shell=False` argv only, absolute paths only, no user filename ever reaches argv, `RLIMIT_AS`/`CPU`/`NPROC`/`FSIZE`, process-group kill on timeout, minimal `SAFE_ENV`, ImageMagick not installed; monthly base-image rebuild to pick up Debian's Ghostscript patches |
| Cost blowout from automated abuse | Medium | High | Turnstile siteverify before minting, single-use 120 s ticket bound to job kind, per-IP-hash daily quota, Cloudflare edge rate limit on POST, and a latched global kill switch that 503s at the estimated daily cap |
| Estimated spend diverges from the real Railway bill | High | Medium | Estimate is deliberately pessimistic (`max(measured, $0.008/op)`); reconcile against the actual invoice weekly for the first month and recalibrate `rate_usd_per_*`; the $3/day cap is one twentieth of a bill I would notice |
| Redis outage takes the whole service down | Medium | Medium | `/readyz` fails so Cloudflare/uptime sees it while `/healthz` stays green so Railway does not restart-loop; Redis holds only jti burns, counters and job records — nothing whose loss is unrecoverable; Railway's private-network Redis has no egress dependency |
| App Sleeping wake latency reads as "broken" | High | Low | Warm ping on file-select, honest "starting up" copy in the widget for the first 15 s, and polling keeps the container awake for the whole job |
| Colocated worker starves the API under load | Medium | Medium | `max_jobs = 2`, `--jobs 1` on ocrmypdf, `OMP_THREAD_LIMIT=1`; the API path does almost no CPU work. Escape hatch is documented: move handoff to Cloudflare R2 and split into two services — the handler already goes through `scratch_paths()` |
| A user's file survives longer than the stated 15 minutes | Low | High (trust) | Three independent deletions: input unlinked in `finally` on every path, output unlinked as a download BackgroundTask, and a reaper on 5-minute cron *plus* worker startup; ephemeral disk means a container restart also wipes everything |
| Ticket secret rotation breaks live requests | Medium | Low | 120 s TTL bounds the window to two minutes of `ticket_bad_signature`; the client hook already maps that code to "reload the page" |
| Attacker bypasses Cloudflare by hitting `*.up.railway.app` | Medium | High | `X-Edge-Token` shared secret injected by a Cloudflare Transform Rule and required by `require_edge`; origin returns 404 without it |
| `tesseract-ocr-sin` / `-tam` quality is poor enough to embarrass | Medium | Medium | Part B ships a visible confidence caveat and a "text layer only, original pages untouched" guarantee via `--skip-text`; Sinhala/Tamil are marked `beta` in the `ToolDef` status field |
| Solo-dev bus factor: an incident lands mid-degree-deadline | High | Medium | The kill switch is one `redis-cli SET killswitch:manual 1` and needs no deploy; only three alerts exist, so the channel stays readable; every failure mode degrades to a friendly 503 rather than a broken page |

---

### Part B — OCR scanned PDF → searchable PDF

**Part B total: 13.5h** (OCR-01 2h · OCR-02 1h · OCR-03 3h · OCR-04 1.5h · OCR-05 0.5h · OCR-06 3h · OCR-07 0.5h · OCR-08 2h)

This is the tool that proves the Railway tier is worth having. Everything before it ran in the browser. This one cannot: Tesseract is 40 MB of C++ and a scanned PDF is the wrong shape for WASM. It is also the most expensive thing on the site, so the caps in OCR-05 are not decoration.

---

#### Assumed Part A surface (import, do not rebuild)

Python side, package root `services/compute/app/`:

```python
from app.deps import require_ticket, Ticket        # Ticket: .jti .op .ip_hash .exp
from app.queue import job, enqueue, JobRejected    # @job(queue="ocr", timeout=...) ; enqueue() -> job_id
from app.quota import consume_quota, QuotaExceeded # consume_quota(ip_hash, op, units:int)
from app.killswitch import assert_spend_ok         # raises HTTPException(503, code="SERVICE_PAUSED")
from app.uploads import save_upload, UploadRejected  # magic-byte sniff, size cap, temp dir, cleanup
from app.storage import job_dir, sign_download      # job_dir(job_id)->Path ; sign_download(path, ttl)->str
from app.metrics import counter, histogram
from app.settings import settings                  # pydantic-settings; REDIS_URL, WORKER_VCPUS, ...
```

TypeScript side:

```ts
import { useJobStatus } from '@/lib/tools/use-job-status'
// returns { status: 'queued'|'running'|'done'|'failed', progress: number|null,
//           phase: string|null, result: any, errorCode: string|null }
import { getTicket } from '@/lib/tools/ticket'   // POST /api/tools/ticket -> { ticket, computeBase }
```

If any of those names drifted in Part A, fix the import — the logic below does not otherwise depend on their internals.

---

### [OCR-01] Registry entry and the entire page copy

**Estimate:** 2h · **Depends on:** Sprint 1 (`registry.ts`, `types.ts`, `tool-shell.tsx`), OCR-06 (Widget export), OCR-07 (`caveats` field) · **Files:** `src/lib/tools/tools/ocr-pdf.ts` (new), `src/lib/tools/registry.ts` (edit)

**Why.** Every other tool on this platform is going to be copy-pasted from this file, so the copy is the deliverable, not filler around the widget. It is also the only part of the page Google can read: the widget is a client component that renders nothing on the server, so the static HTML for `/tools/scanned-pdf-to-searchable-pdf` is `intro` + `howItWorks` + `caveats` + `gotchas` + FAQ. If those are stubs the page ranks for nothing and the Railway bill buys us zero traffic. Write it as if the reader is a Sri Lankan office worker who was told to "email a searchable copy" and does not know what OCR is.

**Implementation**

```ts
// src/lib/tools/tools/ocr-pdf.ts
import type { ToolDef } from '@/lib/tools/types'
import OcrPdfWidget from '@/components/tools/widgets/ocr-pdf.loader'

export const ocrPdf: ToolDef = {
  slug: 'scanned-pdf-to-searchable-pdf',
  title: 'Make a scanned PDF searchable',
  metaTitle: 'Scanned PDF to Searchable PDF — Free OCR (English, සිංහල, தமிழ்)',
  description:
    'Upload a scanned or photographed PDF and get the same PDF back with a real text layer, so Ctrl+F, copy-paste and highlighting work. English, Sinhala and Tamil. Free, no account, files deleted in an hour.',
  category: 'pdf',
  audience: ['sri-lanka', 'general'],   // must already exist in the union in types.ts — add none
  runsOn: 'railway',
  status: 'beta',
  publishedAt: '2026-08-24',
  updatedAt: '2026-08-24',
  reviewEveryDays: 120,
  keywords: [
    'scanned pdf to searchable pdf',
    'ocr pdf online free',
    'make pdf searchable',
    'pdf text not selectable',
    'sinhala ocr pdf',
    'tamil ocr pdf',
    'searchable pdf converter',
    'ocr scanned document sri lanka',
  ],

  intro:
    'A PDF that came out of a scanner or a phone camera is a stack of photographs. It looks like a document, but there is no text inside it — Ctrl+F finds nothing, you cannot copy a line out of it, and it is invisible to every search box it is ever uploaded into. This tool runs OCR over the pages and writes the recognised words back into the same PDF as an invisible layer sitting exactly on top of the printed words. The pages look identical to what you uploaded. The difference is that the file is now searchable and selectable. Nothing is uploaded to a third-party service, nothing is stored after an hour, and there is no account.',

  howItWorks:
    'Your file is uploaded to a small server we run for the jobs that are too heavy for a browser, and the work happens in three passes. First a check pass: we open the PDF, repair a damaged cross-reference table if there is one, count the pages, and sample a dozen of them to see whether real text is already present. If the document turns out to be searchable already, we stop there and tell you — no point spending a minute on a file that is already done. Second, the OCR pass. Each page image is rasterised at 300 dots per inch and handed to Tesseract 5, the open-source engine Google originally released, using the LSTM models for the language you picked. Tesseract returns each recognised word together with the rectangle it occupied on the page. Third, the assembly pass: those words are written back into the original PDF as invisible text positioned over the matching part of the image, and the file is losslessly optimised so it does not come back noticeably bigger than it went in. Pages that already contained real text are passed through untouched — we never re-photograph text that is already digital. You get the finished PDF plus, if you want it, a plain .txt of everything that was read. Both links expire after an hour, and the server copies are deleted at the same time.',

  caveats:
    'Honest limits, because you are going to hit them: OCR is a guess, and the quality of the guess is set almost entirely by the quality of the scan. A clean 300 DPI scan of printed English is typically 97–99% accurate at the character level. A 150 DPI scan drops to the low 90s, which means a visible mistake every couple of lines. A phone photo taken at an angle, under a ceiling light, of a page that is not flat, can fall below 80% and produce text that is searchable but not readable. Tables lose their structure — you get the cell contents in roughly reading order, not a grid. Multi-column layouts are usually handled, but a column break in the middle of a sentence sometimes is not. Handwriting is not supported at all; Tesseract is a print engine and will return noise for cursive. Sinhala is the weakest of the three languages here — the script has a large glyph inventory with stacked vowel signs, and the public trained model is trained on far less material than the English one, so expect meaningfully more errors on Sinhala than on English, especially at small type sizes. Tamil sits in between. None of this stops the file being useful: even 85% accuracy makes a document findable, because you rarely need every word to be right, only the one you are searching for.',

  gotchas:
    'Password-protected PDFs are rejected. If a password is needed to open the file we cannot read it and we will not ask you for one — remove the protection in your PDF reader first and upload the unlocked copy. Files that are merely restricted from printing or editing, with no open-password, are fine; we strip that restriction on our side to do the work and the restriction is gone from the file you get back, which is worth knowing before you send it on. Fifty pages is the hard limit per upload, and 25 MB. A 200-page report has to be split, and honestly should be — a job that size ties up the queue for everyone. Do not upload the same file twice hoping for a better result; the process is deterministic and you will get the identical output. The output PDF is usually within about 10% of the input size, but a scan that was originally saved as a single enormous JPEG per page can come back slightly larger, because a text layer is being added and we do not re-compress your images lossily. Choose only the languages that are actually in the document: adding a second language slows recognition by roughly 40% and, worse, gives the engine more wrong answers to choose between, so a Sinhala-only document run as "English + Sinhala" comes out worse than one run as Sinhala alone. Finally, the invisible text layer is aligned to the image, not to the physical page — if you print the result and re-scan it, you are back where you started.',

  faqs: [
    {
      q: 'Why can I see the words but not search them?',
      a: 'Because what you are seeing is a picture of words. A scanner produces an image and wraps it in a PDF; nothing in the file records that the shapes are letters. OCR is the process of looking at that image and working out which letters they are. Until that has been done, the PDF is no more searchable than a photograph of a road sign.',
    },
    {
      q: 'Does the page look any different afterwards?',
      a: 'No. The images are untouched unless you tick the "fix crooked or sideways scans" option. The recognised text is added in an invisible rendering mode, so it can be selected and searched but never drawn on screen or on paper. If you compare the before and after side by side you will not be able to tell them apart by eye.',
    },
    {
      q: 'Is Sinhala OCR actually usable?',
      a: 'For clear printed Sinhala at 300 DPI, yes — good enough that searching for a name or a place will reliably find it. For faint photocopies, small print, or phone photos, it degrades faster than English does, and you should treat the extracted text as a search index rather than a transcript. We use the higher-accuracy "best" Tesseract model for Sinhala rather than the fast one that ships with most Linux distributions, which is a noticeable improvement, but it does not close the gap with English.',
    },
    {
      q: 'What happens to my file?',
      a: 'It is uploaded over HTTPS to a server in the EU, processed, and deleted — both the upload and the result — within one hour, automatically. It is never sent to any other company, never used for training anything, and never looked at. Your download link stops working when the file is deleted, so save the result before you close the tab.',
    },
    {
      q: 'My PDF already has some text on some pages. What happens to those?',
      a: 'They are left exactly as they are. We run in a mode that skips any page which already contains real text, so a document that is half digital and half scanned comes back with the digital half untouched and the scanned half made searchable. If the existing text layer is itself bad OCR from some earlier tool, pick the "replace an existing bad text layer" option instead, which strips it and starts over.',
    },
    {
      q: 'Can I get just the text, without the PDF?',
      a: 'Yes — every successful job produces a plain .txt download alongside the PDF, containing everything that was recognised, in page order. It is the fastest way to check the quality before you rely on the result.',
    },
  ],

  related: ['compress-image-to-exact-kb', 'pdf-page-remover'],
  // ^ these must be slugs that already exist in the registry; swap for whatever Sprints 2–3 shipped.
  //   validate.ts throws at build time on a dangling related[] entry — that is the check working.

  sources: [
    { label: 'OCRmyPDF documentation — cookbook and options', url: 'https://ocrmypdf.readthedocs.io/en/latest/cookbook.html', verifiedOn: '2026-08-09' },
    { label: 'Tesseract OCR — user manual', url: 'https://tesseract-ocr.github.io/tessdoc/', verifiedOn: '2026-08-09' },
    { label: 'tessdata_best — high-accuracy LSTM models (sin, tam)', url: 'https://github.com/tesseract-ocr/tessdata_best', verifiedOn: '2026-08-09' },
  ],

  Widget: OcrPdfWidget,
}
```

Then register it:

```ts
// src/lib/tools/registry.ts
import { ocrPdf } from './tools/ocr-pdf'

export const TOOLS: ToolDef[] = [
  // ...existing
  ocrPdf,
]
```

**Acceptance criteria**
- [ ] `pnpm build` succeeds; `/tools/scanned-pdf-to-searchable-pdf` is in the static output with `dynamicParams = false`.
- [ ] `curl -s https://kavithakanchana.me/tools/scanned-pdf-to-searchable-pdf | grep -c "Tesseract"` returns ≥ 1 — the copy is in the server HTML, not injected by the widget.
- [ ] `howItWorks` ≥ 120 words, `gotchas` ≥ 120 words, `caveats` ≥ 120 words (word-count assertion added to `validate.ts` for `runsOn !== 'browser'` tools).
- [ ] The page imports nothing from `@db`; grep the built RSC payload to confirm.
- [ ] JSON-LD emits `FAQPage` with all six Q/A pairs and `SoftwareApplication` with `applicationCategory: 'UtilitiesApplication'`.

---

### [OCR-02] Submit endpoint, preflight, and quota charging in pages

**Estimate:** 1h · **Depends on:** Part A (`require_ticket`, `save_upload`, `consume_quota`, `assert_spend_ok`, `enqueue`) · **Files:** `services/compute/app/routers/ocr.py` (new), `services/compute/app/main.py` (edit), `src/app/api/tools/ticket/route.ts` (edit)

**Why.** The endpoint has one job beyond handing work to the queue: refuse fast. Everything expensive is behind it, so anything we can reject in 50 ms — not a PDF, encrypted, 200 pages, already searchable — must be rejected here rather than three minutes into a worker. Charging quota in *pages* instead of *documents* is the important decision: a 50-page job costs fifty times a 1-page job, and a per-document quota would let someone burn the whole day's compute with six uploads.

**Implementation**

```python
# services/compute/app/routers/ocr.py
from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.deps import Ticket, require_ticket
from app.killswitch import assert_spend_ok
from app.metrics import counter
from app.ocr.preflight import PreflightError, preflight_pdf
from app.ocr.worker import run_ocr_job
from app.queue import JobRejected, enqueue
from app.quota import QuotaExceeded, consume_quota
from app.uploads import UploadRejected, save_upload

router = APIRouter(prefix="/v1/ocr", tags=["ocr"])

MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES = 50
ALLOWED_LANGS = {"eng", "sin", "tam"}
Mode = Literal["skip-text", "force-ocr", "redo-ocr"]


class SubmitResponse(BaseModel):
    job_id: str
    pages: int
    charged_pages: int


def _err(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


@router.post("/submit", response_model=SubmitResponse)
async def submit(
    file: UploadFile = File(...),
    langs: str = Form("eng"),
    mode: Mode = Form("skip-text"),
    straighten: bool = Form(False),
    ticket: Ticket = Depends(require_ticket),
) -> SubmitResponse:
    if ticket.op != "ocr-pdf":
        raise _err(403, "TICKET_WRONG_OP", "This upload slot is not valid for this tool.")

    assert_spend_ok()  # 503 SERVICE_PAUSED

    lang_list = [l.strip() for l in langs.split("+") if l.strip()]
    if not lang_list or not set(lang_list) <= ALLOWED_LANGS:
        raise _err(400, "BAD_LANGUAGE", "Pick English, Sinhala or Tamil.")
    if len(lang_list) > 2:
        raise _err(400, "TOO_MANY_LANGUAGES", "Choose at most two languages.")

    try:
        src: Path = await save_upload(file, max_bytes=MAX_BYTES, magic=b"%PDF-")
    except UploadRejected as e:
        raise _err(400, e.code, e.human) from e

    # Preflight is CPU work on untrusted input: bound it.
    try:
        info = await asyncio.wait_for(
            asyncio.to_thread(preflight_pdf, src, max_pages=MAX_PAGES), timeout=8.0
        )
    except asyncio.TimeoutError:
        counter("ocr_preflight_timeout").inc()
        raise _err(400, "PDF_CORRUPT", "We could not read this PDF. It may be damaged.")
    except PreflightError as e:
        counter("ocr_preflight_reject", code=e.code).inc()
        raise _err(400, e.code, e.human) from e

    if mode == "skip-text" and info.text_ratio >= 0.9:
        raise _err(
            409,
            "ALREADY_SEARCHABLE",
            "This PDF already has a text layer — try Ctrl+F in your PDF reader. "
            "If the existing text is wrong, choose 'replace an existing bad text layer'.",
        )

    charged = info.pages * (2 if mode == "force-ocr" else 1)
    try:
        consume_quota(ticket.ip_hash, op="ocr-pdf", units=charged)
    except QuotaExceeded as e:
        raise HTTPException(429, detail={"code": "QUOTA_EXCEEDED", "message": e.human,
                                         "resets_at": e.resets_at.isoformat()}) from e

    try:
        job_id = enqueue(
            run_ocr_job,
            queue="ocr",
            kwargs=dict(
                src_path=str(info.normalised_path),
                langs="+".join(lang_list),
                mode=mode,
                straighten=straighten,
                pages=info.pages,
            ),
            # generous ceiling; the worker enforces its own tighter, page-scaled timeout
            timeout=1200,
            max_depth=40,
        )
    except JobRejected as e:
        raise _err(503, "QUEUE_FULL",
                   "Too many people are using this right now. Try again in a few minutes.") from e

    counter("ocr_submitted", mode=mode, langs="+".join(lang_list)).inc()
    return SubmitResponse(job_id=job_id, pages=info.pages, charged_pages=charged)
```

The preflight itself — this is where every hostile-PDF case is handled, and it deliberately avoids PyMuPDF (AGPL). `pikepdf` is MPL-2.0 over qpdf (Apache-2.0), `pypdf` is BSD-3:

```python
# services/compute/app/ocr/preflight.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pikepdf
import pypdf


class PreflightError(Exception):
    def __init__(self, code: str, human: str) -> None:
        super().__init__(code)
        self.code = code
        self.human = human


@dataclass(frozen=True)
class PdfInfo:
    pages: int
    text_ratio: float          # fraction of sampled pages that already have real text
    normalised_path: Path      # repaired / decrypted copy the worker should use
    was_encrypted: bool


def preflight_pdf(src: Path, *, max_pages: int) -> PdfInfo:
    try:
        pdf = pikepdf.open(src)                 # qpdf silently repairs a broken xref table here
        was_encrypted = False
    except pikepdf.PasswordError as e:
        # Owner-password-only files open with an empty user password; genuine user passwords do not.
        raise PreflightError(
            "PDF_ENCRYPTED",
            "This PDF needs a password to open. Remove the password in your PDF reader, "
            "then upload the unlocked copy.",
        ) from e
    except pikepdf.PdfError as e:
        raise PreflightError(
            "PDF_CORRUPT",
            "We could not read this PDF — the file looks damaged or is not really a PDF.",
        ) from e

    with pdf:
        was_encrypted = pdf.is_encrypted
        n = len(pdf.pages)
        if n == 0:
            raise PreflightError("PDF_EMPTY", "This PDF has no pages in it.")
        if n > max_pages:
            raise PreflightError(
                "TOO_MANY_PAGES",
                f"This PDF has {n} pages and the limit is {max_pages}. "
                f"Split it and run the parts separately.",
            )
        # Always re-save: this strips owner-password restrictions, normalises a repaired
        # xref, and guarantees the worker gets a file qpdf is happy with.
        out = src.with_name(src.stem + ".norm.pdf")
        pdf.save(out, linearize=False)

    return PdfInfo(
        pages=n,
        text_ratio=_text_ratio(out, n),
        normalised_path=out,
        was_encrypted=was_encrypted,
    )


def _text_ratio(path: Path, n: int) -> float:
    """Sample up to 12 evenly spaced pages and see how many already carry real text."""
    idxs = sorted({round(i * (n - 1) / 11) for i in range(min(12, n))})
    try:
        reader = pypdf.PdfReader(str(path))
    except Exception:
        return 0.0
    hits = 0
    for i in idxs:
        try:
            txt = reader.pages[i].extract_text() or ""
        except Exception:
            txt = ""
        # 40 chars is above scanner watermarks ("Scanned by CamScanner") and below real body text.
        if len(txt.strip()) >= 40:
            hits += 1
    return hits / len(idxs)
```

Wire it up, and add the op to the Vercel ticket allowlist:

```python
# services/compute/app/main.py
from app.routers import ocr
app.include_router(ocr.router)
```

```ts
// src/app/api/tools/ticket/route.ts  — one-line edit
const ALLOWED_OPS = new Set(['image-compress-hd', 'ocr-pdf'] as const)
```

**Acceptance criteria**
- [ ] A 200-page PDF returns 400 `TOO_MANY_PAGES` in under 500 ms and never enqueues.
- [ ] A user-password PDF returns 400 `PDF_ENCRYPTED`; an owner-password-only PDF is accepted and the restriction is absent from the output.
- [ ] A PDF with a deliberately clobbered `startxref` is repaired and accepted.
- [ ] A born-digital PDF returns 409 `ALREADY_SEARCHABLE` in `skip-text` mode and is accepted in `redo-ocr` mode.
- [ ] Quota is charged in pages, doubled for `force-ocr`; a rejected submit charges nothing.
- [ ] Replaying the same ticket a second time returns 401 `TICKET_USED`.

---

### [OCR-03] The OCR worker job

**Estimate:** 3h · **Depends on:** OCR-02, Part A (`@job`, `job_dir`, `sign_download`) · **Files:** `services/compute/app/ocr/worker.py` (new), `services/compute/Dockerfile` (edit), `services/compute/requirements.txt` (edit)

**Why.** ocrmypdf is a pipeline that shells out to Tesseract, Ghostscript, pngquant and jbig2enc, and any of them can hang on a hostile page. Running it in-process would mean an unkillable worker. We run it as a subprocess in its own session so a timeout can kill the entire process group, and we translate its exit codes into things a human can act on.

**The three modes, and when each is right.** This matters enough to be a decision, not a flag:

- **`--skip-text`** (our default). Every page is inspected; pages that already contain text are copied through untouched, and only the image-only pages are OCR'd. This is the only safe default because it is the only mode that cannot damage real digital text. Its failure case is a page containing a single stray text object — a scanner's "Scanned by CamScanner" stamp, a stamped page number — which counts as "has text" and causes the whole page to be skipped, leaving it unsearchable. That is why the preflight text sniff uses a 40-character floor: a page with a stamp and nothing else reads as image-only to us even though ocrmypdf will skip it, and the mode picker in the widget is how the user escapes.
- **`--force-ocr`**. Every page is rasterised to an image and OCR'd, including pages with perfectly good vector text. This *destroys* digital text: crisp outlines become pixels, the file usually grows, and selection quality gets worse, not better. It is right in exactly one situation — a PDF whose visible content is an image but which also carries a broken or nonsensical text layer that `--skip-text` would defer to. We charge double quota for it because it does twice the work.
- **`--redo-ocr`**. Analyses each page's content stream, keeps genuine vector text, and strips and regenerates only the *invisible* OCR text — the signature of a previous bad OCR pass. It is the right answer when someone has already run a bad tool over the document and the existing text layer is garbage. It is slower than `--skip-text` because of the content-stream analysis, it is mutually exclusive with the other two, and it will refuse pages with unusual text-rendering modes rather than guess. That last behaviour is a feature; it fails loudly instead of quietly mangling a page.

**Implementation**

```python
# services/compute/app/ocr/worker.py
from __future__ import annotations

import os
import signal
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from ocrmypdf.exceptions import ExitCode

from app.metrics import counter, histogram
from app.queue import job
from app.storage import job_dir, sign_download

PROGRESS_PLUGIN = "/app/app/ocr/progress_plugin.py"

# Per-page ceiling inside Tesseract. A page that blows this is skipped (image kept,
# no text for that page) instead of failing the whole document.
TESSERACT_TIMEOUT_S = 45
# Whole-job ceiling: fixed startup + a generous per-page budget, hard-capped.
HARD_TIMEOUT_BASE_S = 60
HARD_TIMEOUT_PER_PAGE_S = 14
HARD_TIMEOUT_MAX_S = 900


class OcrFailed(Exception):
    def __init__(self, code: str, human: str) -> None:
        super().__init__(code)
        self.code = code
        self.human = human


@dataclass(frozen=True)
class OcrResult:
    pdf_url: str
    txt_url: str
    filename: str
    pages: int
    seconds: float


@job(queue="ocr")
def run_ocr_job(
    *,
    job_id: str,
    src_path: str,
    langs: str,
    mode: str,
    straighten: bool,
    pages: int,
) -> dict:
    src = Path(src_path)
    out_dir = job_dir(job_id)
    out_pdf = out_dir / "searchable.pdf"
    out_txt = out_dir / "text.txt"

    jobs = max(1, min(int(os.getenv("WORKER_VCPUS", "2")), 4))
    hard_timeout = min(HARD_TIMEOUT_BASE_S + HARD_TIMEOUT_PER_PAGE_S * pages, HARD_TIMEOUT_MAX_S)

    cmd: list[str] = [
        "ocrmypdf",
        f"--{mode}",                       # skip-text | force-ocr | redo-ocr
        "--language", langs,
        "--output-type", "pdf",            # not pdfa: skips the Ghostscript conversion pass entirely
        "--optimize", "1",                 # lossless only; 2 needs pngquant+jbig2enc, 3 is lossy JPEG
        "--jobs", str(jobs),
        "--tesseract-timeout", str(TESSERACT_TIMEOUT_S),
        "--sidecar", str(out_txt),
        "--plugin", PROGRESS_PLUGIN,
        "--quiet",
    ]
    if straighten:
        # --deskew uses Leptonica (no unpaper dependency). --rotate-pages runs Tesseract's
        # orientation detection; together they cost roughly 20% more wall time.
        cmd += ["--deskew", "--rotate-pages", "--rotate-pages-threshold", "8"]
    cmd += [str(src), str(out_pdf)]

    env = {
        **os.environ,
        # The single most important tuning knob: let ocrmypdf own the parallelism.
        # Without this, Tesseract's own OpenMP threads fight --jobs and throughput halves.
        "OMP_THREAD_LIMIT": "1",
        "OCR_JOB_ID": job_id,
        "OCR_TOTAL_PAGES": str(pages),
    }

    t0 = time.monotonic()
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        start_new_session=True,   # own process group, so a timeout can kill the whole tree
    )
    try:
        _, stderr = proc.communicate(timeout=hard_timeout)
        rc = proc.returncode
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        try:
            proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            proc.communicate()
        counter("ocr_failed", code="OCR_TIMEOUT").inc()
        raise OcrFailed(
            "OCR_TIMEOUT",
            "This document took too long to process. Try splitting it into smaller parts, "
            "or upload a lower-resolution scan.",
        )
    finally:
        src.unlink(missing_ok=True)
        Path(str(src).replace(".norm.pdf", "")).unlink(missing_ok=True)

    elapsed = time.monotonic() - t0
    histogram("ocr_seconds", mode=mode).observe(elapsed)
    histogram("ocr_seconds_per_page", mode=mode).observe(elapsed / max(pages, 1))

    if rc != ExitCode.ok:
        counter("ocr_failed", code=str(rc)).inc()
        raise _translate(rc, stderr)

    if not out_pdf.exists() or out_pdf.stat().st_size < 1024:
        raise OcrFailed("INTERNAL", "Something went wrong on our side. Please try again.")

    counter("ocr_succeeded", mode=mode).inc()
    counter("ocr_pages_processed").inc(pages)

    return OcrResult(
        pdf_url=sign_download(out_pdf, ttl=3600),
        txt_url=sign_download(out_txt, ttl=3600),
        filename="searchable.pdf",
        pages=pages,
        seconds=round(elapsed, 1),
    ).__dict__


def _translate(rc: int, stderr: str) -> OcrFailed:
    """ocrmypdf exit code -> something a person can act on."""
    tail = "\n".join(stderr.strip().splitlines()[-8:])
    match rc:
        case ExitCode.encrypted_pdf:
            return OcrFailed("PDF_ENCRYPTED",
                             "This PDF is password-protected. Unlock it in your PDF reader and try again.")
        case ExitCode.already_done_ocr:
            return OcrFailed("ALREADY_SEARCHABLE",
                             "This PDF already has a text layer — try Ctrl+F in your reader.")
        case ExitCode.input_file:
            return OcrFailed("PDF_CORRUPT",
                             "We could not read this PDF. It may be damaged or not really a PDF.")
        case ExitCode.invalid_output_pdf | ExitCode.pdfa_conversion_failed:
            return OcrFailed("OUTPUT_INVALID",
                             "We produced a file but it did not verify as a valid PDF, so we "
                             "have not given it to you. Please report this file.")
        case ExitCode.child_process_error:
            return OcrFailed("TESSERACT_FAILED",
                             "The text recognition step crashed on this document. If it is a very "
                             "large or unusual scan, try splitting it.")
        case ExitCode.missing_dependency | ExitCode.bad_args | ExitCode.invalid_config:
            # Our bug, not theirs. Loud in logs, generic to the user.
            return OcrFailed("INTERNAL", f"Something went wrong on our side. ({rc})\n{tail}")
        case _:
            return OcrFailed("INTERNAL", f"Something went wrong on our side. ({rc})\n{tail}")
```

Dependencies to add in Part A's image and requirements — the language data is the part that needs care:

```dockerfile
# services/compute/Dockerfile  (additions)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ocrmypdf tesseract-ocr tesseract-ocr-eng \
      pngquant unpaper qpdf \
 && rm -rf /var/lib/apt/lists/*

# Debian ships the "fast" (integer) models. For Sinhala and Tamil the accuracy gap
# between fast and best is large enough to matter, so take best from upstream.
ADD --checksum=sha256:REPLACE_ME_SIN \
    https://github.com/tesseract-ocr/tessdata_best/raw/main/sin.traineddata \
    /usr/share/tesseract-ocr/5/tessdata/sin.traineddata
ADD --checksum=sha256:REPLACE_ME_TAM \
    https://github.com/tesseract-ocr/tessdata_best/raw/main/tam.traineddata \
    /usr/share/tesseract-ocr/5/tessdata/tam.traineddata
RUN tesseract --list-langs | grep -qx sin && tesseract --list-langs | grep -qx tam
```

```
# services/compute/requirements.txt (additions)
ocrmypdf==16.10.*
pikepdf==9.*
pypdf==5.*
```

Licence position, restated so nobody has to re-derive it: ocrmypdf is MPL-2.0 and shells out to Ghostscript (AGPL) — we never distribute the image, so hosting is fine, and `--output-type pdf` means Ghostscript is not even on the hot path. pikepdf is MPL-2.0 over qpdf (Apache-2.0). pypdf is BSD-3. Tesseract is Apache-2.0. **PyMuPDF is deliberately absent** — it is AGPL and would infect the service. CodeFormer and LaMa remain never-ship.

**Acceptance criteria**
- [ ] A 3-page image-only fixture produces a PDF whose extracted text contains the known words.
- [ ] `OMP_THREAD_LIMIT=1` is set in the child env — assert it in a unit test on the built command.
- [ ] A job that exceeds its hard timeout leaves no orphan `tesseract` or `gs` process (`pgrep -c tesseract` is 0 ten seconds later).
- [ ] Every `ExitCode` member has a branch in `_translate`; a test iterates the enum and asserts no branch returns the bare default for the ones listed above.
- [ ] Input file and its normalised copy are deleted whether the job succeeds, fails, or times out.
- [ ] `--sidecar` .txt exists and is non-empty on success.

---

### [OCR-04] Real progress from inside the subprocess

**Estimate:** 1.5h · **Depends on:** OCR-03 · **Files:** `services/compute/app/ocr/progress_plugin.py` (new), `services/compute/app/ocr/worker.py` (edit)

**Why.** A minute-long job with a fake progress bar is worse than no bar — people cancel at the point where a made-up animation stalls. ocrmypdf has a proper hook for this: `get_progressbar_class()` lets a plugin substitute its own tqdm-shaped object, which ocrmypdf then drives with real page completions. We load that plugin into the subprocess with `--plugin` and have it write straight into the RQ job's meta, which Part A's status endpoint already returns. The result is a bar that moves when a page is actually finished.

The complication is that ocrmypdf opens *several* progress bars in sequence — scanning, OCR, optimisation — each starting at zero. Mapping them onto one 0–100 bar needs phase weights, because OCR is the overwhelming majority of the time.

**Implementation**

```python
# services/compute/app/ocr/progress_plugin.py
"""ocrmypdf plugin: report real page-level progress into the RQ job's meta.

Loaded with `ocrmypdf --plugin /app/app/ocr/progress_plugin.py`. Runs inside the
ocrmypdf process, so it reads OCR_JOB_ID / REDIS_URL from the environment.
"""
from __future__ import annotations

import os
import time

from ocrmypdf import hookimpl

# ocrmypdf runs these phases in order. Weights are the share of wall time each
# takes on a typical 300 DPI scan, measured on the fixtures; they must sum to 1.0.
_PHASES: list[tuple[str, float]] = [
    ("scan", 0.05),      # "Scanning contents"
    ("ocr", 0.80),       # "OCR"
    ("optimize", 0.13),  # "Optimize" / "Linearizing"
    ("done", 0.02),
]
_OFFSETS: dict[str, tuple[float, float]] = {}
_acc = 0.0
for _name, _w in _PHASES:
    _OFFSETS[_name] = (_acc, _w)
    _acc += _w


def _classify(desc: str | None) -> str:
    d = (desc or "").lower()
    if "ocr" in d:
        return "ocr"
    if "optim" in d or "lineariz" in d:
        return "optimize"
    if "scan" in d:
        return "scan"
    return "ocr"


_HUMAN = {
    "scan": "Reading the document",
    "ocr": "Recognising text",
    "optimize": "Rebuilding the PDF",
    "done": "Finishing",
}


class _Reporter:
    """Writes into rq job meta, throttled to at most 2 writes/second."""

    _shared: "_Reporter | None" = None

    def __init__(self) -> None:
        self.job = None
        self.last_write = 0.0
        self.last_pct = -1
        job_id = os.getenv("OCR_JOB_ID")
        redis_url = os.getenv("REDIS_URL")
        if not job_id or not redis_url:
            return
        try:
            from redis import Redis
            from rq.job import Job

            self.job = Job.fetch(job_id, connection=Redis.from_url(redis_url))
        except Exception:
            self.job = None  # never let telemetry break the actual job

    @classmethod
    def get(cls) -> "_Reporter":
        if cls._shared is None:
            cls._shared = cls()
        return cls._shared

    def write(self, pct: float, phase: str, page: int | None, total: int | None, *, force=False) -> None:
        if self.job is None:
            return
        pct_i = max(0, min(100, int(pct)))
        now = time.monotonic()
        if not force and (now - self.last_write < 0.5 or pct_i == self.last_pct):
            return
        self.last_write, self.last_pct = now, pct_i
        try:
            self.job.meta.update(
                progress=pct_i,
                phase=_HUMAN.get(phase, phase),
                page=page,
                pages=total,
                heartbeat=time.time(),
            )
            self.job.save_meta()
        except Exception:
            pass


class RedisProgressBar:
    """Implements ocrmypdf's ProgressBar protocol (tqdm-shaped)."""

    def __init__(self, *, total=None, desc=None, unit=None, disable=False, **kwargs) -> None:
        self.total = float(total) if total else None
        self.phase = _classify(desc)
        self.n = 0.0
        self.rep = _Reporter.get()

    def __enter__(self) -> "RedisProgressBar":
        self._emit(force=True)
        return self

    def __exit__(self, *exc) -> None:
        self.n = self.total or self.n
        self._emit(force=True)

    def update(self, n=1, *, completed=None, **kwargs) -> None:
        self.n = float(completed) if completed is not None else self.n + float(n or 0)
        self._emit()

    def _emit(self, *, force: bool = False) -> None:
        base, weight = _OFFSETS[self.phase]
        frac = min(self.n / self.total, 1.0) if self.total else 0.0
        pct = (base + weight * frac) * 100
        page = int(self.n) if self.phase == "ocr" and self.total else None
        total = int(self.total) if self.phase == "ocr" and self.total else None
        self.rep.write(pct, self.phase, page, total, force=force)


@hookimpl
def get_progressbar_class():
    return RedisProgressBar
```

Belt and braces in the parent, because a plugin that silently fails to load (an ocrmypdf minor-version change to the hook signature) would leave the bar frozen at 0 rather than obviously broken. The worker watches the heartbeat and falls back to a time-based estimate:

```python
# services/compute/app/ocr/worker.py — replace the plain communicate() with a watched wait
import threading

def _watchdog(job_id: str, pages: int, proc: subprocess.Popen, stop: threading.Event) -> None:
    """If the plugin has not written a heartbeat in 12s, drive an estimated bar instead."""
    from redis import Redis
    from rq.job import Job
    from app.settings import settings

    conn = Redis.from_url(settings.REDIS_URL)
    started = time.monotonic()
    expected = HARD_TIMEOUT_BASE_S / 4 + 1.8 * pages   # measured ~1.8 s/page at --jobs 2
    while not stop.wait(3.0):
        try:
            j = Job.fetch(job_id, connection=conn)
            beat = float(j.meta.get("heartbeat") or 0)
            if time.time() - beat < 12:
                continue                        # real progress is flowing; stay out of the way
            frac = min((time.monotonic() - started) / expected, 0.95)
            j.meta.update(progress=int(frac * 100), phase="Recognising text",
                          estimated=True, heartbeat=time.time())
            j.save_meta()
        except Exception:
            return

# inside run_ocr_job, around communicate():
stop = threading.Event()
threading.Thread(target=_watchdog, args=(job_id, pages, proc, stop), daemon=True).start()
try:
    _, stderr = proc.communicate(timeout=hard_timeout)
finally:
    stop.set()
```

**Acceptance criteria**
- [ ] Running a 20-page fixture, polling status once a second yields a strictly non-decreasing `progress` with at least 8 distinct values.
- [ ] `phase` reads as one of the human strings, never `"OCR"` or a raw tqdm desc.
- [ ] `page`/`pages` are populated during the OCR phase and drive "Page 7 of 20" in the widget.
- [ ] With `--plugin` removed from the command, the watchdog still produces a moving bar and sets `estimated: true`.
- [ ] Killing Redis mid-job does not fail the OCR job — progress simply stops updating.

---

### [OCR-05] Cost control specific to this tool

**Estimate:** 0.5h · **Depends on:** OCR-02, Part A quota/kill-switch · **Files:** `services/compute/app/quota.py` (edit — add the `ocr-pdf` policy), `services/compute/app/killswitch.py` (edit — add the page budget)

**Why.** The planning figure is ≈$8 per 1,000 operations. Here is where that number comes from and what it implies, because the wrong mental model leads to the wrong cap.

**The arithmetic.** Railway bills roughly $0.000463 per vCPU-minute and $0.000231 per GB-minute. Our worker is 2 vCPU / 4 GB.

- *Memory is the floor and it is unavoidable.* 4 GB × $0.000231 × 43,800 min/month = **$40.48/month**, whether we OCR one page or a million.
- *Compute is the marginal cost and it is tiny.* Measured ~1.8 s of vCPU time per page at 300 DPI. A 25-page document = 45 vCPU-seconds = 0.75 vCPU-min = **$0.00035**. Add ~30% for rasterisation and optimisation: **≈$0.00045 per document**, i.e. **$0.45 per 1,000**.
- *Egress is comparable to compute.* Railway egress is $0.05/GB. A 25-page scan comes back around 4 MB, so 1,000 documents ≈ 4 GB out ≈ **$0.20 per 1,000**.

So the true shape is `$40.48 + 0.00065·N` per month. At N = 6,000 documents/month that is $44.40, or **$7.40 per 1,000** — which is where the ≈$8/1,000 planning number comes from. The number is dominated by the always-on floor, not by usage. **More usage makes each operation cheaper, not more expensive.**

That flips what the caps are for. They are not protecting a dollar budget — a single abuser cannot meaningfully move a $40 floor. They are protecting **queue latency**: one worker at `--jobs 2` can process roughly 4,000 pages an hour, so a single person uploading fifty 50-page documents puts everyone else behind a 40-minute wait. The caps are a fairness mechanism with a spend backstop.

**The policy:**

```python
# services/compute/app/quota.py — add
QUOTA_POLICY["ocr-pdf"] = QuotaPolicy(
    unit="page",
    per_ip_per_day=300,       # 6 × 50-page jobs, or 30 × 10-page jobs. Well past honest use.
    per_ip_per_hour=120,
    max_concurrent_per_ip=1,  # one job in flight per person; the rest queue behind their own
    human=(
        "You have used your free pages for today. The limit is 300 pages per day and it "
        "resets at midnight UTC."
    ),
)

# services/compute/app/killswitch.py — add
SPEND_BUDGET["ocr-pdf"] = PageBudget(
    global_pages_per_day=20_000,   # ≈4.5 h of worker wall time/day ≈ $0.25/day compute + ~$0.35 egress
    human="This tool is taking a break — it has had an unusually busy day. Try again tomorrow.",
)
```

20,000 pages/day is the number because it is (a) about 8× the expected steady-state load of ~200 documents/day at 12 pages average, so a genuine traffic spike does not trip it, and (b) still under half of what one worker can physically chew through in 24 hours, so tripping it means something is wrong rather than something is popular. Combined with the queue-depth reject at 40 from OCR-02, the worst case a single attacker can produce is a full queue for a few minutes and about $0.60 of compute.

**Acceptance criteria**
- [ ] A synthetic client submitting 301 pages in a day gets 429 `QUOTA_EXCEEDED` with a `resets_at` timestamp.
- [ ] Setting `global_pages_per_day=1` makes the next submit return 503 `SERVICE_PAUSED` and the widget renders the human sentence, not "503".
- [ ] `/metrics` exposes `ocr_pages_processed`, `ocr_seconds_per_page`, and current global page budget consumption.
- [ ] A Railway usage alert is configured at $70/month.

---

### [OCR-06] The client widget

**Estimate:** 3h · **Depends on:** OCR-02, OCR-04, Part A `useJobStatus` / `getTicket` · **Files:** `src/components/tools/widgets/ocr-pdf.tsx` (new), `src/components/tools/widgets/ocr-pdf.loader.tsx` (new), `src/lib/tools/errors.ts` (new)

**Why.** Two Next 14 constraints shape the file layout, and both bite if you ignore them. First, `next/dynamic(..., { ssr: false })` throws when called from a Server Component, and `registry.ts` is imported by the server-rendered tool page — so the dynamic import needs its own `'use client'` module, which is why there is a `.loader.tsx`. Second, `fetch()` has no upload-progress event, and a 25 MB upload on a Sri Lankan mobile connection takes long enough that a missing progress bar reads as a hang — so the upload uses `XMLHttpRequest`. Neither is a preference.

The other half of this ticket is the error surface. Nine things can go wrong and every one of them must arrive as a sentence with a next action.

**Implementation**

```tsx
// src/components/tools/widgets/ocr-pdf.loader.tsx
'use client'
import dynamic from 'next/dynamic'

const OcrPdfWidget = dynamic(() => import('./ocr-pdf'), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] animate-pulse rounded-xl border border-dashed bg-muted/30" />
  ),
})

export default OcrPdfWidget
```

```ts
// src/lib/tools/errors.ts
export type ToolError = { title: string; detail: string; retryable: boolean }

const MAP: Record<string, ToolError> = {
  NOT_A_PDF:          { title: "That's not a PDF", detail: 'The file has to be a real PDF. If you have a JPG or a Word file, export it to PDF first.', retryable: true },
  FILE_TOO_LARGE:     { title: 'That file is too big', detail: 'The limit is 25 MB. Scanning at 200 DPI instead of 600 usually gets a file well under it.', retryable: true },
  TOO_MANY_PAGES:     { title: 'Too many pages', detail: 'The limit is 50 pages per upload. Split the document and run the parts separately.', retryable: true },
  PDF_ENCRYPTED:      { title: 'This PDF is password-protected', detail: 'We cannot open it, and we will never ask you for the password. Remove the protection in your PDF reader and upload the unlocked copy.', retryable: true },
  PDF_CORRUPT:        { title: 'We could not read this PDF', detail: 'The file looks damaged. Try opening it in your PDF reader and re-saving it, then upload that copy.', retryable: true },
  PDF_EMPTY:          { title: 'This PDF has no pages', detail: 'The file opened, but there is nothing in it.', retryable: true },
  ALREADY_SEARCHABLE: { title: 'This one is already searchable', detail: 'Press Ctrl+F in your PDF reader and search for a word you can see — it should find it. If the text you get back is nonsense, pick "replace an existing bad text layer" below and try again.', retryable: true },
  TICKET_EXPIRED:     { title: 'That took a bit too long', detail: 'Your upload slot expired for security reasons. Nothing is wrong — press the button again.', retryable: true },
  TICKET_USED:        { title: 'That upload slot was already used', detail: 'Press the button again to get a fresh one.', retryable: true },
  TURNSTILE_FAILED:   { title: 'The robot check did not pass', detail: 'Reload the page and try once more. If you are on a VPN, turning it off usually fixes this.', retryable: true },
  QUOTA_EXCEEDED:     { title: 'You have used today\u2019s free pages', detail: 'The limit is 300 pages a day. It resets at midnight UTC.', retryable: false },
  QUEUE_FULL:         { title: 'Everyone is using this at once', detail: 'The queue is full right now. Give it two or three minutes and try again.', retryable: true },
  SERVICE_PAUSED:     { title: 'This tool is taking a break', detail: 'It has had an unusually busy day and has paused itself. Try again tomorrow.', retryable: false },
  OCR_TIMEOUT:        { title: 'This document took too long', detail: 'It was still working after 15 minutes, so we stopped. Splitting it in half almost always works.', retryable: true },
  TESSERACT_FAILED:   { title: 'The text recognition step crashed', detail: 'Something about this scan broke the engine. If you can, try re-scanning the page it stopped on.', retryable: true },
  OUTPUT_INVALID:     { title: 'The result did not come out right', detail: 'We produced a file but it failed our own check, so we are not giving you a broken PDF. Sorry \u2014 please tell me about this one.', retryable: false },
  NETWORK:            { title: 'The upload did not finish', detail: 'The connection dropped partway through. Check your signal and try again.', retryable: true },
  INTERNAL:           { title: 'Something went wrong on our side', detail: 'Not your file \u2014 our bug. Try once more; if it happens again, please tell me.', retryable: true },
}

export function humanError(code: string | null | undefined): ToolError {
  return (code && MAP[code]) || MAP.INTERNAL
}
```

```tsx
// src/components/tools/widgets/ocr-pdf.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTicket } from '@/lib/tools/ticket'
import { useJobStatus } from '@/lib/tools/use-job-status'
import { humanError, type ToolError } from '@/lib/tools/errors'

const MAX_BYTES = 25 * 1024 * 1024
const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY!

type Mode = 'skip-text' | 'force-ocr' | 'redo-ocr'
type Phase = 'idle' | 'uploading' | 'working' | 'done' | 'error'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'error-callback': () => void; theme: 'auto' }) => string
      reset: (id?: string) => void
    }
  }
}

export default function OcrPdfWidget() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<Mode>('skip-text')
  const [langs, setLangs] = useState<string[]>(['eng'])
  const [straighten, setStraighten] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [uploadPct, setUploadPct] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [dragging, setDragging] = useState(false)

  const turnstileToken = useRef<string | null>(null)
  const turnstileBox = useRef<HTMLDivElement>(null)
  const turnstileId = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  const job = useJobStatus(jobId)

  // ---- Turnstile: explicit render so it mounts exactly once, in this component. ----
  useEffect(() => {
    const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    const mount = () => {
      if (!turnstileBox.current || !window.turnstile || turnstileId.current) return
      turnstileId.current = window.turnstile.render(turnstileBox.current, {
        sitekey: TURNSTILE_SITEKEY,
        theme: 'auto',
        callback: (t) => { turnstileToken.current = t },
        'error-callback': () => { turnstileToken.current = null },
      })
    }
    if (window.turnstile) { mount(); return }
    const s = document.createElement('script')
    s.src = SRC; s.async = true; s.defer = true
    s.onload = mount
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (job.status === 'failed') { setError(humanError(job.errorCode)); setPhase('error') }
    if (job.status === 'done') setPhase('done')
  }, [job.status, job.errorCode])

  // ---- Client-side validation: cheap checks before we spend anyone's bandwidth. ----
  const accept = useCallback(async (f: File): Promise<ToolError | null> => {
    if (f.size > MAX_BYTES) return humanError('FILE_TOO_LARGE')
    if (f.size < 100) return humanError('PDF_CORRUPT')
    // Trust the bytes, not the extension or the MIME type the OS guessed.
    const head = new Uint8Array(await f.slice(0, 5).arrayBuffer())
    const magic = String.fromCharCode(...head)
    if (magic !== '%PDF-') return humanError('NOT_A_PDF')
    return null
  }, [])

  const pick = useCallback(async (f: File | undefined | null) => {
    if (!f) return
    const bad = await accept(f)
    if (bad) { setError(bad); setPhase('error'); return }
    setFile(f); setError(null); setPhase('idle'); setUploadPct(0); setJobId(null)
  }, [accept])

  const reset = () => {
    xhrRef.current?.abort()
    setFile(null); setJobId(null); setError(null); setPhase('idle'); setUploadPct(0)
    if (inputRef.current) inputRef.current.value = ''
    window.turnstile?.reset(turnstileId.current ?? undefined)
    turnstileToken.current = null
  }

  const start = async () => {
    if (!file) return
    setError(null); setPhase('uploading'); setUploadPct(0)

    let ticket: string, computeBase: string
    try {
      if (!turnstileToken.current) throw Object.assign(new Error(), { code: 'TURNSTILE_FAILED' })
      const t = await getTicket('ocr-pdf', turnstileToken.current)
      ticket = t.ticket; computeBase = t.computeBase
    } catch (e: any) {
      setError(humanError(e?.code ?? 'TURNSTILE_FAILED')); setPhase('error')
      window.turnstile?.reset(turnstileId.current ?? undefined)
      turnstileToken.current = null
      return
    }

    const body = new FormData()
    body.append('file', file)
    body.append('langs', langs.join('+'))
    body.append('mode', mode)
    body.append('straighten', String(straighten))

    // XHR, not fetch: fetch cannot report upload progress, and a 25 MB upload
    // with no feedback is indistinguishable from a hang.
    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('POST', `${computeBase}/v1/ocr/submit`)
    xhr.setRequestHeader('X-Tool-Ticket', ticket)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () => { setError(humanError('NETWORK')); setPhase('error') }
    xhr.ontimeout = () => { setError(humanError('NETWORK')); setPhase('error') }
    xhr.onload = () => {
      let payload: any = {}
      try { payload = JSON.parse(xhr.responseText) } catch { /* fall through to INTERNAL */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload.job_id) {
        setJobId(payload.job_id); setPhase('working'); return
      }
      setError(humanError(payload?.detail?.code)); setPhase('error')
      window.turnstile?.reset(turnstileId.current ?? undefined)
      turnstileToken.current = null
    }
    xhr.timeout = 180_000
    xhr.send(body)
  }

  const busy = phase === 'uploading' || phase === 'working'

  return (
    <div className="rounded-xl border bg-card p-5 sm:p-6">
      {/* ---------- drop zone ---------- */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void pick(e.dataTransfer.files?.[0]) }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          role="button"
          tabIndex={0}
          aria-label="Choose a PDF to make searchable"
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          )}
        >
          <Upload className="size-7 text-muted-foreground" aria-hidden />
          <p className="font-medium">Drop a scanned PDF here, or click to choose one</p>
          <p className="text-sm text-muted-foreground">Up to 50 pages and 25 MB. Nothing is stored after an hour.</p>
        </div>
      )}
      <input
        ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
        onChange={(e) => void pick(e.target.files?.[0])}
      />

      {/* ---------- chosen file + options ---------- */}
      {file && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            {!busy && (
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Remove this file">
                <X className="size-4" />
              </Button>
            )}
          </div>

          {phase !== 'done' && (
            <fieldset disabled={busy} className="space-y-4">
              <div>
                <legend className="mb-2 text-sm font-medium">Language in the document</legend>
                <div className="flex flex-wrap gap-2">
                  {([['eng', 'English'], ['sin', 'සිංහල'], ['tam', 'தமிழ்']] as const).map(([code, label]) => {
                    const on = langs.includes(code)
                    return (
                      <button
                        key={code} type="button" aria-pressed={on}
                        onClick={() => setLangs((prev) => {
                          const next = on ? prev.filter((l) => l !== code) : [...prev, code]
                          return next.length === 0 ? prev : next.slice(-2)
                        })}
                        className={cn('rounded-full border px-3 py-1 text-sm transition-colors',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
                      >{label}</button>
                    )
                  })}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Pick only what is actually in the document — a second language makes it slower and less accurate.
                </p>
              </div>

              <div>
                <label htmlFor="ocr-mode" className="mb-2 block text-sm font-medium">What to do with pages that already have text</label>
                <select
                  id="ocr-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="skip-text">Leave them alone (recommended)</option>
                  <option value="redo-ocr">Replace an existing bad text layer</option>
                  <option value="force-ocr">Redo every page from scratch (slowest)</option>
                </select>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={straighten}
                       onChange={(e) => setStraighten(e.target.checked)} />
                <span>
                  Fix crooked or sideways scans
                  <span className="block text-xs text-muted-foreground">
                    Straightens and rotates the pages before reading them. Helps a lot with phone photos; takes about 20% longer.
                  </span>
                </span>
              </label>

              <div ref={turnstileBox} className="min-h-[65px]" />

              <Button onClick={start} disabled={busy} className="w-full sm:w-auto">
                {busy && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
                {busy ? 'Working…' : 'Make it searchable'}
              </Button>
            </fieldset>
          )}
        </div>
      )}

      {/* ---------- progress ---------- */}
      {busy && (
        <div className="mt-5" role="status" aria-live="polite">
          <div className="mb-1.5 flex justify-between text-sm">
            <span>
              {phase === 'uploading'
                ? 'Uploading your file'
                : job.status === 'queued'
                  ? 'Waiting for a free slot'
                  : job.phase ?? 'Recognising text'}
              {job.page && job.pages ? ` — page ${job.page} of ${job.pages}` : ''}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {phase === 'uploading' ? `${uploadPct}%` : `${job.progress ?? 0}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${phase === 'uploading' ? uploadPct : (job.progress ?? 0)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            A 20-page scan usually takes about 40 seconds. You can leave this tab open in the background.
          </p>
        </div>
      )}

      {/* ---------- result ---------- */}
      {phase === 'done' && job.result && (
        <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="font-medium">Done — {job.result.pages} pages in {job.result.seconds} seconds.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open the PDF and press Ctrl+F to check it. Both links stop working in an hour.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild><a href={job.result.pdf_url} download="searchable.pdf">Download searchable PDF</a></Button>
            <Button variant="outline" asChild><a href={job.result.txt_url} download="text.txt">Download the text (.txt)</a></Button>
            <Button variant="ghost" onClick={reset}>Do another one</Button>
          </div>
        </div>
      )}

      {/* ---------- error ---------- */}
      {phase === 'error' && error && (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4" role="alert">
          <p className="font-medium">{error.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.detail}</p>
          {error.retryable && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setPhase(file ? 'idle' : 'idle')}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Acceptance criteria**
- [ ] `pnpm build` passes with `strict` — no `any` outside the deliberately-untyped XHR JSON parse.
- [ ] Renaming `photo.jpg` to `photo.pdf` and uploading it produces "That's not a PDF" *without* a network request (verify in the Network tab).
- [ ] The upload bar reflects real bytes: throttle to Slow 3G and watch it climb smoothly.
- [ ] After upload completes, the bar switches to job progress and shows "page N of M".
- [ ] Every code in `errors.ts` has been rendered at least once during manual testing (force each by editing the server response).
- [ ] Keyboard-only: tab to the drop zone, Enter opens the file picker; the progress region announces via `aria-live`.
- [ ] Lighthouse on `/tools/scanned-pdf-to-searchable-pdf` — no CLS from the Turnstile mount (the `min-h-[65px]` reservation).

---

### [OCR-07] Honest limits, rendered on the page

**Estimate:** 0.5h · **Depends on:** Sprint 1 `tool-shell.tsx` · **Files:** `src/lib/tools/types.ts` (edit), `src/components/tools/tool-shell.tsx` (edit)

**Why.** The `caveats` copy written in OCR-01 needs somewhere to live, and it needs to sit *above* "How it works", immediately under the widget — the position where someone who just got a mediocre result will actually look. Putting it there is not a confidence problem; it is the opposite. A tool that tells you in advance that Sinhala is weaker than English and that handwriting will not work reads as written by someone who has used it. A tool that says "99% accuracy!" and then hands you garbage reads as a scam. The framing rule for this section: state the limit, give the number, give the workaround. Never apologise.

**Implementation**

```ts
// src/lib/tools/types.ts — one optional field, so no existing tool breaks
export interface ToolDef {
  // ...existing
  /** Honest limitations, rendered under the widget. Required for runsOn !== 'browser'. */
  caveats?: string
}
```

```tsx
// src/components/tools/tool-shell.tsx — between <Widget /> and "How it works"
{tool.caveats && (
  <section aria-labelledby="caveats-h" className="mt-10 rounded-lg border-l-4 border-amber-500/60 bg-amber-500/5 p-5">
    <h2 id="caveats-h" className="mb-2 text-lg font-semibold">How good is this, really?</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{tool.caveats}</p>
  </section>
)}
```

```ts
// src/lib/tools/validate.ts — add
for (const t of TOOLS) {
  if (t.runsOn !== 'browser' && (t.caveats ?? '').split(/\s+/).length < 120) {
    throw new Error(`[tools] ${t.slug}: server-side tools must document their limits in caveats (>=120 words)`)
  }
}
```

**Acceptance criteria**
- [ ] The build throws if a `runsOn: 'railway'` tool omits `caveats` or writes fewer than 120 words.
- [ ] The section renders above "How it works" and is present in `view-source`.
- [ ] No existing Sprint 1–3 tool fails the new check.

---

### [OCR-08] pytest suite with generated fixtures

**Estimate:** 2h · **Depends on:** OCR-02, OCR-03 · **Files:** `services/compute/tests/conftest.py` (new), `services/compute/tests/test_ocr_worker.py` (new), `services/compute/tests/test_ocr_preflight.py` (new), `services/compute/pytest.ini` (edit)

**Why.** The one assertion that matters is *does the output actually have a text layer* — everything else is plumbing you can eyeball. Fixtures are **generated in `conftest.py`, not committed**, for three reasons: binary fixtures rot invisibly, a committed encrypted PDF looks alarming in a repo, and generated ones let us assert on known content ("the word INVOICE is on page 2") instead of hoping.

**How the fixtures are generated.** Pillow renders known text to a 300 DPI image and saves it as a PDF — this produces a genuinely image-only PDF, because Pillow's PDF writer emits nothing but an image XObject. pikepdf builds the encrypted, corrupt and oversized variants. No fixture is downloaded and none is committed.

```python
# services/compute/tests/conftest.py
from __future__ import annotations

import io
import re
import shutil
from pathlib import Path

import pikepdf
import pytest
from PIL import Image, ImageDraw, ImageFont

DPI = 300
PAGE_PX = (int(8.27 * DPI), int(11.69 * DPI))  # A4 at 300 DPI
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

needs_ocrmypdf = pytest.mark.skipif(
    shutil.which("ocrmypdf") is None, reason="ocrmypdf not installed (run inside the image)"
)


def _render_page(lines: list[str]) -> Image.Image:
    """A white A4 page with big black text. Deliberately easy: we are testing our
    pipeline, not Tesseract's accuracy floor."""
    img = Image.new("RGB", PAGE_PX, "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, 64)
    y = 300
    for line in lines:
        draw.text((250, y), line, fill="black", font=font)
        y += 110
    return img


@pytest.fixture(scope="session")
def fixtures(tmp_path_factory) -> dict[str, Path]:
    d = tmp_path_factory.mktemp("pdfs")
    out: dict[str, Path] = {}

    # 1. Image-only 3-page scan. The words below are what we assert on later.
    pages = [
        _render_page(["INVOICE 4471", "Colombo 00700"]),
        _render_page(["Description", "Consulting services"]),
        _render_page(["Total due", "LKR 128500"]),
    ]
    p = d / "scanned_3page.pdf"
    pages[0].save(p, "PDF", resolution=DPI, save_all=True, append_images=pages[1:])
    out["scanned"] = p

    # 2. Born-digital text PDF (real vector text, no images).
    p = d / "has_text.pdf"
    with pikepdf.Pdf.new() as pdf:
        pdf.add_blank_page(page_size=(595, 842))
        # Minimal content stream with a Helvetica text object.
        stream = pikepdf.Stream(pdf, b"BT /F1 24 Tf 72 700 Td (BORNDIGITAL invoice 4471) Tj ET")
        font = pdf.make_indirect(pikepdf.Dictionary(
            Type=pikepdf.Name.Font, Subtype=pikepdf.Name.Type1, BaseFont=pikepdf.Name.Helvetica))
        pdf.pages[0].Contents = pdf.make_indirect(stream)
        pdf.pages[0].Resources = pikepdf.Dictionary(Font=pikepdf.Dictionary(F1=font))
        pdf.save(p)
    out["has_text"] = p

    # 3. Encrypted with a real user password.
    p = d / "encrypted.pdf"
    with pikepdf.open(out["has_text"]) as pdf:
        pdf.save(p, encryption=pikepdf.Encryption(user="hunter2", owner="hunter2", R=6))
    out["encrypted"] = p

    # 4. Owner-password only: opens without a password, but restricts printing.
    p = d / "owner_locked.pdf"
    with pikepdf.open(out["scanned"]) as pdf:
        pdf.save(p, encryption=pikepdf.Encryption(
            user="", owner="secret", R=6, allow=pikepdf.Permissions(print_lowres=False)))
    out["owner_locked"] = p

    # 5. Corrupt cross-reference table: point startxref at nonsense.
    raw = out["has_text"].read_bytes()
    broken = re.sub(rb"startxref\s+\d+", b"startxref\n999999", raw)
    p = d / "corrupt_xref.pdf"
    p.write_bytes(broken)
    out["corrupt"] = p

    # 6. Sixty pages, to exercise the page cap without OCR'ing anything.
    p = d / "too_many_pages.pdf"
    with pikepdf.Pdf.new() as pdf:
        for _ in range(60):
            pdf.add_blank_page(page_size=(595, 842))
        pdf.save(p)
    out["too_many"] = p

    return out
```

```python
# services/compute/tests/test_ocr_preflight.py
import pytest
from app.ocr.preflight import PreflightError, preflight_pdf


def test_scanned_pdf_has_no_text_layer(fixtures):
    info = preflight_pdf(fixtures["scanned"], max_pages=50)
    assert info.pages == 3
    assert info.text_ratio == 0.0


def test_born_digital_is_detected_as_searchable(fixtures):
    info = preflight_pdf(fixtures["has_text"], max_pages=50)
    assert info.text_ratio >= 0.9


def test_user_password_pdf_is_rejected(fixtures):
    with pytest.raises(PreflightError) as e:
        preflight_pdf(fixtures["encrypted"], max_pages=50)
    assert e.value.code == "PDF_ENCRYPTED"
    assert "password" in e.value.human.lower()


def test_owner_locked_pdf_is_accepted_and_unlocked(fixtures):
    import pikepdf
    info = preflight_pdf(fixtures["owner_locked"], max_pages=50)
    assert info.pages == 3
    with pikepdf.open(info.normalised_path) as pdf:
        assert not pdf.is_encrypted          # we stripped the restriction to do the work


def test_corrupt_xref_is_repaired(fixtures):
    info = preflight_pdf(fixtures["corrupt"], max_pages=50)
    assert info.pages == 1


def test_page_cap(fixtures):
    with pytest.raises(PreflightError) as e:
        preflight_pdf(fixtures["too_many"], max_pages=50)
    assert e.value.code == "TOO_MANY_PAGES"
    assert "60 pages" in e.value.human
```

```python
# services/compute/tests/test_ocr_worker.py
import pypdf
import pytest
from conftest import needs_ocrmypdf

from app.ocr.preflight import preflight_pdf
from app.ocr.worker import OcrFailed, run_ocr_job


def _text_of(path) -> str:
    r = pypdf.PdfReader(str(path))
    return " ".join((p.extract_text() or "") for p in r.pages).upper()


@needs_ocrmypdf
def test_output_actually_has_a_text_layer(fixtures, tmp_path, monkeypatch):
    monkeypatch.setenv("WORKER_VCPUS", "2")
    info = preflight_pdf(fixtures["scanned"], max_pages=50)
    res = run_ocr_job.fn(                       # .fn bypasses the queue decorator
        job_id="test-1", src_path=str(info.normalised_path),
        langs="eng", mode="skip-text", straighten=False, pages=3,
    )
    out = tmp_path.parent / "test-1" / "searchable.pdf"
    text = _text_of(out)
    # Tesseract will not be character-perfect; assert on distinctive tokens.
    for token in ("INVOICE", "4471", "COLOMBO", "TOTAL"):
        assert token in text, f"{token!r} missing from {text[:400]!r}"
    assert res["pages"] == 3
    assert res["seconds"] > 0


@needs_ocrmypdf
def test_sidecar_text_file_is_written(fixtures, tmp_path):
    info = preflight_pdf(fixtures["scanned"], max_pages=50)
    run_ocr_job.fn(job_id="test-2", src_path=str(info.normalised_path),
                   langs="eng", mode="skip-text", straighten=False, pages=3)
    txt = (tmp_path.parent / "test-2" / "text.txt").read_text().upper()
    assert "INVOICE" in txt


@needs_ocrmypdf
def test_encrypted_pdf_fails_with_a_human_message(fixtures):
    # Bypass preflight deliberately: this asserts the worker's own ExitCode mapping,
    # which is the last line of defence if preflight ever changes.
    with pytest.raises(OcrFailed) as e:
        run_ocr_job.fn(job_id="test-3", src_path=str(fixtures["encrypted"]),
                       langs="eng", mode="skip-text", straighten=False, pages=1)
    assert e.value.code == "PDF_ENCRYPTED"
    assert "password" in e.value.human.lower()
    assert "exit" not in e.value.human.lower()   # never leak a status code to a person


@needs_ocrmypdf
def test_skip_text_leaves_digital_text_untouched(fixtures):
    info = preflight_pdf(fixtures["has_text"], max_pages=50)
    run_ocr_job.fn(job_id="test-4", src_path=str(info.normalised_path),
                   langs="eng", mode="skip-text", straighten=False, pages=1)
    ...
    assert "BORNDIGITAL" in _text_of(...)        # not re-rasterised, still exact


def test_command_sets_omp_thread_limit(monkeypatch, fixtures):
    """Cheap, fast, and guards the single biggest performance regression."""
    captured = {}
    import app.ocr.worker as w

    class FakePopen:
        def __init__(self, cmd, **kw):
            captured["cmd"], captured["env"] = cmd, kw["env"]
            self.returncode = 0
        def communicate(self, timeout=None): return ("", "")
    monkeypatch.setattr(w.subprocess, "Popen", FakePopen)
    monkeypatch.setattr(w.os, "getpgid", lambda pid: 0)
    with pytest.raises(Exception):     # output file will not exist; we only care about the cmd
        w.run_ocr_job.fn(job_id="t", src_path=str(fixtures["scanned"]),
                         langs="eng+sin", mode="skip-text", straighten=True, pages=3)
    assert captured["env"]["OMP_THREAD_LIMIT"] == "1"
    assert "--skip-text" in captured["cmd"]
    assert "--deskew" in captured["cmd"] and "--rotate-pages" in captured["cmd"]
    assert captured["cmd"][captured["cmd"].index("--language") + 1] == "eng+sin"
```

```ini
# services/compute/pytest.ini
[pytest]
testpaths = tests
addopts = -q --strict-markers
markers =
    slow: needs a real OCR run (~30s)
```

Run with `docker compose run --rm compute pytest`. The OCR tests take about 40 seconds total; that is acceptable and they run in CI on every push to `services/compute/**`.

**Acceptance criteria**
- [ ] `pytest` is green inside the image and skips cleanly (not errors) outside it.
- [ ] `test_output_actually_has_a_text_layer` fails if `--skip-text` is swapped for a no-op — verify by breaking it on purpose once.
- [ ] No fixture files are committed; `git status` is clean after a full run.
- [ ] CI job added: build the compute image, run pytest, fail the PR on red.

---

### Deferred from this sprint

- **PDF/A output.** `--output-type pdfa` is what archival submissions actually want, but it puts Ghostscript back on the hot path, roughly doubles wall time, and adds `pdfa_conversion_failed` as a new failure mode with its own copy. One toggle, one paragraph of explanation, one more test. Sprint 5.
- **`--optimize 2` with jbig2enc.** Would meaningfully shrink bitonal scans, but jbig2enc needs building from source in the Dockerfile and there is a small correctness risk with symbol-mode compression on text. Not worth the image-build time this sprint.
- **Client-side page count before upload.** Would let us say "this is 200 pages, split it" without a 25 MB upload. Doing it properly needs a PDF parser in the browser; doing it by regex over the raw bytes fails on object streams. The server rejects in under 500 ms, which is good enough for now.
- **Resumable / chunked upload.** A dropped connection at 90% of 25 MB on mobile means starting over. tus or a chunked endpoint is the right answer and it is a sprint of its own.
- **A results page with a per-page confidence heatmap.** Tesseract returns per-word confidence and it would be genuinely useful to show which pages came out badly. Needs the hOCR sidecar, a parser and a viewer. Sprint 6 at the earliest.
- **More languages.** `hin`, `ara`, `chi_sim` are one apt package each, but each one needs its own accuracy caveat written honestly, and I cannot evaluate scripts I cannot read.

### Definition of Done

- [ ] `/tools/scanned-pdf-to-searchable-pdf` is statically generated, imports nothing from `@db`, and its copy is in the server HTML.
- [ ] `pnpm build` and `pytest` both green in CI.
- [ ] A 10-page real-world scan (not a fixture — use an actual bank statement or a photocopied form) round-trips: upload → progress bar that moves per page → download → Ctrl+F finds a word you can see.
- [ ] The same file in Sinhala round-trips and the .txt is recognisably Sinhala, with errors.
- [ ] All nine server error codes render as a title-plus-sentence in the widget; none shows a number.
- [ ] Quota is charged in pages, enforced at 300/IP/day, and the kill switch trips at 20,000 pages/day.
- [ ] Uploads and results are gone from the worker filesystem within an hour — verified by `ls` on the volume, not by trusting the cron.
- [ ] `/metrics` shows `ocr_seconds_per_page`; the p95 is under 4 s.
- [ ] Railway spend alert set at $70/month.
- [ ] The `caveats` section is live and says out loud that Sinhala is the weakest of the three.
- [ ] `status: 'beta'` on launch; flip to `'live'` after seven days with no `INTERNAL` errors in logs.

### Demo script

1. **Happy path.** Open `/tools/scanned-pdf-to-searchable-pdf` on a phone. Drop in a 12-page scanned PDF, leave English selected, press *Make it searchable*. Watch the upload bar reach 100%, then the job bar move through "page 3 of 12", "page 7 of 12". Download. Open in a PDF reader, Ctrl+F a word visible on page 9 — it highlights.
2. **Prove the text layer is invisible, not drawn.** Put the original and the result side by side at 400% zoom. They are pixel-identical. Select a line in the result and paste it into a text editor.
3. **Break the ticket.** In DevTools, set a breakpoint after `getTicket` and edit the ticket string to change one character. Resume. Expect: *"That upload slot was already used"* — the signature check rejects it, no file is uploaded, no quota is charged, and Turnstile resets so the retry works.
4. **Replay the ticket.** Capture a valid submit in the Network tab, then `Copy as cURL` and run it twice. First call returns a `job_id`; second returns 401 `TICKET_USED` — the `jti` was burned in Redis.
5. **Trip the kill switch.** `railway run redis-cli SET killswitch:ocr-pdf:pages 20000`, then submit anything. Expect a 503 and the widget showing *"This tool is taking a break"* — no stack trace, no status code. Reset the key and confirm it works again immediately.
6. **Hit the caps.** Upload the 60-page fixture: rejected in under half a second with *"Too many pages"*, and no job appears in the RQ dashboard. Upload the password-protected fixture: *"This PDF is password-protected"*, and confirm the app never renders a password field.
7. **Kill the worker mid-job.** Start a 40-page job, and when the bar reaches ~40% run `railway service restart` on the worker. The job goes to `failed`, the widget shows *"Something went wrong on our side"* with a working retry, and `pgrep tesseract` on the new container returns nothing.
8. **Check the money.** After the demo, open Railway usage. Confirm the vCPU-minutes consumed match roughly 1.8 s per page processed, and that the memory line — not the compute line — is the bigger number. That is the whole cost model in one screenshot.
