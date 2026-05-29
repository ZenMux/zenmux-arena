## Create image edit

`images.edit(ImageEditParams**kwargs)  -> ImagesResponse`

**post** `/images/edits`

Creates an edited or extended image given one or more source images and a prompt. This endpoint supports GPT Image models (`gpt-image-1.5`, `gpt-image-1`, `gpt-image-1-mini`, and `chatgpt-image-latest`) and `dall-e-2`.

### Parameters

- `image: Union[FileTypes, Sequence[FileTypes]]`

  The image(s) to edit. Must be a supported image file or an array of images.

  For the GPT image models (`gpt-image-1`, `gpt-image-1-mini`,
  `gpt-image-1.5`, `gpt-image-2`, `gpt-image-2-2026-04-21`, and
  `chatgpt-image-latest`), each image should be a `png`, `webp`, or
  `jpg` file less than 50MB. You can provide up to 16 images.

  For `dall-e-2`, you can only provide one image, and it should be a
  square `png` file less than 4MB.

  - `FileTypes`

  - `Sequence[FileTypes]`

- `prompt: str`

  A text description of the desired image(s). The maximum length is 1000 characters for `dall-e-2`, and 32000 characters for the GPT image models.

- `background: Optional[Literal["transparent", "opaque", "auto"]]`

  Allows to set transparency for the background of the generated image(s).
  This parameter is only supported for GPT image models that support
  transparent backgrounds. Must be one of `transparent`, `opaque`, or
  `auto` (default value). When `auto` is used, the model will
  automatically determine the best background for the image.

  `gpt-image-2` and `gpt-image-2-2026-04-21` do not support
  transparent backgrounds. Requests with `background` set to
  `transparent` will return an error for these models; use `opaque` or
  `auto` instead.

  If `transparent`, the output format needs to support transparency,
  so it should be set to either `png` (default value) or `webp`.

  - `"transparent"`

  - `"opaque"`

  - `"auto"`

- `input_fidelity: Optional[Literal["high", "low"]]`

  Control how much effort the model will exert to match the style and features, especially facial features, of input images. This parameter is only supported for `gpt-image-1` and `gpt-image-1.5` and later models, unsupported for `gpt-image-1-mini`. Supports `high` and `low`. Defaults to `low`.

  - `"high"`

  - `"low"`

- `mask: Optional[FileTypes]`

  An additional image whose fully transparent areas (e.g. where alpha is zero) indicate where `image` should be edited. If there are multiple images provided, the mask will be applied on the first image. Must be a valid PNG file, less than 4MB, and have the same dimensions as `image`.

- `model: Optional[Union[str, ImageModel, null]]`

  The model to use for image generation. One of `dall-e-2` or a GPT image model (`gpt-image-1`, `gpt-image-1-mini`, `gpt-image-1.5`, `gpt-image-2`, `gpt-image-2-2026-04-21`, or `chatgpt-image-latest`). Defaults to `gpt-image-1.5`.

  - `str`

  - `Literal["gpt-image-1", "gpt-image-1-mini", "gpt-image-2", 5 more]`

    - `"gpt-image-1"`

    - `"gpt-image-1-mini"`

    - `"gpt-image-2"`

    - `"gpt-image-2-2026-04-21"`

    - `"gpt-image-1.5"`

    - `"chatgpt-image-latest"`

    - `"dall-e-2"`

    - `"dall-e-3"`

- `n: Optional[int]`

  The number of images to generate. Must be between 1 and 10.

- `output_compression: Optional[int]`

  The compression level (0-100%) for the generated images. This parameter
  is only supported for the GPT image models with the `webp` or `jpeg` output
  formats, and defaults to 100.

- `output_format: Optional[Literal["png", "jpeg", "webp"]]`

  The format in which the generated images are returned. This parameter is
  only supported for the GPT image models. Must be one of `png`, `jpeg`, or `webp`.
  The default value is `png`.

  - `"png"`

  - `"jpeg"`

  - `"webp"`

