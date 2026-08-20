"""What a file actually is, and whether it is safe to decode.

Deliberately free of pyvips, so every decision in it can be tested without
libvips installed. The module that does the decoding imports this one; not the
other way round.

Two jobs, both of which are the difference between a service and an incident:

1. **Identify by content, never by name.** The extension on an upload is
   attacker-supplied text. libvips picks its loader from the bytes, so a file
   called `photo.heic` that is really a TIFF is handled correctly regardless —
   but the *routing* here has to agree, or the size limits below get applied to
   the wrong format.

2. **Refuse decompression bombs before allocating anything.** This is the whole
   security story of an image service. A 32 kB PNG can declare 65535x65535 and
   expand to 17 GB of RGBA on decode; the container gets OOM-killed and the
   service goes down for everyone. Every header here is parsed to get the
   declared dimensions *without* decoding, and anything past the budget is
   refused with the numbers in the message.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

#: Formats worth running a server for.
#:
#: Short on purpose, and it is the browser that decides what belongs here: this
#: service exists only for what a browser genuinely cannot read. PNG, JPEG,
#: WebP, GIF and AVIF are all decoded natively in the tab, so sending one here
#: would be a pointless round trip and is refused rather than served.
SUPPORTED = frozenset({"heic", "heif", "raw", "tiff", "pdf", "jxl", "bmp"})

#: Refuse anything whose *declared* pixel count exceeds this, before decoding.
#:
#: 100 megapixels admits every consumer camera (a 102 MP medium-format back is
#: the first thing it turns away) while capping a single request's RGBA
#: allocation at roughly 400 MB. Raising it means raising the container's memory
#: limit in lockstep, or the first bomb takes the service down.
MAX_PIXELS = 100_000_000

#: Refuse before reading the body. Guards the network and the disk, not memory.
MAX_UPLOAD_BYTES = 80 * 1024 * 1024


class UnsupportedFile(Exception):
    """The bytes are not something this service will decode."""


class TooLarge(Exception):
    """Valid, but past a limit. The message carries the numbers."""


@dataclass(frozen=True)
class Probe:
    kind: str
    width: Optional[int] = None
    height: Optional[int] = None

    @property
    def pixels(self) -> Optional[int]:
        if self.width is None or self.height is None:
            return None
        return self.width * self.height


def _u16(b: bytes, off: int, little: bool) -> int:
    return int.from_bytes(b[off : off + 2], "little" if little else "big")


def _u32(b: bytes, off: int, little: bool) -> int:
    return int.from_bytes(b[off : off + 4], "little" if little else "big")


def _tiff_dimensions(b: bytes) -> tuple[Optional[int], Optional[int]]:
    """Reads ImageWidth/ImageLength out of the first IFD.

    Shared by TIFF proper and by every camera RAW format, because essentially
    all of them are TIFF containers with proprietary tags bolted on. That is
    also why the dimensions here are advisory for RAW: the first IFD of a CR2 or
    NEF frequently describes the *embedded JPEG preview* rather than the sensor
    image, so this can under-report. The real check happens again after libvips
    reports the true size — this pass only rejects the obviously absurd.
    """
    if len(b) < 8:
        return None, None
    little = b[0:2] == b"II"
    if not little and b[0:2] != b"MM":
        return None, None
    if _u16(b, 2, little) != 42:  # 43 is BigTIFF, not handled
        return None, None

    ifd = _u32(b, 4, little)
    if ifd + 2 > len(b):
        return None, None
    count = _u16(b, ifd, little)

    width = height = None
    for i in range(count):
        entry = ifd + 2 + i * 12
        if entry + 12 > len(b):
            break
        tag = _u16(b, entry, little)
        kind = _u16(b, entry + 2, little)
        # SHORT values sit in the low half of the value field; LONG fill it.
        value = _u16(b, entry + 8, little) if kind == 3 else _u32(b, entry + 8, little)
        if tag == 256:
            width = value
        elif tag == 257:
            height = value
        if width is not None and height is not None:
            break
    return width, height


def _png_dimensions(b: bytes) -> tuple[Optional[int], Optional[int]]:
    # IHDR is mandated to be the first chunk, so the size is always at a fixed
    # offset. This is the classic bomb: the header is 33 bytes and can claim any
    # dimensions it likes.
    if len(b) < 24:
        return None, None
    return _u32(b, 16, False), _u32(b, 20, False)


def _heif_brand(b: bytes) -> Optional[str]:
    """Distinguishes HEIC/HEIF/AVIF, which share the ISOBMFF container.

    All three are `ftyp` boxes and differ only by brand, so a naive check routes
    an AVIF — which every browser reads perfectly well — to the server for no
    reason.
    """
    if len(b) < 12 or b[4:8] != b"ftyp":
        return None
    brand = b[8:12]
    if brand in (b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis"):
        return "heic"
    if brand in (b"mif1", b"msf1"):
        return "heif"
    if brand in (b"avif", b"avis"):
        return "avif"
    return None


#: RAW formats, by the signature that actually identifies them.
#:
#: Most are TIFF variants, so the TIFF magic alone is not enough to tell a scan
#: from a camera file — the discriminator is the maker-specific bytes that
#: follow, or the extension as a last resort.
_RAW_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"II\x2a\x00\x10\x00\x00\x00CR", "cr2"),   # Canon
    (b"IIRO", "orf"),                            # Olympus
    (b"IIU\x00", "rw2"),                         # Panasonic
    (b"FUJIFILMCCD-RAW", "raf"),                 # Fujifilm
    (b"II\x1a\x00\x00\x00HEAPCCDR", "crw"),      # Canon, pre-CR2
)

_RAW_EXTENSIONS = frozenset(
    {"cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "dng",
     "raf", "orf", "rw2", "raw", "pef", "srw", "x3f", "3fr", "mrw"}
)


def sniff(data: bytes, filename: str = "") -> Probe:
    """Identifies a file from its bytes, using the name only to break ties.

    Raises `UnsupportedFile` for anything this service will not decode —
    including formats the *browser* handles, which must never be sent here.
    """
    if len(data) < 12:
        raise UnsupportedFile("The file is too short to be an image.")

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    brand = _heif_brand(data)
    if brand == "avif":
        raise UnsupportedFile(
            "AVIF is decoded by the browser itself, so it is not sent here."
        )
    if brand in ("heic", "heif"):
        return Probe(kind=brand)

    if data[:4] == b"\x89PNG":
        raise UnsupportedFile("PNG is decoded by the browser itself.")
    if data[:3] == b"\xff\xd8\xff":
        raise UnsupportedFile("JPEG is decoded by the browser itself.")
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        raise UnsupportedFile("WebP is decoded by the browser itself.")
    if data[:6] in (b"GIF87a", b"GIF89a"):
        raise UnsupportedFile("GIF is decoded by the browser itself.")

    if data[:5] == b"%PDF-":
        return Probe(kind="pdf")

    # PSD is deliberately absent. libvips has no native Photoshop loader, so it
    # would decode through ImageMagick, and this allowlist is the only thing
    # keeping ImageMagick unreachable. Accepting one format that needs it would
    # undo that for every file.
    if data[:4] == b"8BPS":
        raise UnsupportedFile(
            "Photoshop files are not supported. Export a PNG or TIFF instead."
        )

    # JPEG XL: raw codestream, or the ISOBMFF-wrapped form.
    if data[:2] == b"\xff\x0a" or data[:12] == b"\x00\x00\x00\x0cJXL \x0d\x0a\x87\x0a":
        return Probe(kind="jxl")

    for signature, _maker in _RAW_SIGNATURES:
        if data.startswith(signature):
            w, h = _tiff_dimensions(data)
            return Probe(kind="raw", width=w, height=h)

    if data[:15] == b"FUJIFILMCCD-RAW":
        return Probe(kind="raw")

    # TIFF-shaped. Whether it is a scan or a camera RAW is decided by the
    # extension, since by this point the bytes alone cannot tell us.
    if data[:2] in (b"II", b"MM"):
        w, h = _tiff_dimensions(data)
        kind = "raw" if ext in _RAW_EXTENSIONS else "tiff"
        return Probe(kind=kind, width=w, height=h)

    # Sony ARW and Nikon NEF are TIFF-shaped and caught above. CR3 is not — it
    # is an ISOBMFF file whose brand `crx ` is not in the HEIF table.
    if ext in _RAW_EXTENSIONS:
        return Probe(kind="raw")

    if data[:2] == b"BM":
        w = _u32(data, 18, True) if len(data) >= 26 else None
        h = _u32(data, 22, True) if len(data) >= 26 else None
        return Probe(kind="bmp", width=w, height=h)

    raise UnsupportedFile(
        "This file was not recognised as an image format this service decodes."
    )


def check_budget(probe: Probe, max_pixels: int = MAX_PIXELS) -> None:
    """Refuses a declared pixel count past the budget, before any decode.

    Only meaningful when the header gave us dimensions. Formats where it did not
    — HEIC, PDF, JPEG XL — are checked by the caller once libvips has opened the
    file but before it has rendered any pixels.
    """
    pixels = probe.pixels
    if pixels is None:
        return
    if pixels > max_pixels:
        raise TooLarge(
            f"That image declares {pixels // 1_000_000} megapixels, past the "
            f"{max_pixels // 1_000_000} megapixel limit. Nothing was decoded."
        )
