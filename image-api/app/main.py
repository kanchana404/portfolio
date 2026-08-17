"""A decoder, and nothing else.

The browser already converts between twelve formats perfectly well and encodes
all of them itself. What it cannot do is *read* an iPhone HEIC or a camera RAW,
because the only libraries that do are LGPL — and this project's front end is
MIT under a third-party copyright, so copyleft cannot be conveyed to a browser
from it at all. On a server nothing is conveyed to anyone, and the licence
question disappears.

So the contract is one line: **hand me a file the browser cannot read, get back
a PNG it can.** The tab then runs its existing pipeline on that PNG, which means
HEIC and RAW immediately gain all twelve output formats, quality settings and
batch handling without a single line of that logic being duplicated here.

Nothing is stored. Not "deleted promptly" — never written. The upload is read
into memory, decoded from that buffer, and the PNG is returned in the response
body; no temporary file exists to leak, to forget to clean up, or to be read by
the next request. A crash mid-request takes the bytes with it.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
from typing import Final

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.sniff import (
    MAX_PIXELS,
    MAX_UPLOAD_BYTES,
    TooLarge,
    UnsupportedFile,
    check_budget,
    sniff,
)

log = logging.getLogger("image-api")

#: Wall-clock ceiling for a single decode.
#:
#: A malformed RAW can send LibRaw into a very long loop, and libvips will
#: happily wait. Without this the worker is held indefinitely and a handful of
#: such files takes the service down without anything looking like an attack.
DECODE_TIMEOUT_S: Final[int] = 25

#: Only the portfolio may call this. A wildcard would let any page on the
#: internet use the CPU this is paying for.
ALLOWED_ORIGINS: Final[list[str]] = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS", "https://kavithakanchana.me"
    ).split(",")
    if o.strip()
]

app = FastAPI(
    title="image-api",
    docs_url=None,       # the schema is a map of the limits; nothing but our
    redoc_url=None,      # own front end is meant to call this
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["content-type"],
    max_age=86400,
)


@app.get("/healthz")
async def healthz() -> dict[str, object]:
    """Liveness, plus what libvips was actually built with.

    The loader list is the useful half. A libvips missing its HEIF loader still
    starts, serves, and passes a naive health check — then fails every real
    request. Reporting the loaders turns a silent misbuild into something the
    deploy can be checked against.
    """
    import pyvips  # imported here so a broken install fails the check, not boot

    return {
        "ok": True,
        "libvips": pyvips.version(0) if hasattr(pyvips, "version") else "unknown",
        "loaders": sorted(
            name
            for name in ("heifload", "jxlload", "pdfload", "tiffload", "magickload")
            if pyvips.type_find("VipsOperation", name) != 0
        ),
    }


def _raw_to_png(data: bytes) -> bytes:
    """Camera RAW, via LibRaw rather than through ImageMagick.

    libvips can read RAW only by delegating to ImageMagick, and ImageMagick is
    the single largest attack surface available here — a decade of CVEs, dozens
    of delegate formats nobody asked for, and a coder list that has repeatedly
    turned a malformed upload into command execution. It is compiled out of this
    image entirely (`-Dmagick=disabled`), so RAW comes through `rawpy` instead:
    thin MIT bindings straight onto LibRaw, one format family, no delegates.

    It is also simply better at the job. Going through ImageMagick often yields
    the embedded JPEG preview rather than the sensor data — a smaller, already
    processed image than the RAW the person uploaded, which defeats the point of
    shooting RAW. `postprocess` demosaics the actual sensor image.
    """
    import numpy as np
    import pyvips
    import rawpy

    with rawpy.imread(io.BytesIO(data)) as raw:
        rgb = raw.postprocess(
            # The camera's own white balance, not LibRaw's guess: it is what the
            # photographer saw on the back of the camera.
            use_camera_wb=True,
            output_bps=8,
            no_auto_bright=False,
        )

    height, width, bands = rgb.shape
    if width * height > MAX_PIXELS:
        raise TooLarge(
            f"That RAW is {width * height // 1_000_000} megapixels, past the "
            f"{MAX_PIXELS // 1_000_000} megapixel limit."
        )

    image = pyvips.Image.new_from_memory(
        np.ascontiguousarray(rgb).data, width, height, bands, "uchar"
    )
    return image.write_to_buffer(".png")


def _decode_to_png(data: bytes, filename: str) -> bytes:
    """Runs on a worker thread; every expensive call here is blocking C."""
    import pyvips

    probe = sniff(data, filename)
    check_budget(probe)  # cheap refusal, when the header told us enough

    if probe.kind == "raw":
        return _raw_to_png(data)

    try:
        image = pyvips.Image.new_from_buffer(
            data,
            "",
            # Streams the image rather than holding every intermediate: this is
            # what keeps a 60 MP RAW inside the container's memory limit.
            access="sequential",
            # `fail_on` set to truncated rather than none: a partly-corrupt file
            # otherwise decodes to a half-grey image and is returned as a
            # success, which is the failure mode this whole project avoids.
            fail_on="truncated",
        )
    except pyvips.Error as exc:  # noqa: BLE001 - message is sanitised below
        raise UnsupportedFile(
            "This file could not be decoded. It may be corrupt or use an "
            "unusual variant of its format."
        ) from exc

    # The second budget check, and the one that catches HEIC, PDF and JPEG XL —
    # formats whose headers do not expose dimensions cheaply, so the size is
    # only known once libvips has parsed them. Still before any pixel is
    # rendered, because `access="sequential"` defers all of that.
    pixels = image.width * image.height
    if pixels > MAX_PIXELS:
        raise TooLarge(
            f"That image is {pixels // 1_000_000} megapixels, past the "
            f"{MAX_PIXELS // 1_000_000} megapixel limit. Nothing was decoded."
        )

    # Flatten CMYK and drop ICC profiles into sRGB, or the PNG comes back with
    # colours that do not match what any other program shows for the same file.
    if image.interpretation in ("cmyk", "b-w", "grey16", "rgb16"):
        image = image.colourspace("srgb")

    return image.write_to_buffer(".png")


@app.post("/v1/decode")
async def decode(file: UploadFile = File(...)) -> Response:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        return JSONResponse(
            {"error": f"Files are limited to {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."},
            status_code=413,
        )
    if not data:
        return JSONResponse({"error": "No file was received."}, status_code=400)

    try:
        # A thread, because libvips releases the GIL in its C code — so this
        # genuinely runs in parallel rather than blocking the event loop and
        # stalling every other request for the duration.
        png = await asyncio.wait_for(
            asyncio.to_thread(_decode_to_png, data, file.filename or ""),
            timeout=DECODE_TIMEOUT_S,
        )
    except UnsupportedFile as exc:
        return JSONResponse({"error": str(exc)}, status_code=415)
    except TooLarge as exc:
        return JSONResponse({"error": str(exc)}, status_code=413)
    except asyncio.TimeoutError:
        return JSONResponse(
            {"error": "Decoding took too long and was stopped."}, status_code=504
        )
    except Exception:
        # Never let a library's exception text reach the response: libvips and
        # LibRaw put file paths and buffer offsets in their messages.
        log.exception("decode failed")
        return JSONResponse({"error": "This file could not be decoded."}, status_code=500)

    return Response(
        content=png,
        media_type="image/png",
        headers={
            # Nothing was stored, so nothing may be cached by anything between
            # here and the tab either.
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
