"""Endpoint behaviour, with the image libraries stubbed.

libvips and LibRaw cannot be installed everywhere this test suite runs, and the
HTTP contract is worth testing regardless — the limits, the status codes, and
above all the guarantee that a library's exception text never reaches a client.
Those are the parts that fail *quietly* in production, so they are the parts
that need covering without a full image toolchain present.

What this deliberately does not claim to test is decoding itself. A stub cannot
tell you whether libvips was built with its HEIF loader. That check lives in
`/healthz`, which reports the loaders it actually found, and in the smoke test
run against the first deploy.
"""

from __future__ import annotations

import io
import struct
import sys
import types

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def stub_image_libraries(monkeypatch: pytest.MonkeyPatch):
    """Puts fake pyvips/rawpy/numpy on sys.modules before the app imports them.

    `app.main` imports them inside functions rather than at module scope, which
    is what makes this possible — and is also why a broken install shows up as a
    failed health check rather than a container that will not boot.

    The stubs are removed afterwards. `sys.modules` is process-global, so a stub
    left behind is visible to every later test in the run — a fake `numpy` in
    particular breaks `pytest.approx`, which reaches for it to decide whether a
    value is an array.
    """
    installed = []
    for name in ("pyvips", "rawpy", "numpy"):
        if name not in sys.modules:
            sys.modules[name] = types.ModuleType(name)
            installed.append(name)
    try:
        yield
    finally:
        for name in installed:
            sys.modules.pop(name, None)


@pytest.fixture()
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


def heic_bytes(payload: int = 64) -> bytes:
    return b"\x00\x00\x00\x20ftypheic" + b"\x00" * payload


class TestWhatItRefuses:
    def test_a_browser_format_is_refused_as_unsupported(self, client: TestClient) -> None:
        png = (
            b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR"
            + struct.pack(">II", 8, 8) + b"\x08\x06\x00\x00\x00"
        )
        response = client.post("/v1/decode", files={"file": ("a.png", png, "image/png")})
        assert response.status_code == 415
        assert "browser" in response.json()["error"]

    def test_an_empty_upload_is_a_client_error(self, client: TestClient) -> None:
        response = client.post("/v1/decode", files={"file": ("a.heic", b"", "image/heic")})
        assert response.status_code == 400

    def test_an_oversized_upload_is_refused_with_the_limit(self, client: TestClient) -> None:
        from app.sniff import MAX_UPLOAD_BYTES

        blob = b"\x00" * (MAX_UPLOAD_BYTES + 1024)
        response = client.post("/v1/decode", files={"file": ("big.heic", blob, "image/heic")})
        assert response.status_code == 413
        assert "80 MB" in response.json()["error"]

    def test_unrecognised_bytes_are_refused(self, client: TestClient) -> None:
        response = client.post(
            "/v1/decode", files={"file": ("x.bin", b"just some text, not an image", "application/octet-stream")}
        )
        assert response.status_code == 415


class TestWhatItNeverLeaks:
    def test_a_library_exception_never_reaches_the_client(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # libvips and LibRaw put absolute paths and buffer offsets in their
        # error strings. Returning one verbatim hands out the container's
        # filesystem layout.
        import app.main as main

        def explode(data: bytes, filename: str) -> bytes:
            raise RuntimeError("/opt/venv/lib/vips: bad seek at offset 0xdeadbeef")

        monkeypatch.setattr(main, "_decode_to_png", explode)
        response = client.post(
            "/v1/decode", files={"file": ("a.heic", heic_bytes(), "image/heic")}
        )
        assert response.status_code == 500
        body = response.text
        assert "0xdeadbeef" not in body
        assert "/opt/venv" not in body
        assert response.json()["error"] == "This file could not be decoded."

    def test_a_slow_decode_is_stopped_rather_than_held(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # A malformed RAW can put LibRaw in a very long loop. Without the
        # timeout the worker is held indefinitely.
        import time

        import app.main as main

        monkeypatch.setattr(main, "DECODE_TIMEOUT_S", 0.05)
        monkeypatch.setattr(main, "_decode_to_png", lambda d, f: time.sleep(5))
        response = client.post(
            "/v1/decode", files={"file": ("a.heic", heic_bytes(), "image/heic")}
        )
        assert response.status_code == 504

    def test_the_response_forbids_caching(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Nothing is stored server-side, so nothing between here and the tab may
        # hold a copy either.
        import app.main as main

        monkeypatch.setattr(main, "_decode_to_png", lambda d, f: b"\x89PNG-pretend")
        response = client.post(
            "/v1/decode", files={"file": ("a.heic", heic_bytes(), "image/heic")}
        )
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["content-type"] == "image/png"


class TestCors:
    def test_only_the_portfolio_may_call_it(self, client: TestClient) -> None:
        # A wildcard would let any page on the internet spend this CPU.
        allowed = client.options(
            "/v1/decode",
            headers={
                "Origin": "https://kavithakanchana.me",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert allowed.headers.get("access-control-allow-origin") == "https://kavithakanchana.me"

        denied = client.options(
            "/v1/decode",
            headers={
                "Origin": "https://not-the-portfolio.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in denied.headers
