# image-api

A decoder for the formats a browser cannot read. One endpoint, one output
format, nothing stored.

## Why this exists at all

The image converter in the portfolio does everything in the tab: twelve output
formats, quality settings, batch conversion, animation. It needs a server for
exactly one thing — **reading iPhone HEIC and camera RAW** — and the reason is
licensing rather than capability.

libheif and LibRaw are LGPL. The portfolio is MIT under a *third-party*
copyright, so it cannot be relicensed and copyleft cannot be conveyed to a
browser from it. On a server nothing is conveyed to anyone, and the question
disappears. (There is no `@jsquash/heic`; the one npm package that looks like a
clean-licence LibRaw wrapper declares MIT while the WASM inside it is
LGPL-2.1/CDDL.)

The performance argument agrees with the licensing one. RAW files run 20–50 MB
and HEIC comes off phones at 12 megapixels — the two cases you would most want
off a phone's CPU anyway.

## The contract

```
POST /v1/decode      multipart file  ->  image/png
GET  /healthz                        ->  {ok, libvips, loaders}
```

Give it a file the browser cannot read, get back a PNG it can. The tab then runs
its ordinary pipeline on that PNG, so HEIC and RAW inherit all twelve output
formats, the quality slider and batch handling **without a line of that logic
existing twice**. Anything the browser already reads — PNG, JPEG, WebP, GIF,
AVIF — is refused with a 415 rather than served, because sending one here would
be a pointless upload of a file the tab could already open.

## Nothing is stored

Not "deleted promptly" — never written. The upload is read into memory, decoded
from that buffer, and the PNG goes back in the response body. No temporary file
exists to leak, to forget to clean up, or to be read by the next request; a
crash mid-request takes the bytes with it. The container creates no writable
directory at all.

The browser side matches: the upload is **never automatic**. The page promises
files stay on the device, so a HEIC produces an offer — "send this file to the
server to convert it?" — and nothing is transmitted until that specific file is
approved. Uploading silently would be easier and nobody would notice, which is
precisely why it is not done.

## What decodes what

| Input | Decoder | Notes |
|---|---|---|
| HEIC / HEIF | libheif via libvips | the iPhone case |
| Camera RAW | LibRaw via `rawpy` | CR2/CR3, NEF, ARW, DNG, RAF, ORF, RW2… |
| TIFF (CMYK, fax, LZW) | libvips | the variants the browser build refuses |
| PDF | poppler via libvips | first page |
| PSD | libvips | flattened composite |
| JPEG XL | libjxl via libvips | for browsers that are not Safari |

**ImageMagick is deliberately absent.** libvips would happily use it as a
catch-all delegate, and it is the largest attack surface available to a service
that decodes hostile files for a living — a decade of CVEs and dozens of
delegate formats nobody asked for. RAW goes through `rawpy` instead: thin MIT
bindings straight onto LibRaw, one format family, no delegates. That is also
simply better at the job, since the ImageMagick path frequently returns a RAW
file's *embedded JPEG preview* rather than the sensor data.

## The limits, and why each number

| Limit | Value | Reason |
|---|---|---|
| Upload | 80 MB | guards the network; a large RAW is ~50 MB |
| Pixels | 100 MP | **the security control.** A 32 kB PNG can declare 65535×65535 and expand to 17 GB of RGBA on decode. Every header is parsed for its declared size *before* anything is allocated, and 100 MP caps one request at ~400 MB. Raising it means raising the container's memory in lockstep. |
| Decode | 25 s | a malformed RAW can put LibRaw in a very long loop, and libvips will wait forever |

Formats whose headers do not expose dimensions cheaply — HEIC, PDF, JPEG XL —
are checked a second time once libvips has parsed the file but before it renders
any pixel, which `access="sequential"` defers.

## Deploying

Railway, own service, Dockerfile builder. Set:

```
ALLOWED_ORIGINS=https://kavithakanchana.me
```

then point the front end at it with `NEXT_PUBLIC_IMAGE_API`. **With that
variable unset the tool is browser-only and simply refuses HEIC and RAW** —
a supported state, not a misconfiguration, and what ships until the service is
up.

Two things to do by hand after the first deploy, because neither can be done
from a repository:

1. **Set a Railway usage limit** (soft $15 / hard $30). This service decodes
   arbitrary uploads; a bad week should stop at a cap rather than an invoice.
2. **Smoke-test the loaders.** `GET /healthz` reports what libvips was actually
   built with. A libvips missing its HEIF loader starts fine, serves fine, and
   fails every real request — so check `loaders` contains `heifload` before
   pointing the front end at it, then convert one real HEIC and one real RAW.

## Testing

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt pytest
.venv/bin/python -m pytest tests/ -q
```

The suite covers content sniffing, the bomb guard, and the HTTP contract —
status codes, the CORS lock, and the guarantee that a library's exception text
never reaches a client, since libvips and LibRaw put filesystem paths in their
error messages.

It runs **without libvips installed**, which is why `app/sniff.py` imports no
pyvips and `app/main.py` imports it inside functions. What that cannot test is
decoding itself: a stub cannot tell you whether the image was built with its
HEIF loader. That is what `/healthz` and the first-deploy smoke test are for.
