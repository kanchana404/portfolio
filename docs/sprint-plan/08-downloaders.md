> Part of [SPRINT-PLAN.md](SPRINT-PLAN.md). **Part II (Amendments) overrides anything below it.**

## Sprint 8 — The downloader platform (separate domain, separate Railway project)

**Sprint goal** — Ship resolve-and-download for TikTok, Instagram, Facebook, X, Reddit and Pinterest (plus YouTube audio) on their own domain and their own Railway project, architected so the majority of downloads move zero bytes through infrastructure Kavitha pays for.

**Duration** — 2 weeks (38h estimated). **Depends on** — Sprint 0 (done, `tools-platform-phase0`). The Railway compute foundation sprint that established the signed-ticket → job-queue → R2-presign pattern (referred to below as *the compute foundation*); this sprint reuses its **shape** but shares none of its **resources**. Nothing here depends on the tools registry, and no code in this sprint may be imported by `kavithakanchana.me`.

The risk, stated once: downloader traffic attracts DMCA notices, platform-side IP blocks, and occasional host or registrar suspension, and no amount of engineering makes that probability zero. The decision to build is made, so the only remaining engineering question is blast radius — every choice below exists so that the worst realistic outcome is losing one domain and one Railway project while the portfolio, its Mongo cluster, its Vercel account and its search presence stay untouched.

---

### Blast-radius isolation (read once, then it's just a checklist)

A suspension is rarely surgical. When a provider acts, it acts on the **account**, not the service — Railway suspends projects under the same team, Cloudflare disables the zone and often flags the account, an R2 abuse strike lands on the account that owns the bucket, and a registrar lock takes the whole registrar relationship with it. Sharing a Redis instance between the portfolio's tools and the downloader means a Railway account suspension takes out the churn-cohort tracker too; sharing an R2 bucket means one takedown on a cached MP4 puts a strike on the same account that serves the portfolio's OG assets. So: separate Railway **project** under a separate Railway account, separate Cloudflare account holding only the downloader zone and its own R2 bucket, separate domain bought at a different registrar with WHOIS privacy, separate Upstash Redis, separate Vercel project (ideally separate Vercel account) for the frontend, separate GitHub repos, separate abuse@ mailbox. The only thing shared is the engineer.

**Cost model at the tiers this sprint touches** (verify against live rate cards before the first paid job):

| Path | Bytes through our infra | Cost / 1000 |
|---|---|---|
| Direct CDN handoff (TikTok/IG/FB/X/Reddit/Pinterest) | ~0 (metadata only) | **~$0.10** |
| Worker path, no proxy, MP4 ≤1080p (~45 MB) | full | ~$2 (CPU + R2 PUT; R2 egress free) |
| Worker path, datacenter proxy @ ~$0.20/GB | full | ~$11 |
| Worker path, residential proxy @ ~$4/GB | full | ~$180 |
| YouTube audio-only m4a (~5 MB) on residential | full | **~$20** |

That table is the whole strategy in numbers: the fork in DOWN-02 is worth roughly 20× and YouTube's default in DOWN-11 is worth roughly 9×.

---

### Definition of Ready

- [ ] Domain purchased at a registrar **not** used for `kavithakanchana.me`, WHOIS privacy on, DNS on a **new** Cloudflare account. Placeholder in this doc: `$DL_DOMAIN`; it never appears hardcoded in source, only as env.
- [ ] New Railway account + new project `dl-platform` with services: `api` (FastAPI), `worker` (arq), and later `potp` (PO token provider). Payment method with a **hard monthly cap** set, distinct from the portfolio's.
- [ ] New Cloudflare R2 bucket `dl-artifacts` in the new Cloudflare account. Bucket is **not** public; access is presigned-GET only.
- [ ] New Upstash Redis (or Railway Redis) instance. No connection string is shared with any existing project.
- [ ] Two new private GitHub repos: `dl-api`, `dl-web`. Neither is a fork or subtree of the portfolio repo.
- [ ] Turnstile site key/secret minted on the **new** Cloudflare account.
- [ ] `abuse@$DL_DOMAIN` mailbox live and forwarding somewhere he actually reads. A DMCA notice with no reachable contact escalates to the host by default.
- [ ] Decision recorded: no user accounts, no analytics with per-visitor identity, no download history. This constrains every ticket below.

---

### Tickets

### [DOWN-01] Isolated Railway project, R2 bucket, and API skeleton
**Estimate:** 3h · **Depends on:** Definition of Ready · **Files:** `dl-api/Dockerfile`, `dl-api/pyproject.toml`, `dl-api/app/main.py`, `dl-api/app/settings.py`, `dl-api/app/r2.py`, `dl-api/railway.json`

**Why** — Everything else in the sprint assumes a container that already has yt-dlp, ffmpeg and a Redis handle, and a bucket whose lifecycle rule deletes artifacts before anyone can build a library on top of it. Getting the lifecycle rule in on day one means there is never a window where objects live forever.

**Implementation**

