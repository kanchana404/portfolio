"""Tests for content sniffing and the bomb guard.

These run without libvips, which is the point of keeping `sniff` free of pyvips
— the security-critical decisions stay testable anywhere, including on a laptop
with no image toolchain at all.
"""

from __future__ import annotations

import struct

import pytest

from app.sniff import (
    MAX_PIXELS,
    Probe,
    TooLarge,
    UnsupportedFile,
    check_budget,
    sniff,
)


def png(width: int, height: int) -> bytes:
    """A PNG header declaring any size, which is exactly the bomb shape."""
    return (
        b"\x89PNG\r\n\x1a\n"
        + struct.pack(">I", 13)
        + b"IHDR"
        + struct.pack(">II", width, height)
        + b"\x08\x06\x00\x00\x00"
    )


def tiff(width: int, height: int, little: bool = True) -> bytes:
    order = b"II" if little else b"MM"
    end = "<" if little else ">"
    out = bytearray(order + struct.pack(end + "HI", 42, 8))
    out += struct.pack(end + "H", 2)  # two fields
    for tag, value in ((256, width), (257, height)):
        out += struct.pack(end + "HHI", tag, 4, 1) + struct.pack(end + "I", value)
    out += struct.pack(end + "I", 0)
    return bytes(out)


def heif(brand: bytes) -> bytes:
    return b"\x00\x00\x00\x20ftyp" + brand + b"\x00\x00\x00\x00" + b"\x00" * 16


class TestRoutingAwayFromTheServer:
    """Formats the browser reads must never make the round trip."""

    @pytest.mark.parametrize(
        "data, name",
        [
            (png(10, 10), "PNG"),
            (b"\xff\xd8\xff\xe0" + b"\x00" * 20, "JPEG"),
            (b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 8, "WebP"),
            (b"GIF89a" + b"\x00" * 16, "GIF"),
            (heif(b"avif"), "AVIF"),
        ],
    )
    def test_browser_formats_are_refused(self, data: bytes, name: str) -> None:
        # Sending one of these here would be a pointless upload of a file the
        # tab could already read — slower, and a privacy regression for nothing.
        with pytest.raises(UnsupportedFile, match="browser"):
            sniff(data, f"x.{name.lower()}")

    def test_avif_is_not_mistaken_for_heic(self) -> None:
        # Both are ISOBMFF and differ only by brand. Getting this wrong sends
        # every AVIF to the server.
        assert sniff(heif(b"heic")).kind == "heic"
        with pytest.raises(UnsupportedFile):
            sniff(heif(b"avif"))


class TestWhatTheServerIsFor:
    def test_recognises_heic_by_its_brands(self) -> None:
        for brand in (b"heic", b"heix", b"heim", b"heis"):
            assert sniff(heif(brand)).kind == "heic", brand
        for brand in (b"mif1", b"msf1"):
            assert sniff(heif(brand)).kind == "heif", brand

    def test_recognises_pdf_and_psd(self) -> None:
        assert sniff(b"%PDF-1.7" + b"\x00" * 16).kind == "pdf"
        assert sniff(b"8BPS\x00\x01" + b"\x00" * 16).kind == "psd"

    def test_recognises_both_jpeg_xl_forms(self) -> None:
        # The raw codestream and the container are the same format; a converter
        # that handles only one rejects half the files in the wild.
        assert sniff(b"\xff\x0a" + b"\x00" * 16).kind == "jxl"
        assert sniff(b"\x00\x00\x00\x0cJXL \x0d\x0a\x87\x0a" + b"\x00" * 8).kind == "jxl"

    def test_canon_cr2_is_raw_not_tiff(self) -> None:
        # A CR2 is a TIFF container. Without the maker signature it would be
        # routed as a scan and decoded to the embedded preview, not the photo.
        data = b"II\x2a\x00\x10\x00\x00\x00CR\x02\x00" + b"\x00" * 16
        assert sniff(data).kind == "raw"

    def test_tiff_shaped_raw_falls_back_to_the_extension(self) -> None:
        # Sony ARW and Nikon NEF are plain TIFF at the front. The bytes cannot
        # distinguish them from a scan, so the name is the tie-breaker — the one
        # place it is allowed to matter.
        assert sniff(tiff(6000, 4000), "shot.arw").kind == "raw"
        assert sniff(tiff(6000, 4000), "shot.nef").kind == "raw"
        assert sniff(tiff(6000, 4000), "scan.tif").kind == "tiff"

    def test_cr3_is_recognised_though_it_is_not_tiff(self) -> None:
        # CR3 is ISOBMFF with a brand the HEIF table does not list, so only the
        # extension identifies it.
        assert sniff(b"\x00\x00\x00\x18ftypcrx " + b"\x00" * 16, "shot.cr3").kind == "raw"

    def test_reads_tiff_dimensions_in_both_byte_orders(self) -> None:
        assert sniff(tiff(800, 600, little=True), "a.tif").width == 800
        assert sniff(tiff(800, 600, little=False), "a.tif").height == 600

    def test_refuses_what_it_does_not_know(self) -> None:
        with pytest.raises(UnsupportedFile):
            sniff(b"not an image at all, just text")
        with pytest.raises(UnsupportedFile, match="too short"):
            sniff(b"tiny")


class TestTheBombGuard:
    def test_refuses_a_declared_bomb_before_decoding(self) -> None:
        # 65535 x 65535 in a 33-byte header is 4.3 gigapixels — 17 GB of RGBA.
        # The file itself can be under a kilobyte.
        probe = Probe(kind="tiff", width=65535, height=65535)
        with pytest.raises(TooLarge, match="megapixel"):
            check_budget(probe)

    def test_the_refusal_states_both_numbers(self) -> None:
        # "Too large" without the limit leaves the person guessing what would
        # have worked.
        probe = Probe(kind="tiff", width=20000, height=20000)
        with pytest.raises(TooLarge) as caught:
            check_budget(probe)
        assert "400 megapixels" in str(caught.value)
        assert "100 megapixel" in str(caught.value)

    def test_admits_every_real_camera(self) -> None:
        # 61 MP (Sony A7R V) and 102 MP would be the extremes; the budget is set
        # so consumer bodies pass and only medium-format backs are turned away.
        check_budget(Probe(kind="raw", width=9504, height=6336))  # 60 MP
        check_budget(Probe(kind="tiff", width=8256, height=5504))  # 45 MP

    def test_says_nothing_when_the_header_gave_no_size(self) -> None:
        # HEIC, PDF and JPEG XL do not expose dimensions this cheaply. They are
        # checked after libvips opens the file but before it renders, so a
        # missing size here must not be treated as a pass *or* a failure.
        check_budget(Probe(kind="heic"))

    def test_the_budget_matches_the_documented_memory_ceiling(self) -> None:
        # 100 MP of RGBA is ~400 MB. If this constant moves, the container's
        # memory limit has to move with it or the first bomb wins.
        peak_megabytes = MAX_PIXELS * 4 // 1_000_000
        assert peak_megabytes == 400