- `partial_images: Optional[int]`

  The number of partial images to generate. This parameter is used for
  streaming responses that return partial images. Value must be between 0 and 3.
  When set to 0, the response will be a single image sent in one streaming event.

  Note that the final image may be sent before the full number of partial images
  are generated if the full image is generated more quickly.

- `quality: Optional[Literal["standard", "low", "medium", 2 more]]`

  The quality of the image that will be generated for GPT image models. Defaults to `auto`.

  - `"standard"`

  - `"low"`

  - `"medium"`

  - `"high"`

  - `"auto"`

- `response_format: Optional[Literal["url", "b64_json"]]`

  The format in which the generated images are returned. Must be one of `url` or `b64_json`. URLs are only valid for 60 minutes after the image has been generated. This parameter is only supported for `dall-e-2` (default is `url` for `dall-e-2`), as GPT image models always return base64-encoded images.

  - `"url"`

  - `"b64_json"`

- `size: Optional[Union[str, Literal["256x256", "512x512", "1024x1024", 3 more], null]]`

  The size of the generated images. For `gpt-image-2` and `gpt-image-2-2026-04-21`, arbitrary resolutions are supported as `WIDTHxHEIGHT` strings, for example `1536x864`. Width and height must both be divisible by 16 and the requested aspect ratio must be between 1:3 and 3:1. Resolutions above `2560x1440` are experimental, and the maximum supported resolution is `3840x2160`. The requested size must also satisfy the model's current pixel and edge limits. The standard sizes `1024x1024`, `1536x1024`, and `1024x1536` are supported by the GPT image models; `auto` is supported for models that allow automatic sizing. For `dall-e-2`, use one of `256x256`, `512x512`, or `1024x1024`. For `dall-e-3`, use one of `1024x1024`, `1792x1024`, or `1024x1792`.

  - `str`

  - `Literal["256x256", "512x512", "1024x1024", 3 more]`

    The size of the generated images. For `gpt-image-2` and `gpt-image-2-2026-04-21`, arbitrary resolutions are supported as `WIDTHxHEIGHT` strings, for example `1536x864`. Width and height must both be divisible by 16 and the requested aspect ratio must be between 1:3 and 3:1. Resolutions above `2560x1440` are experimental, and the maximum supported resolution is `3840x2160`. The requested size must also satisfy the model's current pixel and edge limits. The standard sizes `1024x1024`, `1536x1024`, and `1024x1536` are supported by the GPT image models; `auto` is supported for models that allow automatic sizing. For `dall-e-2`, use one of `256x256`, `512x512`, or `1024x1024`. For `dall-e-3`, use one of `1024x1024`, `1792x1024`, or `1024x1792`.

    - `"256x256"`

    - `"512x512"`

    - `"1024x1024"`

    - `"1536x1024"`

    - `"1024x1536"`

    - `"auto"`

