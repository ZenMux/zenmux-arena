#!/usr/bin/env python3
"""Generate or edit images through ZenMux's OpenAI Images API endpoint."""

from __future__ import annotations

import argparse
import base64
import datetime as _dt
import pathlib
import sys
import urllib.request

from image_common import (
    SKILL_DIR,
    ZENMUX_OPENAI_BASE_URL,
    ReferenceImage,
    add_common_args,
    ensure_output_dir,
    ext_from_mime,
    fetch_reference_image,
    is_gpt_image_2,
    is_openai_image_model,
    load_prompt,
    make_filename,
    mime_from_openai_format,
    openai_output_format,
    print_saved,
    require_api_key,
    validate_compression,
    validate_gpt_image_2_size,
    validate_n,
)


def _import_openai():
    try:
        from openai import OpenAI  # type: ignore
        return OpenAI
    except ImportError as exc:  # pragma: no cover - import-time guard
        sys.stderr.write(
            "Error: the `openai` package is required for OpenAI image models.\n"
            "Install this skill's dependencies once with:\n"
            f"  uv sync --project {SKILL_DIR}\n"
        )
        raise SystemExit(1) from exc


def save_openai_image_item(
    item,
    *,
    model: str,
    output_dir: pathlib.Path,
    run_ts: str,
    idx: int,
    default_mime: str,
) -> pathlib.Path:
    b64_json = getattr(item, "b64_json", None)
    url = getattr(item, "url", None)
    if isinstance(item, dict):
        b64_json = item.get("b64_json")
        url = item.get("url")

    mime = default_mime
    if b64_json:
        image_bytes = base64.b64decode(b64_json)
    elif url:
        with urllib.request.urlopen(url, timeout=120) as resp:  # noqa: S310
            image_bytes = resp.read()
            mime = resp.headers.get_content_type() or default_mime
    else:
        raise SystemExit(f"Error: OpenAI Images API item #{idx} has no b64_json or url.")

    ext = ext_from_mime(mime, default=ext_from_mime(default_mime))
    out_path = output_dir / make_filename(model, ext, idx, run_ts)
    out_path.write_bytes(image_bytes)
    return out_path


def openai_file_tuple(ref: ReferenceImage, idx: int, prefix: str = "image"):
    """Build an OpenAI SDK FileTypes value from loaded bytes.

    The SDK accepts file-like objects, bytes, pathlib paths, and multipart file
    tuples. Using tuples here lets local files, URLs, and data URLs all travel
    through the same `client.images.edit(image=...)` API shape from the Python
    SDK reference.
    """
    ext = ext_from_mime(ref.mime_type)
    return (f"{prefix}-{idx}.{ext}", ref.data, ref.mime_type)


def generate_openai_images(
    *,
    client,
    model: str,
    prompt: str,
    references: list[ReferenceImage],
    mask: ReferenceImage | None,
    n: int,
    size: str | None,
    quality: str | None,
    output_format: str | None,
    compression: int | None,
    output_dir: pathlib.Path,
    run_ts: str,
    background: str | None,
    input_fidelity: str | None,
    moderation: str | None,
    user: str | None,
) -> list[pathlib.Path]:
    params: dict = {
        "model": model,
        "prompt": prompt,
        "n": n,
    }
    if size:
        params["size"] = size
    if quality:
        params["quality"] = quality
    if background:
        params["background"] = background
    if user:
        params["user"] = user

    fmt = openai_output_format(output_format)
    if fmt:
        params["output_format"] = fmt
    if compression is not None:
        params["output_compression"] = compression

    if references:
        image_files = [openai_file_tuple(ref, idx) for idx, ref in enumerate(references, start=1)]
        params["image"] = image_files[0] if len(image_files) == 1 else image_files
        if mask is not None:
            params["mask"] = openai_file_tuple(mask, 1, prefix="mask")
        if input_fidelity:
            params["input_fidelity"] = input_fidelity
        response = client.images.edit(**params)
    else:
        if input_fidelity:
            raise SystemExit("Error: --input-fidelity requires at least one --reference-image.")
        if moderation:
            params["moderation"] = moderation
        response = client.images.generate(**params)

    items = response.get("data") if isinstance(response, dict) else getattr(response, "data", None)
    items = items or []
    if not items:
        raise SystemExit("Error: API returned no images. Check the prompt or model permissions.")

    default_mime = mime_from_openai_format(output_format)
    return [
        save_openai_image_item(
            item,
            model=model,
            output_dir=output_dir,
            run_ts=run_ts,
            idx=i,
            default_mime=default_mime,
        )
        for i, item in enumerate(items, start=1)
    ]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_common_args(parser)
    parser.add_argument("--background", choices=["transparent", "opaque", "auto"], default=None)
    parser.add_argument("--input-fidelity", choices=["high", "low"], default=None)
    parser.add_argument("--moderation", choices=["low", "auto"], default=None)
    parser.add_argument("--user", default=None, help="Optional end-user identifier passed to the OpenAI SDK.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if not is_openai_image_model(args.model):
        raise SystemExit(
            "Error: generate_openai.py only supports ZenMux's current OpenAI image models: "
            "openai/gpt-image-2 and openai/gpt-image-1.5.\n"
            "Use scripts/generate_gemini.py for non-OpenAI models or unsupported OpenAI-family ids."
        )
    validate_n(args.n)
    validate_compression(args.compression)
    if is_gpt_image_2(args.model):
        validate_gpt_image_2_size(args.size)
    if len(args.reference_image) > 16:
        raise SystemExit("Error: OpenAI GPT image edits accept at most 16 reference images.")
    if args.mask_image and not args.reference_image:
        raise SystemExit("Error: --mask-image requires at least one --reference-image.")

    api_key = require_api_key()
    prompt = load_prompt(args.prompt_file)
    output_dir = ensure_output_dir(args.output_dir)
    run_ts = _dt.datetime.now().strftime("%Y%m%d-%H%M%S")

    references = [fetch_reference_image(ref, allow_data_url=True) for ref in args.reference_image]
    mask = fetch_reference_image(args.mask_image, allow_data_url=True) if args.mask_image else None

    print(f"Model: {args.model}  (OpenAI Images API)")
    print(f"Output dir: {output_dir}")
    print(f"Generating {args.n} image(s)...")

    OpenAI = _import_openai()
    client = OpenAI(base_url=ZENMUX_OPENAI_BASE_URL, api_key=api_key)
    saved = generate_openai_images(
        client=client,
        model=args.model,
        prompt=prompt,
        references=references,
        mask=mask,
        n=args.n,
        size=args.size,
        quality=args.quality,
        output_format=args.output_format,
        compression=args.compression,
        output_dir=output_dir,
        run_ts=run_ts,
        background=args.background,
        input_fidelity=args.input_fidelity,
        moderation=args.moderation,
        user=args.user,
    )
    print_saved(saved, output_dir=output_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
