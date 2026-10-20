#!/usr/bin/env python3
"""Prepare the CC0 nonverbal fight reactions from preserved source samples."""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--ffmpeg", default="ffmpeg")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
raw = root / "assets/references/audio-reactions-v8"
output = root / "public/audio/arcade"
output.mkdir(parents=True, exist_ok=True)
sources = {
    "male": {
        "author": "qubodup",
        "title": "15 vocal male strain/hurt/pain/jump sounds",
        "url": "https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds",
        "download": "https://opengameart.org/sites/default/files/slightscreams.7z",
        "license": "CC0-1.0",
        "originals": {"jump": [2, 11, 12], "attack": [1, 7, 8], "hurt": [3, 4, 14]},
    },
    "female": {
        "author": "cicifyre",
        "title": "Female RPG Voice Starter Pack, Type 2",
        "url": "https://opengameart.org/content/female-rpg-voice-starter-pack",
        "download": "https://opengameart.org/sites/default/files/RPG%20Voice%20Starter%20Pack.zip",
        "license": "CC0-1.0",
    },
}
clips = []
for bank in sources:
    for kind in ["jump", "attack", "hurt"]:
        for variant in range(1, 4):
            filename = f"{bank}-{kind}-{variant}"
            source = next(raw.glob(filename + ".*"))
            pcm = array.array("f", subprocess.run(
                [args.ffmpeg, "-v", "error", "-i", str(source), "-af",
                 "highpass=f=90,lowpass=f=7500", "-f", "f32le", "-ac", "1", "-ar", "44100", "-"],
                capture_output=True, check=True,
            ).stdout)
            duration = len(pcm) / 44100
            rms = math.sqrt(sum(sample * sample for sample in pcm) / len(pcm))
            peak = max(abs(sample) for sample in pcm)
            gain = min(0.13 / max(rms, 0.0001), 0.78 / max(peak, 0.0001))
            destination = output / (filename + ".mp3")
            subprocess.run(
                [args.ffmpeg, "-y", "-v", "error", "-i", str(source), "-af",
                 f"highpass=f=90,lowpass=f=7500,volume={gain:.8f},afade=t=in:d=0.008,afade=t=out:st={max(0, duration - 0.018):.6f}:d=0.018",
                 "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame", "-q:a", "4", str(destination)],
                check=True,
            )
            original = (
                f"slightscream-{sources[bank]['originals'][kind][variant-1]:02}.flac"
                if bank == "male" else
                f"Type 2/{'damaged' if kind == 'hurt' else kind}{variant}.wav"
            )
            clips.append({
                "bank": bank, "kind": kind, "variant": variant,
                "file": "/audio/arcade/" + destination.name,
                "rawFile": str(source.relative_to(root)), "originalFile": original,
                "sourceUrl": sources[bank]["url"], "license": "CC0-1.0",
                "duration": round(duration, 6), "gain": round(gain, 6),
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                "bytes": destination.stat().st_size,
                "nonverbal": True,
            })
provenance = {
    "version": 8,
    "mode": "generic-combat-reactions",
    "description": "Short nonverbal effort and pain performances by unrelated sound actors; no real-person dialogue, voice imitation, or identity-specific recordings.",
    "sources": sources,
    "processing": "Mono MP3, 44.1 kHz; 90 Hz high-pass and 7500 Hz low-pass; per-clip gain targets RMS 0.13 and peak <= 0.78 before encoding; 8 ms fade-in, 18 ms fade-out. No speech synthesis or pitch changes.",
    "clips": clips,
}
(root / "assets/audio-provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n")
print(f"Prepared {len(clips)} generic reactions, {sum(clip['bytes'] for clip in clips):,} bytes.")