- `stream: Optional[Literal[false]]`

  Edit the image in streaming mode. Defaults to `false`. See the
  [Image generation guide](https://platform.openai.com/docs/guides/image-generation) for more information.

  - `false`

- `user: Optional[str]`

  A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#end-user-ids).

### Returns

- `class ImagesResponse: …`

  The response from the image generation endpoint.

  - `created: int`

    The Unix timestamp (in seconds) of when the image was created.

  - `background: Optional[Literal["transparent", "opaque"]]`

    The background parameter used for the image generation. Either `transparent` or `opaque`.

    - `"transparent"`

    - `"opaque"`

  - `data: Optional[List[Image]]`

    The list of generated images.

    - `b64_json: Optional[str]`

      The base64-encoded JSON of the generated image. Returned by default for the GPT image models, and only present if `response_format` is set to `b64_json` for `dall-e-2` and `dall-e-3`.

    - `revised_prompt: Optional[str]`

      For `dall-e-3` only, the revised prompt that was used to generate the image.

    - `url: Optional[str]`

      When using `dall-e-2` or `dall-e-3`, the URL of the generated image if `response_format` is set to `url` (default value). Unsupported for the GPT image models.

  - `output_format: Optional[Literal["png", "webp", "jpeg"]]`

    The output format of the image generation. Either `png`, `webp`, or `jpeg`.

    - `"png"`

    - `"webp"`

    - `"jpeg"`

  - `quality: Optional[Literal["low", "medium", "high"]]`

    The quality of the image generated. Either `low`, `medium`, or `high`.

    - `"low"`

    - `"medium"`

    - `"high"`

  - `size: Optional[Literal["1024x1024", "1024x1536", "1536x1024"]]`

    The size of the image generated. Either `1024x1024`, `1024x1536`, or `1536x1024`.

    - `"1024x1024"`

    - `"1024x1536"`

    - `"1536x1024"`

  - `usage: Optional[Usage]`

    For `gpt-image-1` only, the token usage information for the image generation.

    - `input_tokens: int`

      The number of tokens (images and text) in the input prompt.

    - `input_tokens_details: UsageInputTokensDetails`

      The input tokens detailed information for the image generation.

      - `image_tokens: int`

        The number of image tokens in the input prompt.

      - `text_tokens: int`

        The number of text tokens in the input prompt.

    - `output_tokens: int`

      The number of output tokens generated by the model.

    - `total_tokens: int`

      The total number of tokens (images and text) used for the image generation.

    - `output_tokens_details: Optional[UsageOutputTokensDetails]`

      The output token details for the image generation.

      - `image_tokens: int`

        The number of image output tokens generated by the model.

      - `text_tokens: int`

        The number of text output tokens generated by the model.

### Example

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),  # This is the default and can be omitted
)
for image in client.images.edit(
    image=b"Example data",
    prompt="A cute baby sea otter wearing a beret",
):
  print(image)
```

#### Response

```json
{
  "created": 0,
  "background": "transparent",
  "data": [
    {
      "b64_json": "b64_json",
      "revised_prompt": "revised_prompt",
      "url": "https://example.com"
    }
  ],
  "output_format": "png",
  "quality": "low",
  "size": "1024x1024",
  "usage": {
    "input_tokens": 0,
    "input_tokens_details": {
      "image_tokens": 0,
      "text_tokens": 0
    },
    "output_tokens": 0,
    "total_tokens": 0,
    "output_tokens_details": {
      "image_tokens": 0,
      "text_tokens": 0
    }
  }
}
```

### Edit image

```python
import base64
from openai import OpenAI
client = OpenAI()

prompt = """
Generate a photorealistic image of a gift basket on a white background
labeled 'Relax & Unwind' with a ribbon and handwriting-like font,
containing all the items in the reference pictures.
"""

result = client.images.edit(
    model="gpt-image-1.5",
    image=[
        open("body-lotion.png", "rb"),
        open("bath-bomb.png", "rb"),
        open("incense-kit.png", "rb"),
        open("soap.png", "rb"),
    ],
    prompt=prompt
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("gift-basket.png", "wb") as f:
    f.write(image_bytes)
```

### Streaming

```python
from openai import OpenAI

client = OpenAI()

prompt = """
Generate a photorealistic image of a gift basket on a white background
labeled 'Relax & Unwind' with a ribbon and handwriting-like font,
containing all the items in the reference pictures.
"""

stream = client.images.edit(
    model="gpt-image-1.5",
    image=[
        open("body-lotion.png", "rb"),
        open("bath-bomb.png", "rb"),
        open("incense-kit.png", "rb"),
        open("soap.png", "rb"),
    ],
    prompt=prompt,
    stream=True
)

for event in stream:
    print(event)
```

#### Response

```json
event: image_edit.partial_image
data: {"type":"image_edit.partial_image","b64_json":"...","partial_image_index":0}

event: image_edit.completed
data: {"type":"image_edit.completed","b64_json":"...","usage":{"total_tokens":100,"input_tokens":50,"output_tokens":50,"input_tokens_details":{"text_tokens":10,"image_tokens":40}}}
```
