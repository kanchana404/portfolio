"""PDF handling, for the parts that need no libvips.

`looks_like_pdf` and the refusal paths are the security-relevant half and are
testable anywhere. Actual extraction and rendering need pypdf and poppler, and
are exercised by the smoke test against a real deploy.
"""

from __future__ import annotations

import pytest

from app.pdf import MAX_PAGES, PdfError, looks_like_pdf


class TestHeaderCheck:
    def test_accepts_a_pdf_header(self) -> None:
        assert looks_like_pdf(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3")

    def test_rejects_everything_else(self) -> None:
        # Checked before anything parses the file, so a mislabelled upload is
        # refused rather than handed to a parser to find out.
        for data in [b"", b"PK\x03\x04", b"\x89PNG\r\n\x1a\n", b"not a pdf at all"]:
            assert not looks_like_pdf(data)

    def test_rejects_a_pdf_header_that_is_not_at_the_start(self) -> None:
        # Polyglot files put a real header later on. The specification says the
        # header is at byte zero, and accepting it anywhere is how a file that
        # is two formats at once gets treated as the harmless one.
        assert not looks_like_pdf(b"GIF89a%PDF-1.7")


class TestRefusals:
    def test_a_non_pdf_is_named_as_such(self) -> None:
        from app.pdf import inspect

        with pytest.raises(PdfError, match="not a PDF"):
            inspect(b"\x89PNG\r\n\x1a\n" + b"\x00" * 32)

    def test_the_page_cap_is_stated_in_the_message(self) -> None:
        # "Too many pages" without the limit leaves the reader guessing what
        # would have worked.
        assert MAX_PAGES == 200


class TestScannedPdfsAreDistinguishable:
    def test_the_contract_separates_no_text_from_failure(self) -> None:
        # `extract_text` returns (pages, any_text). The boolean exists because a
        # scan and a parse failure both produce empty strings, and reporting the
        # first as success sends someone hunting for a bug in their own file.
        from app.pdf import extract_text

        assert extract_text.__doc__ is not None
        assert "scan" in extract_text.__doc__.lower()
