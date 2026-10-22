"""Encode the complete interface fonts as WOFF2, with a lossless round-trip check.

Run from any directory; the original TTFs remain available to artwork generators.
One-time tooling (kept outside the project):
    python3 -m venv /tmp/arena-fonttools
    /tmp/arena-fonttools/bin/pip install 'fonttools[woff]==4.67.0' 'brotli==1.2.0'
    /tmp/arena-fonttools/bin/python scripts/prepare-interface-fonts.py
"""

from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont, woff2


FONT_DIRECTORY = Path(__file__).resolve().parents[1] / "public" / "fonts"
FONT_NAMES = (
    "barlow-800",
    "barlow-800-italic",
    "dm-sans-400",
    "dm-sans-700",
    "pixelify-sans",
)


def table_xml(font, table):
    xml = BytesIO()
    font.saveXML(xml, tables=[table])
    return xml.getvalue()


def verify_round_trip(source, encoded):
    decoded_bytes = BytesIO()
    woff2.decompress(BytesIO(encoded), decoded_bytes)
    original = TTFont(source, recalcBBoxes=False, recalcTimestamp=False)
    decoded = TTFont(decoded_bytes, recalcBBoxes=False, recalcTimestamp=False)
    assert original.keys() == decoded.keys(), f"Font tables changed: {source.name}"

    # WOFF2 marks optimized transport in head bit 11 and rebuilds the sfnt checksum.
    # Normalize only those packaging fields before comparing every semantic table.
    assert (original["head"].flags ^ decoded["head"].flags) & ~0x800 == 0
    decoded["head"].flags = original["head"].flags
    decoded["head"].checkSumAdjustment = original["head"].checkSumAdjustment
    for table in original.keys():
        assert table_xml(original, table) == table_xml(decoded, table), (
            f"Font table changed: {source.name} / {table}"
        )

    return len(original.getGlyphOrder()), len(original.getBestCmap())


def main():
    original_total = encoded_total = 0
    for name in FONT_NAMES:
        source = FONT_DIRECTORY / f"{name}.ttf"
        target = FONT_DIRECTORY / f"{name}.woff2"
        encoded = BytesIO()
        woff2.compress(source, encoded, transform_tables={"glyf", "loca", "hmtx"})
        data = encoded.getvalue()
        glyphs, characters = verify_round_trip(source, data)
        target.write_bytes(data)

        original_bytes = source.stat().st_size
        original_total += original_bytes
        encoded_total += len(data)
        print(
            f"{name}: {original_bytes:,} -> {len(data):,} bytes; "
            f"{glyphs} glyphs / {characters} mapped characters; all tables verified"
        )

    saved = original_total - encoded_total
    print(
        f"Total: {original_total:,} -> {encoded_total:,} bytes; "
        f"saved {saved:,} bytes ({saved / original_total:.2%})"
    )


if __name__ == "__main__":
    main()
