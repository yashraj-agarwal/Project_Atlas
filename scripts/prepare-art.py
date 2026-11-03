"""Resize embedded textures and render mission posters. Requires Pillow."""
import io
import json
import math
from pathlib import Path
import struct

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "earth": ("earth.glb", 2048, 0, -0.16, (42, 123, 228)),
    "mars": ("mars_the_red_planet_free.glb", 2048, 0, 0.15, (227, 91, 36)),
    "moon": ("moon.glb", 1024, None, 0.12, (140, 161, 181)),
    "astronaut": ("animated_floating_astronaut_in_space_suit_loop.glb", 768, None, 0, (0, 0, 0)),
}


def poster(texture, name, meridian, rim):
    texture = texture.convert("RGB")
    width, height = texture.size
    tex = texture.load()
    size = 720
    out = Image.new("RGBA", (size, size))
    pixels = out.load()
    for y in range(size):
        v = (y + .5 - size / 2) / (size * .455)
        for x in range(size):
            u = (x + .5 - size / 2) / (size * .455)
            r = math.hypot(u, v)
            if r > 1:
                if r < 1.07:
                    pixels[x, y] = (*rim, round(105 * math.exp(-62 * (r - 1))))
                continue
            z = math.sqrt(1 - r * r)
            longitude = (math.atan2(u, z) / (2 * math.pi) + .5 + meridian) % 1
            latitude = .5 - math.asin(v) / math.pi
            color = tex[int(longitude * width) % width, min(height - 1, int(latitude * height))]
            light = .095 + .96 * max(0, -.57 * u - .38 * v + .72 * z) ** .78
            edge = (1 - z) ** 5 * max(.2, -.46 * u - .35 * v + .55)
            pixels[x, y] = (*[min(255, round(c * light + k * edge)) for c, k in zip(color, rim)], 255)
    out.save(ROOT / "assets" / f"{name}.webp", quality=86, method=6)


def pack(kind, payload, padding):
    payload += padding * (-len(payload) % 4)
    return struct.pack("<I4s", len(payload), kind) + payload


def prepare(source, name, spec):
    filename, limit, poster_index, meridian, rim = spec
    data = (source / filename).read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + length])
    binary = data[28 + length:]
    images = {image["bufferView"]: image for image in doc.get("images", [])}
    output = bytearray()
    for index, view in enumerate(doc["bufferViews"]):
        start = view.get("byteOffset", 0)
        payload = binary[start:start + view["byteLength"]]
        if index in images:
            image = images[index]
            with Image.open(io.BytesIO(payload)) as original:
                if poster_index is not None and doc["images"][poster_index] is image:
                    poster(original, name, meridian, rim)
                original.thumbnail((limit, limit), Image.Resampling.LANCZOS)
                buffer = io.BytesIO()
                if image["mimeType"] == "image/jpeg":
                    original.convert("RGB").save(buffer, "JPEG", quality=86, optimize=True)
                else:
                    original.save(buffer, "PNG", optimize=True)
                if len(buffer.getvalue()) < len(payload):
                    payload = buffer.getvalue()
        output.extend(b"\0" * (-len(output) % 4))
        view.update(byteOffset=len(output), byteLength=len(payload))
        output.extend(payload)
    doc["buffers"][0]["byteLength"] = len(output)
    chunks = pack(b"JSON", json.dumps(doc, separators=(",", ":")).encode(), b" ")
    chunks += pack(b"BIN\0", bytes(output), b"\0")
    (ROOT / "models" / f"{name}-scene.glb").write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory with the original model files")
    source = parser.parse_args().source
    (ROOT / "assets").mkdir(exist_ok=True)
    for name, spec in MODELS.items():
        prepare(source, name, spec)