```dockerfile
# dl-api/Dockerfile
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# yt-dlp is installed from the nightly channel and refreshed at boot.
# See DOWN-07: a pinned yt-dlp is dead code within ~10 days.
RUN pip install --no-cache-dir --pre "yt-dlp[default]"

COPY app ./app
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "pip install --upgrade --pre --no-cache-dir 'yt-dlp[default]' >/dev/null 2>&1; \
     uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

```python
# dl-api/app/settings.py
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = Field(alias="REDIS_URL")
    ticket_secret: str = Field(alias="TICKET_SECRET")          # 32+ random bytes, hex
    allowed_origin: str = Field(alias="ALLOWED_ORIGIN")        # https://$DL_DOMAIN

    r2_account_id: str = Field(alias="R2_ACCOUNT_ID")
    r2_access_key_id: str = Field(alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str = Field(alias="R2_SECRET_ACCESS_KEY")
    r2_bucket: str = Field(alias="R2_BUCKET", default="dl-artifacts")

    dc_proxy_url: str | None = Field(alias="DC_PROXY_URL", default=None)
    residential_proxy_url: str | None = Field(alias="RESIDENTIAL_PROXY_URL", default=None)

    max_duration_s: int = Field(alias="MAX_DURATION_S", default=900)
    max_filesize_bytes: int = Field(alias="MAX_FILESIZE_BYTES", default=500 * 1024 * 1024)
    artifact_ttl_s: int = Field(alias="ARTIFACT_TTL_S", default=6 * 3600)
    global_kill_switch: bool = Field(alias="GLOBAL_KILL_SWITCH", default=False)

    class Config:
        populate_by_name = True


@lru_cache
def settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

```python
# dl-api/app/r2.py
import boto3
from botocore.config import Config

from app.settings import settings


def r2_client():
    s = settings()
    return boto3.client(
        "s3",
        endpoint_url=f"https://{s.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=s.r2_access_key_id,
        aws_secret_access_key=s.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


def ensure_lifecycle() -> None:
    """Idempotent. Objects under artifacts/ are deleted 1 day after creation;
    presigned URLs expire in 6h (ARTIFACT_TTL_S), so the bucket is a cache, not a library.
    R2 lifecycle granularity is days, hence the belt-and-braces sweep in DOWN-04."""
    s = settings()
    r2_client().put_bucket_lifecycle_configuration(
        Bucket=s.r2_bucket,
        LifecycleConfiguration={
            "Rules": [
                {
                    "ID": "expire-artifacts",
                    "Status": "Enabled",
                    "Filter": {"Prefix": "artifacts/"},
                    "Expiration": {"Days": 1},
                    "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1},
                }
            ]
        },
    )
```

```python
# dl-api/app/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis

from app.r2 import ensure_lifecycle
from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = settings()
    app.state.redis = Redis.from_url(s.redis_url, decode_responses=True)
    ensure_lifecycle()
    yield
    await app.state.redis.aclose()


app = FastAPI(title="dl-api", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings().allowed_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type", "x-dl-ticket"],
    max_age=600,
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
```

**Acceptance criteria**
- [ ] `railway up` deploys `api`; `GET https://<railway-domain>/healthz` returns `{"status":"ok"}`.
- [ ] `docs_url`/`openapi_url` are `None` — no public API surface map.
- [ ] `aws s3api get-bucket-lifecycle-configuration` (S3-compatible against R2) shows the `expire-artifacts` rule.
- [ ] CORS preflight from `https://$DL_DOMAIN` succeeds; from `https://kavithakanchana.me` it fails.
- [ ] Railway project, Cloudflare account, Redis instance and GitHub repos are all confirmed distinct from the portfolio's, by logging in and looking.
- [ ] Railway spend cap configured; screenshot in the repo's `docs/` (no secrets).

---

### [DOWN-02] The resolve fork — direct CDN handoff vs worker path
**Estimate:** 5h · **Depends on:** DOWN-01 · **Files:** `dl-api/app/platforms.py`, `dl-api/app/resolve.py`, `dl-api/app/routes/resolve.py`

**Why** — This is the sprint. `yt-dlp` gives us a format list without moving a byte; for TikTok, Instagram, Facebook, X, Reddit and Pinterest the winning format is usually a single progressive MP4 on a CDN that any browser can fetch directly. If we hand that URL to the client, our cost is one metadata request (~$0.10/1000) instead of a full transfer through a proxy (~$180/1000). Only two conditions force the worker path: the URL is bound to the requesting IP or needs headers a browser navigation cannot send, or video and audio arrive as separate streams and must be muxed.

**Implementation**

```python
# dl-api/app/platforms.py
from typing import Literal
from urllib.parse import urlparse

Platform = Literal[
    "tiktok", "instagram", "facebook", "x", "reddit", "pinterest", "youtube"
]

_HOST_MAP: dict[str, Platform] = {
    "tiktok.com": "tiktok", "vm.tiktok.com": "tiktok", "vt.tiktok.com": "tiktok",
    "instagram.com": "instagram", "instagr.am": "instagram", "ddinstagram.com": "instagram",
    "facebook.com": "facebook", "fb.watch": "facebook", "m.facebook.com": "facebook",
    "twitter.com": "x", "x.com": "x", "t.co": "x",
    "reddit.com": "reddit", "redd.it": "reddit", "v.redd.it": "reddit",
    "pinterest.com": "pinterest", "pin.it": "pinterest",
    "youtube.com": "youtube", "youtu.be": "youtube", "m.youtube.com": "youtube",
}

# Platforms whose progressive CDN URLs are, in practice, fetchable by an arbitrary client.
# YouTube is deliberately absent: its googlevideo URLs are IP-bound and SABR-gated.
DIRECT_CANDIDATES: frozenset[str] = frozenset(
    {"tiktok", "instagram", "facebook", "x", "reddit", "pinterest"}
)


def detect_platform(url: str) -> Platform | None:
    host = (urlparse(url).hostname or "").lower()
    host = host.removeprefix("www.")
    while host:
        if host in _HOST_MAP:
            return _HOST_MAP[host]
        _, _, host = host.partition(".")
    return None
```

```python
# dl-api/app/resolve.py
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError, ExtractorError

from app.platforms import DIRECT_CANDIDATES, Platform, detect_platform
from app.settings import settings

# Headers a plain browser download (window.location / <a download>) can actually send.
# If a format needs anything outside this set (Referer, Cookie, Origin, X-*),
# a direct handoff will 403 in the user's browser and we must use the worker.
_BROWSER_SENDABLE = {"user-agent", "accept", "accept-language", "accept-encoding", "range"}


class ResolveError(Exception):
    def __init__(self, code: str, message: str, *, status: int = 422) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


@dataclass(slots=True)
class Resolution:
    mode: Literal["direct", "worker"]
    platform: Platform
    title: str
    duration: int | None
    thumbnail: str | None
    ext: str
    filesize_approx: int | None
    direct_url: str | None
    reason: str


def base_ydl_opts(*, proxy: str | None) -> dict[str, Any]:
    s = settings()
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,          # a playlist URL must not become 200 jobs
        "playlist_items": "1",       # belt and braces: extractors that ignore noplaylist
        "skip_download": True,
        "socket_timeout": 15,
        "retries": 2,
        "extractor_retries": 2,
        "fragment_retries": 2,
        "max_filesize": s.max_filesize_bytes,
        "cachedir": "/tmp/ytdlp-cache",
        "proxy": proxy,
        "source_address": None,
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
            )
        },
    }


def _extract_sync(url: str, opts: dict[str, Any]) -> dict[str, Any]:
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if info is None:
        raise ResolveError("no_media", "No downloadable media found at that URL.")
    return ydl.sanitize_info(info)  # strips non-serializable internals


def _reject_playlists(info: dict[str, Any]) -> dict[str, Any]:
    if info.get("_type") == "playlist":
        entries = [e for e in (info.get("entries") or []) if e]
        if len(entries) != 1:
            raise ResolveError(
                "playlist_rejected",
                "That link points to a playlist or channel. Paste a single post URL.",
            )
        return entries[0]
    return info


def _needs_unsendable_headers(fmt: dict[str, Any], info: dict[str, Any]) -> bool:
    headers = {k.lower() for k in (fmt.get("http_headers") or info.get("http_headers") or {})}
    return bool(headers - _BROWSER_SENDABLE) or bool(fmt.get("cookies"))


def pick_progressive(info: dict[str, Any], *, max_height: int = 1080) -> dict[str, Any] | None:
    """A format the browser can fetch as-is: one file, both streams, plain HTTPS."""
    best: dict[str, Any] | None = None
    for fmt in info.get("formats") or []:
        if fmt.get("vcodec") in (None, "none") or fmt.get("acodec") in (None, "none"):
            continue                                   # video-only or audio-only -> needs mux
        if fmt.get("protocol") not in ("https", "http"):
            continue                                   # m3u8/dash -> needs assembly
        if fmt.get("fragments"):
            continue
        if (fmt.get("height") or 0) > max_height:
            continue
        if not (fmt.get("url") or "").startswith("https://"):
            continue
        if _needs_unsendable_headers(fmt, info):
            continue
        score = (fmt.get("height") or 0, fmt.get("tbr") or 0)
        if best is None or score > ((best.get("height") or 0), (best.get("tbr") or 0)):
            best = fmt
    return best


async def probe_direct(url: str) -> bool:
    """Necessary, not sufficient: we probe from Railway's IP, the user fetches from theirs.
    A pass means the URL is not cookie-walled and serves ranges; a client-side failure
    is caught by the /v1/fallback endpoint (see DOWN-09)."""
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            r = await client.get(url, headers={"Range": "bytes=0-1"})
    except httpx.HTTPError:
        return False
    if r.status_code not in (200, 206):
        return False
    ctype = r.headers.get("content-type", "")
    return ctype.startswith(("video/", "audio/", "application/octet-stream"))


async def resolve(url: str, *, proxy: str | None) -> Resolution:
    s = settings()
    platform = detect_platform(url)
    if platform is None:
        raise ResolveError("unsupported_platform", "That site is not supported.")

    opts = base_ydl_opts(proxy=proxy)
    try:
        raw = await asyncio.to_thread(_extract_sync, url, opts)
    except (DownloadError, ExtractorError) as exc:
        raise ResolveError("extract_failed", str(exc)[:200], status=502) from exc

    info = _reject_playlists(raw)

    duration = info.get("duration")
    if duration is not None and duration > s.max_duration_s:
        raise ResolveError(
            "too_long",
            f"That video is {int(duration)}s; the limit is {s.max_duration_s}s.",
        )

    title = (info.get("title") or "video")[:120]
    thumbnail = info.get("thumbnail")

    if platform in DIRECT_CANDIDATES:
        fmt = pick_progressive(info)
        if fmt is not None and await probe_direct(fmt["url"]):
            return Resolution(
                mode="direct",
                platform=platform,
                title=title,
                duration=duration,
                thumbnail=thumbnail,
                ext=fmt.get("ext") or "mp4",
                filesize_approx=fmt.get("filesize") or fmt.get("filesize_approx"),
                direct_url=fmt["url"],
                reason="progressive_cdn",
            )
        reason = "no_progressive_format" if fmt is None else "probe_failed"
    else:
        reason = "ip_bound_or_mux_required"

    return Resolution(
        mode="worker",
        platform=platform,
        title=title,
        duration=duration,
        thumbnail=thumbnail,
        ext="m4a" if platform == "youtube" else "mp4",
        filesize_approx=info.get("filesize_approx"),
        direct_url=None,
        reason=reason,
    )
```

```python
# dl-api/app/routes/resolve.py
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, HttpUrl

from app.proxy import proxy_url_for, record_outcome
from app.resolve import ResolveError, resolve
from app.security import Ticket, require_ticket
from app.status import assert_platform_up

router = APIRouter(prefix="/v1")


class ResolveIn(BaseModel):
    url: HttpUrl


@router.post("/resolve")
async def post_resolve(body: ResolveIn, request: Request, ticket: Ticket = Depends(require_ticket)):
    redis = request.app.state.redis
    try:
        res = await resolve(str(body.url), proxy=None)  # tier applied below on retry
    except ResolveError as first:
        proxy = await proxy_url_for(redis, _platform_hint(str(body.url)))
        if proxy is None:
            await record_outcome(redis, _platform_hint(str(body.url)), ok=False, status=first.status)
            raise HTTPException(first.status, {"code": first.code, "message": first.message})
        try:
            res = await resolve(str(body.url), proxy=proxy)
        except ResolveError as second:
            await record_outcome(redis, _platform_hint(str(body.url)), ok=False, status=second.status)
            raise HTTPException(second.status, {"code": second.code, "message": second.message})

    await assert_platform_up(redis, res.platform)
    await record_outcome(redis, res.platform, ok=True, status=200)
    return {
        "mode": res.mode,
        "platform": res.platform,
        "title": res.title,
        "duration": res.duration,
        "thumbnail": res.thumbnail,
        "ext": res.ext,
        "filesizeApprox": res.filesize_approx,
        "directUrl": res.direct_url,
    }


def _platform_hint(url: str) -> str:
    from app.platforms import detect_platform

    return detect_platform(url) or "unknown"
```

**Acceptance criteria**
- [ ] A public TikTok, Instagram Reel, X video, Reddit `v.redd.it` post, Facebook video and Pinterest pin each return `mode: "direct"` with a `directUrl` that a browser downloads successfully from a machine on a different network than Railway.
- [ ] A YouTube URL returns `mode: "worker"` with reason `ip_bound_or_mux_required`.
- [ ] A TikTok **playlist/profile** URL returns HTTP 422 `playlist_rejected`, and the server log shows exactly one extractor invocation.
- [ ] A video longer than `MAX_DURATION_S` returns 422 `too_long` before any format probing.
- [ ] Structured logs for a direct resolve show **no** bytes transferred beyond the 2-byte range probe.
- [ ] Unit tests over recorded `extract_info` fixtures assert `pick_progressive` rejects: fragmented formats, formats needing `Referer`, video-only formats, and >1080p.

---

### [DOWN-03] Turnstile-gated single-use tickets and per-IP-hash quotas
**Estimate:** 3h · **Depends on:** DOWN-01 · **Files:** `dl-web/src/app/api/ticket/route.ts`, `dl-api/app/security.py`, `dl-api/app/quota.py`

**Why** — A bare public resolve endpoint gets scraped into somebody else's product within a week, and their traffic lands on our proxy bill and our IP reputation. Same ticket pattern as the compute foundation, **different secret, different Redis** — a compromise of one must not mint tickets for the other.

**Implementation**

```ts
// dl-web/src/app/api/ticket/route.ts
import { createHmac, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const runtime = "nodejs";

const redis = Redis.fromEnv();
const TICKET_TTL_S = 120;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Rotating daily salt: an IP hash is un-joinable across days by construction. */
async function ipHash(ip: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `salt:${day}`;
  let salt = await redis.get<string>(key);
  if (!salt) {
    salt = randomUUID().replace(/-/g, "");
    await redis.set(key, salt, { ex: 172_800, nx: true });
    salt = (await redis.get<string>(key)) ?? salt;
  }
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 24);
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: ip,
    }),
  });
  const json = (await res.json()) as { success: boolean };
  return json.success === true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  const { token, scope } = (await req.json()) as { token?: string; scope?: string };

  if (!token || !(await verifyTurnstile(token, ip))) {
    return NextResponse.json({ error: "challenge_failed" }, { status: 403 });
  }
  if (scope !== "resolve" && scope !== "download") {
    return NextResponse.json({ error: "bad_scope" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: randomUUID(),
    iat: now,
    exp: now + TICKET_TTL_S,
    scope,
    iph: await ipHash(ip),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    createHmac("sha256", process.env.TICKET_SECRET!).update(body).digest(),
  );

  return NextResponse.json({ ticket: `${body}.${sig}`, expiresIn: TICKET_TTL_S });
}
```

```python
# dl-api/app/security.py
import base64
import hmac
import json
import time
from dataclasses import dataclass
from hashlib import sha256

from fastapi import Header, HTTPException, Request

from app.settings import settings


@dataclass(slots=True)
class Ticket:
    jti: str
    scope: str
    ip_hash: str


def _b64url_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


async def require_ticket(
    request: Request, x_dl_ticket: str = Header(default="")
) -> Ticket:
    if settings().global_kill_switch:
        raise HTTPException(503, {"code": "paused", "message": "Service is paused."})

    try:
        body_b64, sig_b64 = x_dl_ticket.split(".", 1)
        expected = hmac.new(
            settings().ticket_secret.encode(), body_b64.encode(), sha256
        ).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(body_b64))
    except Exception as exc:  # noqa: BLE001 - any malformed ticket is just invalid
        raise HTTPException(401, {"code": "bad_ticket"}) from exc

    if payload["exp"] < time.time():
        raise HTTPException(401, {"code": "ticket_expired"})

    redis = request.app.state.redis
    # Single use: SET NX succeeds exactly once per jti.
    if not await redis.set(f"jti:{payload['jti']}", "1", ex=300, nx=True):
        raise HTTPException(409, {"code": "ticket_replayed"})

    return Ticket(jti=payload["jti"], scope=payload["scope"], ip_hash=payload["iph"])
```

```python
# dl-api/app/quota.py
from fastapi import HTTPException
from redis.asyncio import Redis

RESOLVES_PER_DAY = 60
BYTES_PER_DAY = 3 * 1024**3  # 3 GB of worker-path transfer per IP hash per day


async def consume_resolve(redis: Redis, ip_hash: str) -> None:
    key = f"q:res:{ip_hash}"
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, 86_400)
    if n > RESOLVES_PER_DAY:
        raise HTTPException(429, {"code": "quota_resolves", "message": "Daily limit reached."})


async def consume_bytes(redis: Redis, ip_hash: str, nbytes: int) -> None:
    key = f"q:bytes:{ip_hash}"
    total = await redis.incrby(key, nbytes)
    if total == nbytes:
        await redis.expire(key, 86_400)
    if total > BYTES_PER_DAY:
        raise HTTPException(429, {"code": "quota_bytes", "message": "Daily transfer limit reached."})
```

**Acceptance criteria**
- [ ] `POST /v1/resolve` without `x-dl-ticket` returns 401.
- [ ] Replaying a ticket returns 409 `ticket_replayed`; the Redis key `jti:*` exists with a TTL.
- [ ] A ticket minted with the *portfolio's* `TICKET_SECRET` is rejected.
- [ ] 61st resolve from one IP hash in 24h returns 429 `quota_resolves`.
- [ ] `GLOBAL_KILL_SWITCH=true` makes every ticketed endpoint return 503 within one deploy, and the frontend shows a maintenance message rather than an error.
- [ ] Redis contains no raw IP addresses (`redis-cli --scan` + manual inspection of 20 keys).

---

### [DOWN-04] Worker path: queue, download, mux, R2, presigned GET
**Estimate:** 6h · **Depends on:** DOWN-02, DOWN-03 · **Files:** `dl-api/app/jobs.py`, `dl-api/app/worker.py`, `dl-api/app/routes/jobs.py`

**Why** — Downloads take 5–120 seconds; holding an HTTP request open for that is how you discover Railway's proxy timeout in production. POST returns a `job_id`, the client polls, and the artifact leaves via R2 where egress is free — an MP4 served from Railway would be metered bandwidth, from R2 it is $0.

**Implementation**

```python
# dl-api/app/jobs.py
import json
import time
import uuid
from typing import Any, Literal

from redis.asyncio import Redis

JobState = Literal["queued", "running", "done", "failed"]
QUEUE_ZSET = "q:pending"


async def enqueue(redis: Redis, *, url: str, platform: str, mode: str, ip_hash: str) -> str:
    job_id = uuid.uuid4().hex
    await redis.hset(
        f"job:{job_id}",
        mapping={
            "state": "queued",
            "platform": platform,
            "mode": mode,
            "ip_hash": ip_hash,
            "created": str(int(time.time())),
        },
    )
    await redis.expire(f"job:{job_id}", 6 * 3600)
    await redis.zadd(QUEUE_ZSET, {job_id: time.time()})
    # arq enqueues the actual work; payload carries the URL, which is never persisted in job:*
    return job_id


async def queue_position(redis: Redis, job_id: str) -> int | None:
    rank = await redis.zrank(QUEUE_ZSET, job_id)
    return None if rank is None else rank + 1


async def mark(redis: Redis, job_id: str, state: JobState, **fields: Any) -> None:
    payload = {"state": state, **{k: json.dumps(v) if not isinstance(v, str) else v
                                  for k, v in fields.items()}}
    await redis.hset(f"job:{job_id}", mapping=payload)
    if state in ("done", "failed"):
        await redis.zrem(QUEUE_ZSET, job_id)
```

```python
# dl-api/app/worker.py
import asyncio
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from arq import cron
from arq.connections import RedisSettings
from redis.asyncio import Redis
from yt_dlp import YoutubeDL

from app.canary import run_canary
from app.jobs import mark
from app.proxy import deescalate_sweep, proxy_url_for, record_outcome
from app.quota import consume_bytes
from app.r2 import r2_client
from app.resolve import base_ydl_opts
from app.settings import settings

MAX_CONCURRENT_JOBS = 4  # global cap; queue position is honest because of it


def _ydl_opts_for(*, outdir: Path, mode: str, proxy: str | None) -> dict[str, Any]:
    s = settings()
    opts = base_ydl_opts(proxy=proxy)
    opts.update(
        {
            "skip_download": False,
            "outtmpl": str(outdir / "media.%(ext)s"),
            "match_filter": _duration_filter,
            "concurrent_fragment_downloads": 4,
            "overwrites": True,
        }
    )
    if mode == "audio":
        opts["format"] = "bestaudio[ext=m4a]/bestaudio/best"
        opts["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "m4a", "preferredquality": "0"}
        ]
    else:
        opts["format"] = (
            "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/"
            "best[height<=1080][ext=mp4]/best[height<=1080]"
        )
        opts["merge_output_format"] = "mp4"   # yt-dlp invokes ffmpeg for the mux
    return opts


def _duration_filter(info: dict[str, Any], *, incomplete: bool = False) -> str | None:
    d = info.get("duration")
    limit = settings().max_duration_s
    if d is not None and d > limit:
        return f"duration {int(d)}s exceeds {limit}s"
    return None


def _faststart(src: Path) -> Path:
    """Stream-copy remux so the moov atom is at the front — browsers and mobile
    players start playing before the whole file lands. No re-encode, ~1s for 100MB."""
    if src.suffix.lower() not in (".mp4", ".m4a"):
        return src
    dst = src.with_name(f"fs{src.suffix}")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
         "-c", "copy", "-movflags", "+faststart", str(dst)],
        check=True, timeout=180,
    )
    return dst


def _download_sync(url: str, outdir: Path, mode: str, proxy: str | None) -> Path:
    with YoutubeDL(_ydl_opts_for(outdir=outdir, mode=mode, proxy=proxy)) as ydl:
        ydl.download([url])
    files = sorted(outdir.glob("media.*"), key=lambda p: p.stat().st_size, reverse=True)
    if not files:
        raise RuntimeError("yt-dlp produced no output file")
    return _faststart(files[0])


async def download_job(
    ctx: dict[str, Any], *, job_id: str, url: str, platform: str, mode: str,
    ip_hash: str, filename: str,
) -> None:
    redis: Redis = ctx["redis_client"]
    s = settings()
    tmp = Path(tempfile.mkdtemp(prefix="dl-"))
    try:
        await mark(redis, job_id, "running")
        proxy = await proxy_url_for(redis, platform)
        path = await asyncio.to_thread(_download_sync, url, tmp, mode, proxy)

        size = path.stat().st_size
        if size > s.max_filesize_bytes:
            raise RuntimeError(f"output {size} exceeds cap")
        await consume_bytes(redis, ip_hash, size)

        key = f"artifacts/{job_id}/{filename}"
        client = r2_client()
        await asyncio.to_thread(
            client.upload_file, str(path), s.r2_bucket, key,
            {"ContentType": "video/mp4" if path.suffix == ".mp4" else "audio/mp4"},
        )
        presigned = await asyncio.to_thread(
            client.generate_presigned_url,
            "get_object",
            {
                "Bucket": s.r2_bucket,
                "Key": key,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            s.artifact_ttl_s,
        )
        await record_outcome(redis, platform, ok=True, status=200)
        await mark(redis, job_id, "done", url=presigned, size=str(size), key=key)
    except Exception as exc:  # noqa: BLE001
        await record_outcome(redis, platform, ok=False, status=_status_of(exc))
        await mark(redis, job_id, "failed", error=type(exc).__name__)
        raise
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _status_of(exc: Exception) -> int:
    text = str(exc)
    for code in (403, 429, 404):
        if str(code) in text:
            return code
    return 500


async def sweep_artifacts(ctx: dict[str, Any]) -> None:
    """R2 lifecycle granularity is days; this enforces the 6h promise."""
    import time as _t

    s = settings()
    client = r2_client()
    cutoff = _t.time() - s.artifact_ttl_s
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=s.r2_bucket, Prefix="artifacts/"):
        stale = [
            {"Key": o["Key"]}
            for o in page.get("Contents", [])
            if o["LastModified"].timestamp() < cutoff
        ]
        for i in range(0, len(stale), 1000):
            client.delete_objects(Bucket=s.r2_bucket, Delete={"Objects": stale[i : i + 1000]})


class WorkerSettings:
    functions = [download_job]
    cron_jobs = [
        cron(sweep_artifacts, minute={0, 30}),
        cron(run_canary, minute={5, 35}),
        cron(deescalate_sweep, hour={3}, minute={0}),
    ]
    redis_settings = RedisSettings.from_dsn(os.environ["REDIS_URL"])
    max_jobs = MAX_CONCURRENT_JOBS
    job_timeout = 300
    keep_result = 0            # arq stores no result payload; job:* hash is the only record
```

```python
# dl-api/app/routes/jobs.py
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, HttpUrl

from app.jobs import enqueue, queue_position
from app.platforms import detect_platform
from app.quota import consume_resolve
from app.security import Ticket, require_ticket

router = APIRouter(prefix="/v1")


class JobIn(BaseModel):
    url: HttpUrl
    mode: str = "video"          # "video" | "audio"
    filename: str = "download.mp4"


@router.post("/jobs")
async def create_job(body: JobIn, request: Request, ticket: Ticket = Depends(require_ticket)):
    if ticket.scope != "download":
        raise HTTPException(403, {"code": "wrong_scope"})
    redis = request.app.state.redis
    await consume_resolve(redis, ticket.ip_hash)

    platform = detect_platform(str(body.url))
    if platform is None:
        raise HTTPException(422, {"code": "unsupported_platform"})

    job_id = await enqueue(
        redis, url=str(body.url), platform=platform, mode=body.mode, ip_hash=ticket.ip_hash
    )
    await request.app.state.arq.enqueue_job(
        "download_job",
        job_id=job_id, url=str(body.url), platform=platform,
        mode=body.mode, ip_hash=ticket.ip_hash,
        filename=body.filename[:80],
        _job_id=job_id,
    )
    return {"jobId": job_id, "position": await queue_position(redis, job_id)}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, request: Request):
    redis = request.app.state.redis
    data = await redis.hgetall(f"job:{job_id}")
    if not data:
        raise HTTPException(404, {"code": "unknown_job"})
    return {
        "state": data["state"],
        "position": await queue_position(redis, job_id),
        "url": data.get("url"),
        "size": data.get("size"),
        "error": data.get("error"),
    }
```

**Acceptance criteria**
- [ ] `POST /v1/jobs` returns `{jobId, position}` in under 300 ms.
- [ ] Polling `GET /v1/jobs/{id}` transitions `queued → running → done` and ends with a presigned URL that downloads a playable file.
- [ ] The presigned URL 403s after `ARTIFACT_TTL_S`.
- [ ] `ffprobe` on a muxed YouTube-path output shows both a video and an audio stream, and `moov` before `mdat` (`ffprobe -v trace` or `mp4box -info`).
- [ ] Five concurrent job submissions: at most 4 run, the 5th reports `position: 1` then completes.
- [ ] After `sweep_artifacts` runs against an artificially aged object, the object is gone from R2.
- [ ] `redis-cli HGETALL job:<id>` contains **no** source URL.

---

### [DOWN-05] Per-platform proxy tier state machine
**Estimate:** 3h · **Depends on:** DOWN-02 · **Files:** `dl-api/app/proxy.py`

**Why** — Paying for residential proxies on every request is the single fastest way to turn this into a money-losing hobby; never paying is the fastest way to get every request 403'd. The tier is per-platform state that escalates on evidence and decays on silence, so the expensive tier is only ever paid for while a platform is actually blocking us.

**Costs per tier** (verify): `none` $0/GB · `datacenter` ~$0.20/GB (≈$11/1000 at 45 MB) · `residential` ~$4/GB (≈$180/1000 at 45 MB, ≈$20/1000 at 5 MB audio).

**Implementation**

```python
# dl-api/app/proxy.py
import time

from redis.asyncio import Redis

from app.settings import settings

TIERS: tuple[str, ...] = ("none", "datacenter", "residential")

FAIL_WINDOW_S = 900          # 15 minutes
FAIL_THRESHOLD = 5           # blocking responses in the window before escalating
CLEAN_PERIOD_S = 86_400      # 24h with no blocking response before de-escalating
BLOCKING_STATUSES = {403, 429}


def _tier_key(platform: str) -> str:
    return f"proxy:tier:{platform}"


def _fail_key(platform: str) -> str:
    return f"proxy:fails:{platform}"


def _last_fail_key(platform: str) -> str:
    return f"proxy:lastfail:{platform}"


async def current_tier(redis: Redis, platform: str) -> str:
    tier = await redis.get(_tier_key(platform))
    return tier if tier in TIERS else "none"


async def proxy_url_for(redis: Redis, platform: str) -> str | None:
    s = settings()
    tier = await current_tier(redis, platform)
    if tier == "datacenter":
        return s.dc_proxy_url
    if tier == "residential":
        return s.residential_proxy_url or s.dc_proxy_url
    return None


async def _set_tier(redis: Redis, platform: str, tier: str) -> None:
    await redis.set(_tier_key(platform), tier)
    await redis.lpush(
        "proxy:audit",
        f"{int(time.time())} {platform} -> {tier}",
    )
    await redis.ltrim("proxy:audit", 0, 199)


async def record_outcome(redis: Redis, platform: str, *, ok: bool, status: int | None) -> None:
    if ok:
        return
    if status not in BLOCKING_STATUSES:
        return   # a 404 or a broken extractor is not a proxy problem; don't burn money on it

    now = int(time.time())
    key = _fail_key(platform)
    await redis.zadd(key, {f"{now}:{status}": now})
    await redis.zremrangebyscore(key, 0, now - FAIL_WINDOW_S)
    await redis.expire(key, FAIL_WINDOW_S * 2)
    await redis.set(_last_fail_key(platform), now)

    if await redis.zcard(key) < FAIL_THRESHOLD:
        return

    tier = await current_tier(redis, platform)
    idx = TIERS.index(tier)
    if idx + 1 < len(TIERS):
        await _set_tier(redis, platform, TIERS[idx + 1])
        await redis.delete(key)   # fresh evidence required before the next escalation


async def deescalate_sweep(ctx: dict) -> None:
    """arq cron, daily. One step down per platform per clean 24h — never a
    free-fall from residential to none, so we re-learn gently."""
    redis: Redis = ctx["redis_client"]
    now = int(time.time())
    async for key in redis.scan_iter(match="proxy:tier:*"):
        platform = key.rsplit(":", 1)[-1]
        tier = await current_tier(redis, platform)
        if tier == "none":
            continue
        last = await redis.get(_last_fail_key(platform))
        if last is not None and now - int(last) < CLEAN_PERIOD_S:
            continue
        await _set_tier(redis, platform, TIERS[TIERS.index(tier) - 1])
```

**Acceptance criteria**
- [ ] Injecting 5 synthetic 403s for `tiktok` inside 15 minutes moves `proxy:tier:tiktok` from `none` to `datacenter`; 5 more move it to `residential`.
- [ ] Injecting 20 synthetic **404s** does not change the tier.
- [ ] With `proxy:lastfail:tiktok` set to 25h ago, `deescalate_sweep` steps the tier down exactly one level.
- [ ] `LRANGE proxy:audit 0 -1` shows a human-readable escalation trail.
- [ ] `proxy_url_for` returns the datacenter URL when residential is unconfigured, rather than crashing.

---

### [DOWN-06] Health canary and honest degradation
**Estimate:** 3h · **Depends on:** DOWN-02, DOWN-04 · **Files:** `dl-api/app/canary.py`, `dl-api/app/status.py`, `dl-api/app/routes/status.py`

**Why** — Platforms break extractors without warning, and the failure mode we must never ship is a user pasting a TikTok link and getting a stack trace or a spinner that never ends. A canary that resolves one known-public URL per platform every 30 minutes converts "mysteriously broken" into "TikTok is temporarily down — we're on it", which costs nothing and preserves trust. It is also the tripwire for DOWN-07: when yt-dlp goes stale, the canary is what tells you.

**Implementation**

```python
# dl-api/app/canary.py
import json
import os
import time

from redis.asyncio import Redis

from app.proxy import proxy_url_for
from app.resolve import ResolveError, resolve

# Canary URLs live in env, not source: when one gets deleted you change a variable,
# not a deploy. Pick stable posts on official brand accounts.
CANARY_URLS: dict[str, str] = json.loads(os.environ.get("CANARY_URLS", "{}"))

FAIL_THRESHOLD = 2       # two consecutive failures before we call a platform degraded
STATUS_TTL_S = 3600


async def run_canary(ctx: dict) -> None:
    redis: Redis = ctx["redis_client"]
    for platform, url in CANARY_URLS.items():
        proxy = await proxy_url_for(redis, platform)
        ok = True
        detail = ""
        started = time.monotonic()
        try:
            res = await resolve(url, proxy=proxy)
            ok = res.direct_url is not None or res.mode == "worker"
        except ResolveError as exc:
            ok, detail = False, exc.code
        except Exception as exc:  # noqa: BLE001
            ok, detail = False, type(exc).__name__

        latency_ms = int((time.monotonic() - started) * 1000)
        fail_key = f"canary:fails:{platform}"

        if ok:
            await redis.delete(fail_key)
            await redis.hset(
                f"platform:{platform}",
                mapping={"status": "up", "checked": str(int(time.time())),
                         "latencyMs": str(latency_ms)},
            )
        else:
            fails = await redis.incr(fail_key)
            await redis.expire(fail_key, STATUS_TTL_S)
            status = "degraded" if fails >= FAIL_THRESHOLD else "up"
            await redis.hset(
                f"platform:{platform}",
                mapping={"status": status, "checked": str(int(time.time())),
                         "detail": detail, "latencyMs": str(latency_ms)},
            )
        await redis.expire(f"platform:{platform}", STATUS_TTL_S)
```

```python
# dl-api/app/status.py
from fastapi import HTTPException
from redis.asyncio import Redis


async def platform_status(redis: Redis, platform: str) -> str:
    return await redis.hget(f"platform:{platform}", "status") or "up"


async def assert_platform_up(redis: Redis, platform: str) -> None:
    if await platform_status(redis, platform) == "degraded":
        raise HTTPException(
            503,
            {
                "code": "platform_degraded",
                "platform": platform,
                "message": f"{platform.title()} downloads are temporarily unavailable. "
                           "This is on our side and we're working on it.",
            },
        )


async def all_statuses(redis: Redis) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    async for key in redis.scan_iter(match="platform:*"):
        out[key.split(":", 1)[1]] = await redis.hgetall(key)
    return out
```

```python
# dl-api/app/routes/status.py
from fastapi import APIRouter, Request, Response

from app.status import all_statuses

router = APIRouter(prefix="/v1")


@router.get("/platforms")
async def platforms(request: Request, response: Response):
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=60"
    return {"platforms": await all_statuses(request.app.state.redis)}
```

**Acceptance criteria**
- [ ] `GET /v1/platforms` returns a status object for every key in `CANARY_URLS` within 35 minutes of a cold deploy.
- [ ] Setting a canary URL to a deliberately broken value marks that platform `degraded` after exactly two cron runs, not one.
- [ ] While degraded, `POST /v1/resolve` for that platform returns 503 `platform_degraded` with a human sentence — no traceback in the response body.
- [ ] Restoring the URL clears `canary:fails:*` and returns status to `up` on the next run.
- [ ] The frontend banner (DOWN-09) reflects the degraded state within 60 seconds of a hard refresh.

---

### [DOWN-07] Daily yt-dlp auto-update
**Estimate:** 2h · **Depends on:** DOWN-01 · **Files:** `dl-api/.github/workflows/nightly-redeploy.yml`, `dl-api/app/routes/version.py`

**Why** — yt-dlp is in a continuous arms race with every platform it supports; a pinned version quietly stops working for one platform after another and is typically half-dead inside two weeks. The container already upgrades at boot (DOWN-01), so all that is needed is a daily boot, plus a version endpoint so the canary failure and the yt-dlp version can be correlated in ten seconds instead of an hour.

**Implementation**

```yaml
# dl-api/.github/workflows/nightly-redeploy.yml
name: nightly-redeploy
on:
  schedule:
    - cron: "17 3 * * *"   # 03:17 UTC, off the hour to avoid thundering herds
  workflow_dispatch:

jobs:
  redeploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Railway redeploy (api + worker)
        run: |
          set -euo pipefail
          curl -fsS -X POST "${{ secrets.RAILWAY_DEPLOY_HOOK_API }}"
          curl -fsS -X POST "${{ secrets.RAILWAY_DEPLOY_HOOK_WORKER }}"
      - name: Wait for rollout
        run: sleep 180
      - name: Verify the new yt-dlp is live
        run: |
          set -euo pipefail
          BEFORE_DATE=$(date -u -d '30 days ago' +%Y.%m.%d)
          VERSION=$(curl -fsS "${{ secrets.API_BASE }}/v1/version" | jq -r .ytdlp)
          echo "yt-dlp: $VERSION"
          # Fail loudly if the running build is older than 30 days.
          [ "$(printf '%s\n%s\n' "$BEFORE_DATE" "$VERSION" | sort -V | head -1)" = "$BEFORE_DATE" ]
```

```python
# dl-api/app/routes/version.py
from importlib.metadata import version as pkg_version
import subprocess

from fastapi import APIRouter

router = APIRouter(prefix="/v1")


@router.get("/version")
async def version() -> dict[str, str]:
    try:
        ff = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, text=True, timeout=5
        ).stdout.splitlines()[0]
    except Exception:  # noqa: BLE001
        ff = "unknown"
    return {"ytdlp": pkg_version("yt_dlp"), "ffmpeg": ff}
```

**Acceptance criteria**
- [ ] `GET /v1/version` returns the running yt-dlp version and an ffmpeg banner.
- [ ] Manually dispatching the workflow redeploys both services and the reported yt-dlp version advances (or is confirmed already current).
- [ ] The workflow **fails the run** when the deployed yt-dlp is more than 30 days old, and that failure emails him.
- [ ] The Dockerfile boot upgrade does not add more than ~15 s to cold start (measured).

---

### [DOWN-08] cobalt as a second backend, with a per-platform router
**Estimate:** 2h · **Depends on:** DOWN-02 · **Files:** `dl-api/app/backends/cobalt.py`, `dl-api/app/backends/router.py`

**Why** — When yt-dlp's extractor for one platform breaks, an independently-maintained implementation is often still working, and vice versa. Running a self-hosted cobalt instance as a second service in the same Railway project turns a multi-day outage into a Redis key flip. Its `tunnel` responses are deliberately *not* used — a tunnel means cobalt proxies the bytes, which puts us back on the expensive path; only `redirect` responses (direct CDN URLs) are accepted from this backend.

**Implementation**

```python
# dl-api/app/backends/cobalt.py
import os
from typing import Any, Literal

import httpx

COBALT_BASE = os.environ.get("COBALT_API_URL", "")  # internal Railway URL, never public


class CobaltUnavailable(Exception):
    pass


async def cobalt_resolve(
    url: str, *, mode: Literal["auto", "audio"] = "auto"
) -> dict[str, Any]:
    if not COBALT_BASE:
        raise CobaltUnavailable("cobalt not configured")
    payload = {
        "url": url,
        "downloadMode": mode,
        "videoQuality": "1080",
        "filenameStyle": "basic",
        "youtubeVideoCodec": "h264",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(
                COBALT_BASE,
                json=payload,
                headers={"accept": "application/json", "content-type": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise CobaltUnavailable(str(exc)) from exc

    if r.status_code >= 500:
        raise CobaltUnavailable(f"cobalt {r.status_code}")

    data = r.json()
    status = data.get("status")
    if status == "redirect":
        return {"mode": "direct", "url": data["url"], "filename": data.get("filename")}
    if status == "picker":
        items = data.get("picker") or []
        if items:
            return {"mode": "direct", "url": items[0]["url"], "filename": None}
    # "tunnel" would route bytes through cobalt — refuse; the worker path is cheaper for us.
    raise CobaltUnavailable(f"unusable cobalt status: {status}")
```

```python
# dl-api/app/backends/router.py
import json

from redis.asyncio import Redis

from app.backends.cobalt import CobaltUnavailable, cobalt_resolve
from app.proxy import proxy_url_for
from app.resolve import ResolveError, Resolution, resolve

DEFAULT_ORDER = ["ytdlp", "cobalt"]
ORDER_KEY = "backend:order"   # hash: platform -> json list


async def backend_order(redis: Redis, platform: str) -> list[str]:
    raw = await redis.hget(ORDER_KEY, platform)
    return json.loads(raw) if raw else DEFAULT_ORDER


async def resolve_via_router(redis: Redis, url: str, platform: str) -> Resolution:
    errors: list[str] = []
    for backend in await backend_order(redis, platform):
        try:
            if backend == "ytdlp":
                return await resolve(url, proxy=await proxy_url_for(redis, platform))
            if backend == "cobalt":
                out = await cobalt_resolve(url)
                return Resolution(
                    mode="direct", platform=platform, title="video", duration=None,
                    thumbnail=None, ext="mp4", filesize_approx=None,
                    direct_url=out["url"], reason="cobalt_redirect",
                )
        except (ResolveError, CobaltUnavailable) as exc:
            errors.append(f"{backend}:{exc}")
            continue
    raise ResolveError("all_backends_failed", "; ".join(errors)[:200], status=502)
```

**Acceptance criteria**
- [ ] cobalt runs as a private Railway service; `COBALT_API_URL` is an internal hostname and returns 000/timeout from the public internet.
- [ ] Setting `HSET backend:order tiktok '["cobalt","ytdlp"]'` makes TikTok resolve via cobalt with no redeploy.
- [ ] A cobalt `tunnel` response is refused and the router falls through to yt-dlp.
- [ ] With both backends forced to fail, the API returns 502 `all_backends_failed` and the error string names both attempts.

---

### [DOWN-09] Frontend: separate minimal Next.js app, deliberately unbranded
**Estimate:** 4h · **Depends on:** DOWN-03, DOWN-04, DOWN-06 · **Files:** `dl-web/src/app/layout.tsx`, `dl-web/src/app/page.tsx`, `dl-web/src/app/[platform]/page.tsx`, `dl-web/src/components/downloader.tsx`, `dl-web/src/components/status-banner.tsx`, `dl-web/src/lib/api.ts`

**Why — the choice, made explicitly:** a **separate minimal Next.js app in its own repo and its own Vercel project**, not a static HTML page and not a route group in the portfolio. A static page still needs a JS bundle for Turnstile, job polling and the direct/worker fork, so "static" buys nothing but loses per-platform routes with real metadata, which is where the search traffic comes from. Putting it in the portfolio repo is disqualified outright: shared repo means shared deploy hooks, shared Vercel account, and a takedown that reaches the wrong project. Branding: no name, no photo, no link to `kavithakanchana.me`, no shared analytics property; the footer carries `abuse@$DL_DOMAIN` and a takedown policy only. This is not deniability theatre — WHOIS privacy and a role mailbox are the normal operating posture for a tool with legal surface area, and keeping his personal entity graph out of it protects the E-E-A-T work the main site depends on.

**Implementation**

```ts
// dl-web/src/lib/api.ts
const API = process.env.NEXT_PUBLIC_API_BASE!;

export type Resolution = {
  mode: "direct" | "worker";
  platform: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  ext: string;
  filesizeApprox: number | null;
  directUrl: string | null;
};

export type JobStatus = {
  state: "queued" | "running" | "done" | "failed";
  position: number | null;
  url?: string;
  error?: string;
};

async function ticket(scope: "resolve" | "download", token: string): Promise<string> {
  const r = await fetch("/api/ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, scope }),
  });
  if (!r.ok) throw new Error("challenge_failed");
  return ((await r.json()) as { ticket: string }).ticket;
}

export async function resolveUrl(url: string, turnstileToken: string): Promise<Resolution> {
  const r = await fetch(`${API}/v1/resolve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dl-ticket": await ticket("resolve", turnstileToken),
    },
    body: JSON.stringify({ url }),
  });
  if (!r.ok) throw Object.assign(new Error("resolve_failed"), { detail: await r.json() });
  return r.json();
}

