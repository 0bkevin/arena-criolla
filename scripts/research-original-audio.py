"""Local research helper: transcribe an excerpt, or cut an original voice clip.

Uses existing local FFmpeg and Whisper research tools; never synthesizes speech.
Run with PYTHONPATH=/tmp/vepol-voice-tools/python python3 scripts/research-original-audio.py ...
"""
import argparse
import json
import pathlib
import subprocess

FFMPEG = "/tmp/vepol-video-tools/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"
parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("--start", type=float, default=0)
parser.add_argument("--duration", type=float, default=60)
parser.add_argument("--clip")
args = parser.parse_args()
if args.clip:
    destination = pathlib.Path(args.clip)
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([FFMPEG, "-nostdin", "-y", "-loglevel", "error", "-ss", str(args.start),
                    "-i", args.source, "-t", str(args.duration), "-vn", "-ac", "1", "-ar", "44100",
                    "-af", "afade=t=in:d=0.025,afade=t=out:st=" + str(max(0, args.duration - .06)) + ":d=0.06,loudnorm=I=-18:TP=-2:LRA=7",
                    "-codec:a", "libmp3lame", "-b:a", "96k", str(destination)], check=True)
    print(json.dumps({"file": str(destination), "source": args.source, "start": args.start, "duration": args.duration}))
else:
    import numpy as np
    from faster_whisper import WhisperModel
    raw = subprocess.check_output([FFMPEG, "-nostdin", "-loglevel", "error", "-ss", str(args.start),
                                   "-i", args.source, "-t", str(args.duration), "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"])
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=2,
                         download_root="/tmp/vepol-voice-tools/models", local_files_only=True)
    segments, info = model.transcribe(audio, language="es", beam_size=5, word_timestamps=True,
                                      condition_on_previous_text=False)
    print(json.dumps({"language": info.language, "sourceOffset": args.start,
                      "segments": [{"start": args.start + s.start, "end": args.start + s.end,
                                    "text": s.text, "words": [{"word": w.word, "start": args.start + w.start,
                                                               "end": args.start + w.end, "probability": w.probability}
                                                              for w in (s.words or [])]} for s in segments]}, ensure_ascii=False))
