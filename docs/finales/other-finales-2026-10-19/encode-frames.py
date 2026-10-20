"""Encode actual canvas frames exported by T3 preview_evaluate at12fps."""
import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parent
catalog = json.loads((ROOT / "catalog.json").read_text())
clips = ROOT / "clips"
clips.mkdir(exist_ok=True)

def convert(item):
    identifier = item["id"]
    frames = ROOT / "frames" / identifier
    limit = time.monotonic() + 180
    while len(list(frames.glob("*.webp"))) != 36:
        if time.monotonic() > limit:
            raise RuntimeError("Missing renderer frames for " + identifier)
        time.sleep(0.25)
    motion = clips / f"{identifier}.webp"
    still = clips / f"{identifier}-still.webp"
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-threads", "1", "-filter_threads", "1", "-framerate", "12",
        "-i", str(frames / "%03d.webp"), "-vf", "scale=560:280", "-an", "-c:v", "libwebp_anim",
        "-threads", "1", "-lossless", "0", "-q:v", "55",
        "-compression_level", "6", "-loop", "0", str(motion),
    ], check=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-threads", "1",
        "-filter_threads", "1", "-i", str(frames / "020.webp"), "-frames:v", "1",
        "-vf", "scale=560:280", "-c:v", "libwebp", "-threads", "1",
        "-q:v", "82", str(still),
    ], check=True)
    return {
        **item, "frames":36, "sampleTicks":list(range(0,180,5)),
        "durationSeconds":3, "fps":12, "width":560, "height":280,
        "motion":str(motion.relative_to(ROOT)), "still":str(still.relative_to(ROOT)),
        "motionBytes":motion.stat().st_size,
        "motionSha256":hashlib.sha256(motion.read_bytes()).hexdigest(),
        "stillSha256":hashlib.sha256(still.read_bytes()).hexdigest(),
    }

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    entries = list(pool.map(convert, catalog))
metadata = {
    "capture":"Actual renderMatch canvas exported through native T3 preview_evaluate",
    "simulation":"Staged finale states advanced with real stepMatch in5tick increments",
    "stage":"caracas", "arenaCanvas":[1080,640], "crop":[170,230,740,370],
    "count":len(entries), "frames":sum(entry["frames"] for entry in entries),
    "audioTracks":0, "entries":entries,
}
(ROOT / "previews.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"count":len(entries),"frames":metadata["frames"],"motionBytes":sum(e["motionBytes"] for e in entries)}))
