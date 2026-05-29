#!/usr/bin/env python3
"""Shared helpers for ZenMux image generation scripts."""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import re
import sys
import urllib.request
from dataclasses import dataclass

GEMINI_PREFIX = "google/"
OPENAI_IMAGE_MODELS = {
    "openai/gpt-image-2",
    "openai/gpt-image-1.5",
    "gpt-image-2",
    "gpt-image-1.5",
}
ZENMUX_BASE_URL = "https://zenmux.ai/api/vertex-ai"
ZENMUX_OPENAI_BASE_URL = "https://zenmux.ai/api/v1"
ZENMUX_API_KEY_ENV = "ZENMUX_API_KEY"
SKILL_DIR = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = SKILL_DIR / "output"
GPT_IMAGE_2_MIN_PIXELS = 655_360
GPT_IMAGE_2_MAX_PIXELS = 8_294_400
VERTEX_PRESET_SIZES = {"1024x1024", "1024x1536", "1536x1024", "auto"}


def slugify(value: str, max_len: int = 40) -> str:
    """Filesystem-safe slug derived from a model name."""
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-")
    return slug[:max_len] or "image"


def load_prompt(path: pathlib.Path) -> str:
    """Read a prompt file and strip the human metadata header if present."""
    text = path.read_text(encoding="utf-8")
    parts = re.split(r"(?m)^---\s*$", text, maxsplit=1)
    body = parts[1] if len(parts) == 2 else parts[0]
    body = body.strip()
    if not body:
        raise SystemExit(f"Error: prompt file '{path}' is empty after stripping metadata.")
    return body


_MIME_BY_EXT = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "heif": "image/heif",
    "gif": "image/gif",
    "bmp": "image/bmp",
}


@dataclass(frozen=True)
class ReferenceImage:
    raw: str
    data: bytes
    mime_type: str


def _local_reference_path(raw: str) -> pathlib.Path:
    lower = raw.lower()
    if lower.startswith("file://"):
        raw = raw[7:]
        if not raw.startswith("/") and "/" in raw:
            raw = "/" + raw.split("/", 1)[1]

    path = pathlib.Path(raw).expanduser()
    if not path.is_absolute():
        path = (pathlib.Path.cwd() / path).resolve()
    return path


def fetch_reference_image(ref: str, *, allow_data_url: bool = False) -> ReferenceImage:
    """Load reference-image bytes from a local path, file URL, data URL, or URL."""
    raw = ref.strip().strip('"').strip("'")
    lower = raw.lower()

    if allow_data_url and lower.startswith("data:image/"):
        header, _, b64_data = raw.partition(",")
        mime = header.removeprefix("data:").split(";", 1)[0] or "image/png"
        try:
            data = base64.b64decode(b64_data)
        except Exception as exc:  # noqa: BLE001 - script entrypoint needs a clear error
            raise SystemExit(f"Error: invalid data URL reference image: {exc}") from exc
        if not data:
            raise SystemExit("Error: data URL reference image is empty.")
        return ReferenceImage(raw=raw, data=data, mime_type=mime)

    if lower.startswith("http://") or lower.startswith("https://"):
        try:
            with urllib.request.urlopen(raw, timeout=30) as resp:  # noqa: S310
                data = resp.read()
                mime = resp.headers.get_content_type() or "image/png"
        except Exception as exc:  # noqa: BLE001 - any network/parse failure is user-actionable
            raise SystemExit(
                f"Error: failed to download reference image '{raw}': {exc}\n"
                f"Hint: confirm the URL is reachable and returns an image."
            ) from exc
        if not data:
            raise SystemExit(f"Error: reference URL returned 0 bytes: {raw}")
        return ReferenceImage(raw=raw, data=data, mime_type=mime)

    path = _local_reference_path(raw)
    if not path.exists():
        raise SystemExit(
            f"Error: reference image not found: {ref}\n"
            f"Resolved to: {path}\n"
            f"Hint: pass an absolute path, an http(s) URL, or a path relative to {pathlib.Path.cwd()}."
        )
    if not path.is_file():
        raise SystemExit(f"Error: reference path is not a regular file: {path}")

    suffix = path.suffix.lower().lstrip(".")
    mime = _MIME_BY_EXT.get(suffix, "image/png")
    if suffix and suffix not in _MIME_BY_EXT:
        sys.stderr.write(
            f"Warning: unknown image extension '.{suffix}' for {path}; "
            f"sending as image/png. Convert to PNG/JPEG/WebP if the model rejects it.\n"
        )

    try:
        data = path.read_bytes()
    except OSError as exc:
        raise SystemExit(f"Error: cannot read reference image {path}: {exc}") from exc
    if not data:
        raise SystemExit(f"Error: reference file is empty: {path}")
    return ReferenceImage(raw=ref, data=data, mime_type=mime)