export async function startJob(
  url: string,
  mode: "video" | "audio",
  filename: string,
  turnstileToken: string,
): Promise<string> {
  const r = await fetch(`${API}/v1/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dl-ticket": await ticket("download", turnstileToken),
    },
    body: JSON.stringify({ url, mode, filename }),
  });
  if (!r.ok) throw Object.assign(new Error("job_failed"), { detail: await r.json() });
  return ((await r.json()) as { jobId: string }).jobId;
}

export async function pollJob(
  jobId: string,
  onTick: (s: JobStatus) => void,
  signal: AbortSignal,
): Promise<JobStatus> {
  for (let i = 0; i < 150 && !signal.aborted; i++) {
    const r = await fetch(`${API}/v1/jobs/${jobId}`, { signal });
    const s = (await r.json()) as JobStatus;
    onTick(s);
    if (s.state === "done" || s.state === "failed") return s;
    await new Promise((res) => setTimeout(res, i < 10 ? 1000 : 2500));
  }
  throw new Error("timeout");
}
```

```tsx
// dl-web/src/components/downloader.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { pollJob, resolveUrl, startJob, type JobStatus, type Resolution } from "@/lib/api";

type UiState =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "ready"; res: Resolution }
  | { kind: "working"; status: JobStatus }
  | { kind: "error"; message: string };

function safeName(title: string, ext: string): string {
  return `${title.replace(/[^\w\-. ]+/g, "_").slice(0, 60) || "download"}.${ext}`;
}

export function Downloader({ defaultPlatform }: { defaultPlatform?: string }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  const turnstile = useCallback(async (): Promise<string> => {
    // @ts-expect-error injected by the Turnstile script tag in layout.tsx
    return window.turnstile.getResponse() as string;
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setState({ kind: "resolving" });
      try {
        const token = await turnstile();
        const res = await resolveUrl(url, token);

        if (res.mode === "direct" && res.directUrl) {
          setState({ kind: "ready", res });
          return;
        }

        const jobId = await startJob(
          url,
          res.platform === "youtube" ? "audio" : "video",
          safeName(res.title, res.ext),
          await turnstile(),
        );
        abort.current?.abort();
        abort.current = new AbortController();
        const final = await pollJob(
          jobId,
          (s) => setState({ kind: "working", status: s }),
          abort.current.signal,
        );
        if (final.state === "done" && final.url) {
          window.location.href = final.url;
          setState({ kind: "idle" });
        } else {
          setState({ kind: "error", message: "That download failed. Try again in a minute." });
        }
      } catch (err) {
        const detail = (err as { detail?: { detail?: { message?: string } } }).detail?.detail;
        setState({ kind: "error", message: detail?.message ?? "Something went wrong." });
      }
    },
    [turnstile, url],
  );

  /** If the CDN URL 403s in the user's browser (IP-bound after all), fall back to the worker. */
  const onDirectFailed = useCallback(async () => {
    setState({ kind: "resolving" });
    try {
      const jobId = await startJob(url, "video", "download.mp4", await turnstile());
      abort.current = new AbortController();
      const final = await pollJob(jobId, (s) => setState({ kind: "working", status: s }), abort.current.signal);
      if (final.state === "done" && final.url) window.location.href = final.url;
    } catch {
      setState({ kind: "error", message: "That download failed." });
    }
  }, [turnstile, url]);

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl space-y-4">
      <input
        type="url"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={`Paste a ${defaultPlatform ?? "video"} link`}
        className="w-full rounded-lg border px-4 py-3 text-base"
        aria-label="Video URL"
      />
      <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      <button
        type="submit"
        disabled={state.kind === "resolving" || state.kind === "working"}
        className="w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {state.kind === "resolving" ? "Checking…" : "Get download"}
      </button>

      {state.kind === "working" && (
        <p role="status" className="text-sm text-neutral-600">
          {state.status.state === "queued"
            ? `Queued — position ${state.status.position ?? "…"}`
            : "Preparing your file…"}
        </p>
      )}

      {state.kind === "ready" && state.res.directUrl && (
        <a
          href={state.res.directUrl}
          download={safeName(state.res.title, state.res.ext)}
          onClick={() => setTimeout(() => void 0, 0)}
          onError={onDirectFailed}
          className="block rounded-lg border px-4 py-3 text-center"
        >
          Download {state.res.ext.toUpperCase()}
          {state.res.filesizeApprox
            ? ` · ${(state.res.filesizeApprox / 1_048_576).toFixed(1)} MB`
            : ""}
        </a>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
```

```tsx
// dl-web/src/components/status-banner.tsx
import { unstable_noStore as noStore } from "next/cache";

type PlatformStatus = Record<string, { status: string; detail?: string }>;

export async function StatusBanner({ platform }: { platform?: string }) {
  noStore();
  let data: PlatformStatus = {};
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/v1/platforms`, {
      next: { revalidate: 60 },
    });
    data = ((await r.json()) as { platforms: PlatformStatus }).platforms;
  } catch {
    return null; // a status-service outage must not break the page
  }

  const degraded = Object.entries(data).filter(
    ([name, v]) => v.status === "degraded" && (!platform || name === platform),
  );
  if (degraded.length === 0) return null;

  return (
    <div role="status" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      {degraded.map(([name]) => (
        <p key={name}>
          {name[0].toUpperCase() + name.slice(1)} downloads are temporarily unavailable. This is on
          our side — try again later.
        </p>
      ))}
    </div>
  );
}
```

**Acceptance criteria**
- [ ] `dl-web` lives in its own repo and its own Vercel project; `vercel projects ls` shows it under a different scope than the portfolio.
- [ ] No string in `dl-web` contains "Kavitha", "kavithakanchana", or links to the portfolio (`grep -ri` returns nothing).
- [ ] `pnpm build` in `dl-web` passes with 0 tsc errors and `ignoreBuildErrors` absent from `next.config.mjs`.
- [ ] Per-platform routes `/tiktok`, `/instagram`, `/x`, `/reddit`, `/facebook`, `/pinterest`, `/youtube-mp3` render with distinct `<title>` and description.
- [ ] Turnstile widget renders; submitting without solving it returns a visible "challenge failed" message, not a silent failure.
- [ ] Direct-mode download starts within 2 s of resolve on a TikTok link; worker-mode shows a queue position that decrements.
- [ ] Lighthouse mobile Performance ≥ 90 and Accessibility ≥ 95 on `/tiktok`.
- [ ] With a platform forced to `degraded`, the banner appears on both `/` and that platform's page.

---

### [DOWN-10] Lower-risk siblings: thumbnail grabber and oEmbed metadata viewer
**Estimate:** 3h · **Depends on:** DOWN-02, DOWN-09 · **Files:** `dl-api/app/routes/meta.py`, `dl-web/src/app/thumbnail/page.tsx`, `dl-web/src/app/oembed/page.tsx`

**Why** — Both have real search volume, neither moves media bytes, and neither is plausibly a copyright complaint: thumbnails and oEmbed metadata are what the platforms publish *for* embedding. They also make the domain look like a metadata utility rather than a single-purpose downloader, which matters when a human reviews it. YouTube thumbnails are pure client-side string manipulation and never touch the API at all.

**Implementation**

```python
# dl-api/app/routes/meta.py
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, HttpUrl

