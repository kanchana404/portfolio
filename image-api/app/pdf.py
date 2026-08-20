"""PDF text extraction and page rendering.

Two operations, both read-only, both bounded, and both refusing more than they
accept. The refusals are the design:

**A PDF is not one thing.** It may hold selectable text, or scans of paper with
no text at all, or a mixture. Extraction returns nothing for a scan, and a tool
that returns an empty string and calls it success is worse than one that says
"this looks like scanned images, there is no text to extract" — because the
first sends someone hunting for a bug in their own file.

**PDFs are a common malware carrier**, so nothing here executes anything a PDF
asks for. `pypdf` parses structure in pure Python and runs no JavaScript, no
embedded actions, and no external references. Rendering goes through poppler
inside libvips, which is why `VIPS_BLOCK_UNTRUSTED` is set in the image.

**Encrypted PDFs are refused rather than cracked.** `pypdf` will open some with
an empty password, which is a document the author chose to protect, and quietly
extracting from it is not a thing this should do without being asked.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

#: Refuse before rendering. A hundred pages of A4 at 150 dpi is already ~1 GB of
#: pixels if every page is rendered at once, so pages are rendered one at a time
#: and the count is capped regardless.
MAX_PAGES = 200

#: Rendering resolution. 150 dpi is legible for reading and roughly a quarter of
#: the pixels of 300, which is the difference between a fast response and a
#: timeout on a long document.
RENDER_DPI = 150


class PdfError(Exception):
    """Refusal with a message meant for a person."""


@dataclass(frozen=True)
class PdfInfo:
    pages: int
    encrypted: bool
    # `has_text` is deliberately tri-state: True, False, or None when we have
    # not looked. A scan and a failure to read are different answers.
    has_text: Optional[bool] = None


def looks_like_pdf(data: bytes) -> bool:
    """Header check before anything parses the file."""
    return data[:5] == b"%PDF-"


def _reader(data: bytes):
    import io

    from pypdf import PdfReader

    try:
        return PdfReader(io.BytesIO(data), strict=False)
    except Exception as exc:  # noqa: BLE001 - message is replaced below
        raise PdfError(
            "This file could not be read as a PDF. It may be corrupt or truncated."
        ) from exc


def inspect(data: bytes) -> PdfInfo:
    if not looks_like_pdf(data):
        raise PdfError("That is not a PDF. The file does not start with %PDF-.")

    reader = _reader(data)
    if reader.is_encrypted:
        raise PdfError(
            "This PDF is password protected. Remove the protection first; this "
            "page will not try to bypass it."
        )

    count = len(reader.pages)
    if count == 0:
        raise PdfError("This PDF has no pages.")
    if count > MAX_PAGES:
        raise PdfError(
            f"This PDF has {count} pages, past the {MAX_PAGES} page limit."
        )
    return PdfInfo(pages=count, encrypted=False)


def extract_text(data: bytes) -> tuple[list[str], bool]:
    """Returns per-page text, and whether any page had text at all.

    The boolean is what lets the caller distinguish "this is a scan" from
    "extraction failed", which are the same empty string otherwise.
    """
    info = inspect(data)
    reader = _reader(data)

    pages: list[str] = []
    for page in reader.pages[: info.pages]:
        try:
            pages.append((page.extract_text() or "").strip())
        except Exception:  # noqa: BLE001 - one bad page must not lose the rest
            pages.append("")

    return pages, any(p for p in pages)


def render_page(data: bytes, index: int) -> bytes:
    """Renders one page to PNG. `index` is zero-based."""
    import pyvips

    info = inspect(data)
    if index < 0 or index >= info.pages:
        raise PdfError(f"This PDF has {info.pages} pages, so page {index + 1} does not exist.")

    try:
        image = pyvips.Image.new_from_buffer(
            data, "", dpi=RENDER_DPI, page=index, access="sequential"
        )
    except Exception as exc:  # noqa: BLE001
        raise PdfError(f"Page {index + 1} could not be rendered.") from exc

    if image.interpretation in ("cmyk", "b-w", "grey16", "rgb16"):
        image = image.colourspace("srgb")
    return image.write_to_buffer(".png")