def reference_bytes(refs: list[ReferenceImage]) -> list[tuple[bytes, str]]:
    return [(ref.data, ref.mime_type) for ref in refs]


def ensure_output_dir(path: pathlib.Path) -> pathlib.Path:
    path = path.expanduser()
    if not path.is_absolute():
        path = (pathlib.Path.cwd() / path).resolve()
    else:
        path = path.resolve()

    path.mkdir(parents=True, exist_ok=True)
    return path


def make_filename(model: str, ext: str, idx: int, run_ts: str) -> str:
    return f"{slugify(model)}-{run_ts}-{idx:02d}.{ext}"


def ext_from_mime(mime: str | None, default: str = "png") -> str:
    if not mime:
        return default
    return {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
    }.get(mime.lower(), default)


def openai_output_format(output_format: str | None) -> str | None:
    if not output_format:
        return None
    return {
        "image/png": "png",
        "image/jpeg": "jpeg",
        "image/webp": "webp",
    }.get(output_format, output_format)


def mime_from_openai_format(output_format: str | None) -> str:
    fmt = openai_output_format(output_format) or "png"
    return {
        "png": "image/png",
        "jpeg": "image/jpeg",
        "jpg": "image/jpeg",
        "webp": "image/webp",
    }.get(fmt, "image/png")


def is_openai_image_model(model: str) -> bool:
    return model in OPENAI_IMAGE_MODELS


def is_gpt_image_2(model: str) -> bool:
    return model in {"openai/gpt-image-2", "gpt-image-2"}


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model", required=True, help="ZenMux model id.")
    parser.add_argument(
        "--prompt-file",
        required=True,
        type=pathlib.Path,
        help="Path to a prompt file. Metadata above a standalone '---' is stripped.",
    )
    parser.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to save images. Defaults to this skill's output folder: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument("--n", type=int, default=4, help="Number of images to generate, 1-10.")
    parser.add_argument("--size", default="1024x1024", help="Image size, e.g. 1024x1024 or 1536x1024.")
    parser.add_argument("--quality", default="medium", choices=["low", "medium", "high", "auto"])
    parser.add_argument(
        "--output-format",
        default="image/png",
        choices=["image/png", "image/jpeg", "image/webp"],
        help="Output MIME type.",
    )
    parser.add_argument("--compression", type=int, default=None, help="Compression quality 0-100.")
    parser.add_argument(
        "--reference-image",
        action="append",
        default=[],
        help="Path, URL, or data URL to a reference image. Repeat for multiple references.",
    )
    parser.add_argument("--mask-image", default=None, help="Optional mask image path or URL for image edits.")


def require_api_key() -> str:
    api_key = os.environ.get(ZENMUX_API_KEY_ENV)
    if not api_key:
        raise SystemExit(
            f"Error: environment variable {ZENMUX_API_KEY_ENV} is not set.\n"
            f"Please export your ZenMux API key first:\n"
            f"  export {ZENMUX_API_KEY_ENV}=..."
        )
    return api_key


def validate_n(n: int) -> None:
    if n < 1 or n > 10:
        raise SystemExit("Error: --n must be between 1 and 10 (inclusive).")


def validate_compression(value: int | None) -> None:
    if value is not None and (value < 0 or value > 100):
        raise SystemExit("Error: --compression must be between 0 and 100.")