from app.platforms import detect_platform
from app.resolve import ResolveError, base_ydl_opts, _extract_sync  # noqa: PLC2701
from app.security import Ticket, require_ticket

router = APIRouter(prefix="/v1")

# SSRF guard: only these exact endpoints are ever fetched server-side.
OEMBED_ENDPOINTS: dict[str, str] = {
    "youtube": "https://www.youtube.com/oembed?format=json&url=",
    "tiktok": "https://www.tiktok.com/oembed?url=",
    "x": "https://publish.twitter.com/oembed?url=",
    "reddit": "https://www.reddit.com/oembed?url=",
    "pinterest": "https://www.pinterest.com/oembed.json?url=",
}


class MetaIn(BaseModel):
    url: HttpUrl


@router.post("/thumbnails")
async def thumbnails(body: MetaIn, ticket: Ticket = Depends(require_ticket)):
    import asyncio

    platform = detect_platform(str(body.url))
    if platform is None:
        raise HTTPException(422, {"code": "unsupported_platform"})
    try:
        info = await asyncio.to_thread(
            _extract_sync, str(body.url), base_ydl_opts(proxy=None)
        )
    except ResolveError as exc:
        raise HTTPException(exc.status, {"code": exc.code, "message": exc.message}) from exc

    thumbs = [
        {"url": t["url"], "width": t.get("width"), "height": t.get("height")}
        for t in (info.get("thumbnails") or [])
        if t.get("url")
    ]
    thumbs.sort(key=lambda t: (t["width"] or 0) * (t["height"] or 0), reverse=True)
    return {"platform": platform, "thumbnails": thumbs[:8]}


