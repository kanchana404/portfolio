# syntax=docker/dockerfile:1.7
#
# A decoder for the formats a browser cannot read. Two stages: the builder owns
# pip and a compiler; the runtime carries the venv, the image libraries, and a
# user that cannot write to anything that executes.

ARG PYTHON_VERSION=3.12-slim-bookworm

# ---------------------------------------------------------------------------
# Stage 1 — build the virtualenv
# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION} AS builder

# No apt in the builder, deliberately.
#
# This stage used to install build-essential and libraw-dev as insurance against
# a source build. It was not cheap insurance: it was the line that failed the
# first deploy, and it was insuring against nothing. Checked against PyPI, every
# dependency here resolves to a prebuilt cp312 manylinux wheel except pyvips,
# which ships an sdist that is pure Python in ABI mode and needs no compiler
# either. rawpy bundles LibRaw inside its wheel, so those headers were never
# read.
#
# If a dependency ever does need to compile, build-essential goes back here with
# the package that needed it named alongside it.

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_NO_CACHE_DIR=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /build
COPY requirements.txt ./
RUN pip install -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM python:${PYTHON_VERSION} AS runtime

# Every package is here for a format, and nothing else gets in.
#
#   libvips42     — the decoder. Debian's build already links libheif, poppler
#                   and libjxl, which is why this image does not compile libvips
#                   from source: the flags that would matter are already set.
#   libheif1      — HEIC/HEIF. The reason this service exists: it is LGPL, so it
#                   cannot be conveyed to a browser from an MIT front end, but
#                   on a server nothing is conveyed to anyone.
#   libraw23      — camera RAW, under rawpy.
#   libjxl0.7     — JPEG XL, for the browsers that are not Safari.
#   libpoppler    — PDF first-page rendering.
#   ca-certificates, tini — TLS trust, and PID 1 that reaps children.
#
# ImageMagick is deliberately ABSENT. libvips would use it as a catch-all
# delegate, and it is the largest attack surface available to a service that
# decodes hostile files for a living. Anything it would have handled is either
# handled by a specific library above or refused by name.
RUN apt-get update \
 && apt-get install --no-install-recommends -y \
        libvips42 \
        libheif1 \
        libraw23 \
        libjxl0.7 \
        libpoppler-glib8 \
        ca-certificates \
        tini \
 && rm -rf /var/lib/apt/lists/*

# uid/gid 10001: high, fixed, outside the host's normal range, no home, no shell.
RUN groupadd --system --gid 10001 app \
 && useradd  --system --uid 10001 --gid 10001 \
             --no-create-home --shell /usr/sbin/nologin app

COPY --from=builder --chown=root:root /opt/venv /opt/venv
COPY --chown=root:root app /app/app

# Root-owned and unwritable by the runtime user: a process compromised while
# decoding a malicious file cannot rewrite the code that runs next boot.
RUN chmod -R a-w /app /opt/venv

ENV PATH="/opt/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    # libvips caches operations across calls, which is a real win for a
    # thumbnail farm doing the same work repeatedly and pure overhead here,
    # where every request is a different one-shot file. Off, so the cache
    # cannot hold decoded pixels from one user's upload while the next is
    # served.
    VIPS_CONCURRENCY=2 \
    VIPS_DISC_THRESHOLD=0

# No writable directory is created, deliberately. This service never writes a
# file: uploads are decoded from memory and returned in the response body, so
# there is no temporary path to leak, to forget to clean up, or to be read by
# the following request.

USER 10001:10001
WORKDIR /app
EXPOSE 8080
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import os,urllib.request,sys; sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/healthz', timeout=4).status==200 else 1)"]

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
# One worker per container; Railway scales by replica, and a second worker here
# would double the memory ceiling a single decompression bomb has to exhaust.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