def parse_pixel_size(size: str) -> tuple[int, int]:
    match = re.fullmatch(r"(\d+)x(\d+)", size)
    if not match:
        raise SystemExit(f"Error: invalid --size '{size}'. Expected WIDTHxHEIGHT, e.g. 1024x1536.")
    width, height = int(match.group(1)), int(match.group(2))
    if width <= 0 or height <= 0:
        raise SystemExit(f"Error: invalid --size '{size}'. Width and height must be positive.")
    return width, height


def nearest_multiple_of_16(value: int) -> int:
    return max(16, round(value / 16) * 16)


def suggest_gpt_image_2_size(width: int, height: int) -> str:
    width = nearest_multiple_of_16(width)
    height = nearest_multiple_of_16(height)

    ratio = width / height
    if ratio > 3:
        width = height * 3
    elif ratio < 1 / 3:
        height = width * 3

    width = nearest_multiple_of_16(width)
    height = nearest_multiple_of_16(height)

    pixels = width * height
    if pixels > GPT_IMAGE_2_MAX_PIXELS:
        scale = (GPT_IMAGE_2_MAX_PIXELS / pixels) ** 0.5
        width = nearest_multiple_of_16(int(width * scale))
        height = nearest_multiple_of_16(int(height * scale))
    elif pixels < GPT_IMAGE_2_MIN_PIXELS:
        scale = (GPT_IMAGE_2_MIN_PIXELS / pixels) ** 0.5
        width = nearest_multiple_of_16(int(width * scale))
        height = nearest_multiple_of_16(int(height * scale))

    return f"{width}x{height}"


def validate_gpt_image_2_size(size: str | None) -> None:
    if not size or size == "auto":
        return
    width, height = parse_pixel_size(size)
    pixels = width * height
    ratio = width / height
    errors: list[str] = []
    if width % 16 or height % 16:
        errors.append("each edge must be a multiple of 16")
    if ratio < 1 / 3 or ratio > 3:
        errors.append("aspect ratio must stay between 1:3 and 3:1")
    if pixels < GPT_IMAGE_2_MIN_PIXELS or pixels > GPT_IMAGE_2_MAX_PIXELS:
        errors.append(f"total pixels must be between {GPT_IMAGE_2_MIN_PIXELS:,} and {GPT_IMAGE_2_MAX_PIXELS:,}")
    if errors:
        suggestion = suggest_gpt_image_2_size(width, height)
        raise SystemExit(
            f"Error: --size '{size}' is invalid for gpt-image-2: {', '.join(errors)}.\n"
            f"Suggested nearest valid size: {suggestion}"
        )


def validate_vertex_preset_size(size: str | None) -> None:
    if size and size not in VERTEX_PRESET_SIZES:
        allowed = ", ".join(sorted(VERTEX_PRESET_SIZES))
        raise SystemExit(f"Error: --size '{size}' is not supported for this protocol. Use one of: {allowed}.")


def _common_output_dir(saved: list[pathlib.Path]) -> pathlib.Path:
    try:
        return pathlib.Path(os.path.commonpath([str(path.parent) for path in saved]))
    except ValueError:
        return saved[0].parent


def print_saved(saved: list[pathlib.Path], *, output_dir: pathlib.Path | None = None) -> None:
    if not saved:
        raise SystemExit("Error: no images were saved.")
    resolved_paths = [path.expanduser().resolve() for path in saved]
    resolved_output_dir = (output_dir.expanduser().resolve() if output_dir else _common_output_dir(resolved_paths))
    result = {
        "ok": True,
        "status": "success",
        "count": len(resolved_paths),
        "output_dir": str(resolved_output_dir),
        "image_paths": [str(path) for path in resolved_paths],
    }

    print(f"\nSUCCESS: generated and saved {len(resolved_paths)} image(s).")
    print(f"OUTPUT_DIR: {resolved_output_dir}")
    print("IMAGE_PATHS:")
    for path in resolved_paths:
        print(f"  {path}")
    print(f"RESULT_JSON: {json.dumps(result, ensure_ascii=False, separators=(',', ':'))}")