@router.post("/oembed")
async def oembed(body: MetaIn, ticket: Ticket = Depends(require_ticket)):
    platform = detect_platform(str(body.url))
    endpoint = OEMBED_ENDPOINTS.get(platform or "")
    if endpoint is None:
        raise HTTPException(422, {"code": "no_oembed_endpoint"})
    target = endpoint + quote(str(body.url), safe="")
    if urlparse(target).scheme != "https":
        raise HTTPException(400, {"code": "bad_endpoint"})
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        r = await client.get(target, headers={"accept": "application/json"})
    if r.status_code != 200:
        raise HTTPException(502, {"code": "oembed_failed", "status": r.status_code})
    return r.json()
```

```tsx
// dl-web/src/app/thumbnail/page.tsx  (excerpt: the YouTube fast path, which never hits the API)
"use client";

import { useState } from "react";

const YT_ID = /(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/;
const SIZES = ["maxresdefault", "sddefault", "hqdefault", "mqdefault"] as const;

export default function ThumbnailPage() {
  const [url, setUrl] = useState("");
  const id = YT_ID.exec(url)?.[1];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">YouTube thumbnail downloader</h1>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a YouTube link"
        aria-label="YouTube URL"
        className="mt-6 w-full rounded-lg border px-4 py-3"
      />
      {id && (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {SIZES.map((size) => {
            const src = `https://i.ytimg.com/vi/${id}/${size}.jpg`;
            return (
              <li key={size}>
                {/* maxresdefault 404s on older uploads; the browser's own error
                    handling hides the broken entry with zero server round trips. */}
                <img
                  src={src}
                  alt={`${size} thumbnail`}
                  loading="lazy"
                  onError={(e) => (e.currentTarget.parentElement!.style.display = "none")}
                  className="w-full rounded-md"
                />
                <a href={src} download className="mt-1 block text-sm underline">
                  Download {size}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

**Acceptance criteria**
- [ ] `/thumbnail` resolves a YouTube link to four candidate images with **zero** network requests to our API (verified in DevTools).
- [ ] `POST /v1/thumbnails` returns a size-sorted list for a TikTok and an Instagram URL.
- [ ] `POST /v1/oembed` with `url=http://169.254.169.254/latest/meta-data/` returns 422, not a metadata response — SSRF guard verified.
- [ ] `/oembed` renders title, author, and the provider's embed HTML in a `<pre>` (escaped, never `dangerouslySetInnerHTML`).
- [ ] Both pages carry their own titles and are linked from the homepage.

---

### [DOWN-11] YouTube, last, audio-first
**Estimate:** 2h · **Depends on:** DOWN-04, DOWN-05, DOWN-06 · **Files:** `dl-api/app/youtube.py`, `dl-web/src/app/youtube-mp3/page.tsx`

**Why** — YouTube is the highest-demand and highest-cost platform on the list: its stream URLs are IP-bound so direct handoff is impossible, video and audio always arrive separately so a mux is mandatory, and it blocks datacenter IPs aggressively enough that residential proxying is the steady state. Audio-only is ~5 MB against ~45 MB for 1080p — roughly $20/1000 versus $180/1000 — so audio is the default and video is opt-in behind a stricter quota. It ships last because if any platform is going to break the whole service, it is this one, and everything else should already be earning by then.

**PO token / SABR reality, stated plainly:** YouTube increasingly serves media over SABR and gates non-tokened clients, so a bare yt-dlp resolves fewer formats over time and sometimes none. The workable posture is a **PO token provider sidecar** (`bgutil-ytdlp-pot-provider`) running as a private service in the same Railway project, with yt-dlp configured to fetch tokens from it. **Never attach a real Google account's cookies** — it is a straightforward path to that account being banned, and it converts a technical problem into an account-integrity one. Treat this whole area as unstable: the canary on YouTube is the tripwire, and the honest fallback is marking YouTube degraded rather than burning proxy budget on retries.

**Implementation**

```python
# dl-api/app/youtube.py
import os
from typing import Any

POT_PROVIDER_URL = os.environ.get("POT_PROVIDER_URL", "")  # internal Railway URL


def youtube_opts(base: dict[str, Any], *, mode: str) -> dict[str, Any]:
    """Layer YouTube-specific extractor args on top of the shared options."""
    opts = dict(base)
    extractor_args: dict[str, dict[str, list[str]]] = {
        "youtube": {
            # tv + web_safari currently expose the widest non-SABR format set.
            # Expect to change this; the canary tells you when.
            "player_client": ["tv", "web_safari"],
            "player_skip": ["configs"],
        }
    }
    if POT_PROVIDER_URL:
        extractor_args["youtubepot-bgutilhttp"] = {"base_url": [POT_PROVIDER_URL]}
        extractor_args["youtube"]["fetch_pot"] = ["always"]
    opts["extractor_args"] = extractor_args

    if mode == "audio":
        # m4a is what YouTube already stores; extracting it is a stream copy, not a re-encode.
        opts["format"] = "bestaudio[ext=m4a]/bestaudio"
        opts["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "m4a", "preferredquality": "0"}
        ]
    else:
        opts["format"] = "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
        opts["merge_output_format"] = "mp4"
    return opts


# Video is opt-in and separately rate-limited: 3 per IP hash per day against 60 audio.
YOUTUBE_VIDEO_PER_DAY = 3
```

```python
# dl-api/app/routes/jobs.py — additional guard inside create_job()
# (insert after the platform check)
#
#     if platform == "youtube" and body.mode == "video":
#         key = f"q:ytvid:{ticket.ip_hash}"
#         n = await redis.incr(key)
#         if n == 1:
#             await redis.expire(key, 86_400)
#         if n > YOUTUBE_VIDEO_PER_DAY:
#             raise HTTPException(429, {"code": "quota_yt_video",
#                                       "message": "Daily video limit reached. MP3 is unlimited."})
```

**Acceptance criteria**
- [ ] A YouTube link on `/youtube-mp3` produces a playable `.m4a` with correct duration; `ffprobe` shows no video stream and no re-encode artifacts (bitrate matches the source).
- [ ] `mode: "video"` is only reachable by an explicit UI toggle, and the 4th video request in 24h returns 429 `quota_yt_video`.
- [ ] With `POT_PROVIDER_URL` unset, the service still resolves *some* YouTube formats or degrades cleanly — it does not 500.
- [ ] The PO token provider service is private (no public Railway domain).
- [ ] No Google account cookies exist anywhere in the repo, env, or container (`grep -ri cookie` over `dl-api` returns only header-related code).
- [ ] YouTube appears in `CANARY_URLS` and shows in `/v1/platforms`.

---

### [DOWN-12] Privacy-preserving logging, Cloudflare WAF, and the kill switch
**Estimate:** 2h · **Depends on:** DOWN-01, DOWN-03 · **Files:** `dl-api/app/logging.py`, `dl-api/app/main.py`, `docs/waf-rules.md`, `docs/takedown-policy.md`

**Why** — A database of who downloaded what has zero product value and is the single worst artifact to be holding when a subpoena or a platform's legal team arrives; not collecting it is both cheaper and safer than securing it. Structured logs carry a salted hash of the URL for debugging duplicates and nothing else.

**Implementation**

```python
# dl-api/app/logging.py
import hashlib
import logging
import os
import re
from typing import Any

import structlog

URL_SALT = os.environ["URL_LOG_SALT"]          # rotated monthly; not backed up
_URL_RE = re.compile(r"https?://\S+")


def url_digest(url: str) -> str:
    """Stable within a salt epoch, reversible by nobody, useless as evidence."""
    return hashlib.sha256((URL_SALT + url).encode()).hexdigest()[:16]


def _scrub_urls(_logger: Any, _name: str, event: dict[str, Any]) -> dict[str, Any]:
    for key, value in list(event.items()):
        if isinstance(value, str) and _URL_RE.search(value):
            event[key] = _URL_RE.sub(lambda m: f"url:{url_digest(m.group(0))}", value)
    for banned in ("ip", "remote_addr", "x_forwarded_for", "user_agent", "cookie"):
        event.pop(banned, None)
    return event


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _scrub_urls,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )
```

```markdown
<!-- docs/waf-rules.md — apply on the downloader Cloudflare zone only -->
1. Rate limit  `/api/ticket`      : 20 req / 60s per IP → managed challenge.
2. Rate limit  `/*`               : 200 req / 60s per IP → block 10 min.
3. Firewall    `cf.client.bot`    : allow verified search bots on GET only; block bots on POST.
4. Firewall    `http.request.method eq "POST" and not http.referer contains "$DL_DOMAIN"` → challenge.
5. Bot Fight Mode: ON. Security level: medium. Browser Integrity Check: ON.
6. Cache rule: `/v1/platforms` edge-cache 60s. Everything else under /v1 bypasses cache.
7. Page rule: block all traffic from ASNs of known scraping hosts (add reactively from analytics).
```

**Acceptance criteria**
- [ ] Grepping 24h of Railway logs for `http` returns zero full URLs; only `url:<16 hex>` tokens appear.
- [ ] No log line contains an IP address, user agent, or cookie value.
- [ ] `URL_LOG_SALT` rotation is documented and rotating it makes old digests un-joinable to new ones.
- [ ] All 7 WAF rules exist in the dashboard on the downloader zone and **none** exist on the portfolio zone.
- [ ] `/takedown` page is live, states the abuse contact, and describes the 6-hour artifact TTL.
- [ ] Flipping `GLOBAL_KILL_SWITCH=true` in Railway takes the service to 503 in under 60 seconds, verified with a real request.

---

**Total: 38h** (3+5+3+6+3+3+2+2+4+3+2+2)

### Deferred from this sprint

- **Subtitle / caption converter (SRT ↔ VTT ↔ plain text).** Pure browser, no worker, no risk — which is exactly why it belongs in the main site's tools registry rather than here, where it would be wasted on a domain he doesn't want to promote. Move it to the next main-site tools sprint.
- **SSE job progress.** Polling with backoff is 20 lines and works; SSE through Railway's proxy is a half-day of edge cases for a nicer progress bar.
- **Batch / multi-URL input.** Directly contradicts the playlist rejection posture and multiplies abuse surface. Not before three months of clean operation.
- **Instagram/Facebook logged-in content.** Requires cookies from a real account, which means an account that will be banned. Out of scope permanently unless a sanctioned API path appears.
- **Per-platform SEO article content** on the downloader domain. Ship the tools first; the pages exist and are indexable, and content can land in a follow-up without touching this architecture.

---

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Direct CDN URL 403s in the user's browser despite passing our probe (IP-bound after all) | High | Medium | `onDirectFailed` in `downloader.tsx` silently re-enqueues via the worker path; track the direct→worker fallback rate per platform in Redis and drop a platform out of `DIRECT_CANDIDATES` if it exceeds 20% |
| yt-dlp extractor breaks for a platform overnight | High | High | Canary marks degraded within 60 min (DOWN-06); nightly auto-update (DOWN-07); cobalt as a per-platform fallback flipped by one Redis key (DOWN-08) |
| Residential proxy spend runs away | Medium | High | Tier escalation requires 5 blocking responses in 15 min and only ever steps one level (DOWN-05); per-IP-hash byte quota 3 GB/day; YouTube video capped at 3/day/IP; Railway hard spend cap; `GLOBAL_KILL_SWITCH` |
| DMCA notice or platform legal contact | Medium | Medium | 6h artifact TTL means no persistent copy exists to take down; `/takedown` page and monitored `abuse@`; URL-hash-only logs mean there is nothing to hand over; isolated account so any strike lands away from the portfolio |
| Railway or Cloudflare suspends the downloader account | Low–Medium | High **(contained)** | Entirely separate accounts, zones, buckets, Redis, repos and payment method; portfolio deployment path shares nothing; recovery is re-provisioning from `dl-api`/`dl-web` repos onto a different host, ~4h |
| YouTube SABR / PO token changes make YouTube unresolvable | Medium–High | Medium | YouTube is last and isolated behind a feature flag; canary degrades it independently of other platforms; PO provider sidecar is swappable; audio-only default keeps the failure cheap |
| Scrapers wrap the API into their own product | Medium | Medium | Turnstile-gated single-use tickets, 2-minute expiry, `jti` replay rejection, CORS locked to origin, WAF rule 4 challenges POSTs without a matching referer |
| Queue saturation under a traffic spike | Medium | Low | `max_jobs = 4` global cap with honest queue position; 300 s job timeout; per-IP quotas throttle any single actor before the queue notices |
| A playlist URL becomes hundreds of jobs | Low | High | `noplaylist: True` **and** `playlist_items: "1"` **and** an explicit `_type == "playlist"` rejection in `resolve()` — three independent guards, tested |

---

### Definition of Done

- [ ] `dl-web`: `pnpm build` passes with **0 tsc errors**; `next.config.mjs` contains no `ignoreBuildErrors` or `ignoreDuringBuilds`.
- [ ] `dl-api`: `ruff check` and `mypy app` clean; `pytest` green, including the `pick_progressive` fixture suite, ticket replay test, playlist rejection test, and proxy escalation/de-escalation tests.
- [ ] Lighthouse mobile on `/tiktok` and `/youtube-mp3`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95; no layout shift when the status banner mounts.
- [ ] `api`, `worker`, `cobalt` and `potp` all deployed on the isolated Railway project; `worker` shows cron jobs registered in its startup log.
- [ ] Verified in prod from a network unrelated to the dev machine: one direct download per direct-candidate platform, one worker download, one YouTube MP3.
- [ ] `GET /v1/platforms` returns live status for every configured canary platform.
- [ ] R2 bucket contains only `artifacts/` objects, all younger than 6 hours.
- [ ] 24h of production logs audited: zero full URLs, zero IPs, zero user agents.
- [ ] `kavithakanchana.me` build, deploy and Search Console are demonstrably untouched: no new env vars, no new dependencies, no commits to the portfolio repo during this sprint.
- [ ] `abuse@$DL_DOMAIN` receives and forwards a test message.
- [ ] Rollback rehearsed once: `GLOBAL_KILL_SWITCH=true` → 503 everywhere → `false` → normal service, inside 5 minutes.

---

### Demo script

1. From a phone on mobile data (not the dev machine's network), open `https://$DL_DOMAIN/tiktok`, paste a public TikTok URL, solve Turnstile, tap **Get download** — the file saves within ~3 seconds. Confirm in Railway logs that only a 2-byte range probe left the container and the log line reads `url:<hash>`, never the URL.
2. Repeat on `/reddit` with a `v.redd.it` link and on `/x` with a video tweet. Both must be `mode: "direct"`.
3. Open `/youtube-mp3`, paste a 4-minute video, and watch the UI go `Queued — position 1` → `Preparing your file…` → download. Run `ffprobe` on the result: one audio stream, no video, duration matches.
4. `curl -s $API/v1/version` — confirm yt-dlp's version string is dated within the last 30 days.
5. Replay attack: capture a ticket from DevTools, `curl` `/v1/resolve` with it twice — second call returns 409 `ticket_replayed`.
6. Force degradation: `redis-cli HSET platform:tiktok status degraded`. Reload `/tiktok` — the amber banner appears and submitting returns the honest "temporarily unavailable" sentence. Reset the key and confirm recovery.
7. Cost check: `redis-cli LRANGE proxy:audit 0 -1` should be empty or `none` for every direct-candidate platform, proving the expensive tier was never engaged during the demo.
8. Isolation check: in one browser open the Railway dashboard, the Cloudflare dashboard and the Vercel dashboard side by side, and confirm the downloader project appears in a different account/team than the portfolio in all three. Then `git log --oneline -5` in the portfolio repo — nothing from this sprint is there.