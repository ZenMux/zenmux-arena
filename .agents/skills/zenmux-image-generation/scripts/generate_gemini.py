#!/usr/bin/env python3
"""Generate or edit images through ZenMux's Gemini / Vertex AI-compatible API.

ZenMux supports this protocol for every image-generation model. Google Gemini
image models use `generate_content`; all other image models, including OpenAI
models when the user explicitly asks for Gemini protocol, use
`generate_images` or `edit_image`.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import pathlib
import sys
import urllib.request

from image_common import (
    GEMINI_PREFIX,
    SKILL_DIR,
    ZENMUX_BASE_URL,
    add_common_args,
    ensure_output_dir,
    ext_from_mime,
    fetch_reference_image,
    is_gpt_image_2,
    load_prompt,
    make_filename,
    print_saved,
    reference_bytes,
    require_api_key,
    validate_compression,
    validate_gpt_image_2_size,
    validate_n,
    validate_vertex_preset_size,
)


def _import_genai():
    try:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore
        return genai, types
    except ImportError as exc:  # pragma: no cover - import-time guard
        sys.stderr.write(
            "Error: the `google-genai` package is required.\n"
            "Install this skill's dependencies once with:\n"
            f"  uv sync --project {SKILL_DIR}\n"
        )
        raise SystemExit(1) from exc


def generate_gemini_content(
    *,
    client,
    types,
    model: str,
    prompt: str,
    refs: list[tuple[bytes, str]],
    n: int,
    output_dir: pathlib.Path,
    run_ts: str,
) -> list[pathlib.Path]:
    """Call Gemini generate_content N times because it returns one image per call."""
    saved: list[pathlib.Path] = []
    for i in range(1, n + 1):
        contents: list = [prompt]
        for data, mime in refs:
            contents.append(types.Part.from_bytes(data=data, mime_type=mime))

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )

        text_chunks: list[str] = []
        image_saved = False
        for part in response.parts or []:
            if getattr(part, "text", None):
                text_chunks.append(part.text)
            elif getattr(part, "inline_data", None) is not None:
                mime = getattr(part.inline_data, "mime_type", "image/png") or "image/png"
                out_path = output_dir / make_filename(model, ext_from_mime(mime), i, run_ts)
                out_path.write_bytes(part.inline_data.data)
                saved.append(out_path)
                image_saved = True

        if text_chunks:
            print(f"[{i}/{n}] model said: {' '.join(text_chunks).strip()}")
        if not image_saved:
            print(f"[{i}/{n}] WARNING: no image returned by the model.", file=sys.stderr)
    return saved


def generate_images_or_edit_image(
    *,
    client,
    types,
    model: str,
    prompt: str,
    refs: list[tuple[bytes, str]],
    mask: tuple[bytes, str] | None,
    n: int,
    size: str | None,
    quality: str | None,
    output_format: str | None,
    compression: int | None,
    output_dir: pathlib.Path,
    run_ts: str,
) -> list[pathlib.Path]:
    """Call Vertex AI-compatible generate_images/edit_image."""
    extra_body: dict = {}
    if size:
        extra_body["imageSize"] = size
    if quality:
        extra_body["quality"] = quality
    http_options = types.HttpOptions(extra_body=extra_body) if extra_body else None

    if refs:
        edit_kwargs: dict = {"number_of_images": n}
        if output_format:
            edit_kwargs["output_mime_type"] = output_format
        if compression is not None:
            edit_kwargs["output_compression_quality"] = compression
        if http_options is not None:
            edit_kwargs["http_options"] = http_options

        reference_images = []
        for idx, (data, mime) in enumerate(refs, start=1):
            reference_images.append(
                types.RawReferenceImage(
                    reference_id=idx,
                    reference_image=types.Image(image_bytes=data, mime_type=mime),
                )
            )
        if mask is not None:
            mask_data, mask_mime = mask
            reference_images.append(
                types.MaskReferenceImage(
                    reference_id=len(reference_images) + 1,
                    reference_image=types.Image(image_bytes=mask_data, mime_type=mask_mime),
                    config=types.MaskReferenceConfig(mask_mode="MASK_MODE_USER_PROVIDED"),
                )
            )

        response = client.models.edit_image(
            model=model,
            prompt=prompt,
            reference_images=reference_images,
            config=types.EditImageConfig(**edit_kwargs),
        )
    else:
        gen_kwargs: dict = {"number_of_images": n}
        if output_format:
            gen_kwargs["output_mime_type"] = output_format
        if compression is not None:
            gen_kwargs["output_compression_quality"] = compression
        if http_options is not None:
            gen_kwargs["http_options"] = http_options

        response = client.models.generate_images(
            model=model,
            prompt=prompt,
            config=types.GenerateImagesConfig(**gen_kwargs),
        )

    images = getattr(response, "generated_images", None) or []
    if not images:
        raise SystemExit("Error: API returned no images. Check the prompt or model permissions.")

    saved: list[pathlib.Path] = []
    for i, item in enumerate(images, start=1):
        img = item.image
        raw_bytes = getattr(img, "image_bytes", None)
        gcs_uri = getattr(img, "gcs_uri", None) or getattr(img, "uri", None)
        out_path = output_dir / make_filename(model, ext_from_mime(getattr(img, "mime_type", None)), i, run_ts)
        if raw_bytes and len(raw_bytes) > 0:
            out_path.write_bytes(raw_bytes)
        elif gcs_uri:
            try:
                with urllib.request.urlopen(gcs_uri, timeout=300) as resp:
                    out_path.write_bytes(resp.read())
            except Exception as exc:
                raise SystemExit(f"Error: failed to download image #{i} from URL: {exc}") from exc
        else:
            raise SystemExit(f"Error: image #{i} has no data (no bytes or URL)")
        saved.append(out_path)
    return saved


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    add_common_args(parser)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    validate_n(args.n)
    validate_compression(args.compression)
    if is_gpt_image_2(args.model):
        validate_gpt_image_2_size(args.size)
    elif not args.model.startswith(GEMINI_PREFIX):
        validate_vertex_preset_size(args.size)
    if args.mask_image and not args.reference_image:
        raise SystemExit("Error: --mask-image requires at least one --reference-image.")
    if args.mask_image and args.model.startswith(GEMINI_PREFIX):
        raise SystemExit("Error: --mask-image is not supported for Gemini generate_content models.")

    api_key = require_api_key()
    prompt = load_prompt(args.prompt_file)
    output_dir = ensure_output_dir(args.output_dir)
    run_ts = _dt.datetime.now().strftime("%Y%m%d-%H%M%S")

    references = [fetch_reference_image(ref, allow_data_url=True) for ref in args.reference_image]
    mask_ref = fetch_reference_image(args.mask_image, allow_data_url=True) if args.mask_image else None
    refs = reference_bytes(references)
    mask = (mask_ref.data, mask_ref.mime_type) if mask_ref is not None else None

    genai, types = _import_genai()
    client = genai.Client(
        api_key=api_key,
        vertexai=True,
        http_options=types.HttpOptions(api_version="v1", base_url=ZENMUX_BASE_URL),
    )

    path = "Gemini generate_content" if args.model.startswith(GEMINI_PREFIX) else "Vertex AI generate_images/edit_image"
    print(f"Model: {args.model}  ({path})")
    print(f"Output dir: {output_dir}")
    print(f"Generating {args.n} image(s)...")

    if args.model.startswith(GEMINI_PREFIX):
        saved = generate_gemini_content(
            client=client,
            types=types,
            model=args.model,
            prompt=prompt,
            refs=refs,
            n=args.n,
            output_dir=output_dir,
            run_ts=run_ts,
        )
    else:
        saved = generate_images_or_edit_image(
            client=client,
            types=types,
            model=args.model,
            prompt=prompt,
            refs=refs,
            mask=mask,
            n=args.n,
            size=args.size,
            quality=args.quality,
            output_format=args.output_format,
            compression=args.compression,
            output_dir=output_dir,
            run_ts=run_ts,
        )

    print_saved(saved, output_dir=output_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
