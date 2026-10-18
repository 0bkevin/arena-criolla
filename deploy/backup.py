#!/usr/bin/env python3
"""Take an online SQLite snapshot and retain seven local recovery archives."""
import datetime
from contextlib import closing
import fcntl
import json
import os
import pathlib
import shutil
import sqlite3
import tarfile
import tempfile

source = pathlib.Path(os.environ.get("ARENA_BACKUP_SOURCE", "/workspace/arena-criolla-production/data"))
destination = pathlib.Path(os.environ.get("ARENA_BACKUP_DEST", "/var/backups/arena-criolla"))
os.umask(0o077)
database = source / "creator/arena.sqlite"
if not database.is_file():
    raise SystemExit("Game database is missing; refusing to create an empty backup.")
destination.mkdir(mode=0o700, parents=True, exist_ok=True)
lock = (destination / ".backup.lock").open("w")
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit(0)
size = sum(p.stat().st_size for p in source.rglob("*") if p.is_file())
if shutil.disk_usage(destination).free < size * 3 + 512 * 1024**2:
    raise SystemExit("Insufficient free space for a safe game backup.")

with tempfile.TemporaryDirectory(prefix=".snapshot-", dir=destination) as temporary:
    snapshot = pathlib.Path(temporary)
    (snapshot / "creator").mkdir()
    with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)) as live:
        with closing(sqlite3.connect(snapshot / "creator/arena.sqlite")) as saved:
            live.backup(saved)
            saved.execute("PRAGMA journal_mode=DELETE")
            if saved.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise SystemExit("Snapshot database integrity check failed.")
            rows = saved.execute("SELECT id,photos,source_path,status FROM characters").fetchall()
    # Files are immutable after publication. Missing files fail this run rather
    # than silently creating an incomplete recovery archive during a deletion.
    shutil.copytree(source, snapshot, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("arena.sqlite", "arena.sqlite-wal", "arena.sqlite-shm"))
    for character_id, photos, original, status in rows:
        # Retiring a published fighter deliberately removes its reference photos.
        required = json.loads(photos) if status != "archived" else []
        if original and status in ("ready", "published", "archived"):
            required.append(original)
        if status in ("published", "archived"):
            required.extend(str(pathlib.PurePosixPath("/app/data/creator/characters") / character_id / name)
                            for name in ("sprite.webp", "portrait.webp"))
        for filename in required:
            relative = pathlib.PurePosixPath(filename).relative_to("/app/data")
            if not (snapshot / relative).is_file():
                raise SystemExit("Character files changed during backup; retry after the next timer run.")
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    archive = destination / f"arena-criolla-{stamp}.tar.gz"
    pending = archive.with_suffix(".tmp")
    try:
        with tarfile.open(pending, "w:gz", compresslevel=1) as bundle:
            for entry in sorted(snapshot.iterdir()):
                bundle.add(entry, arcname=entry.name)
        pending.chmod(0o600)
        pending.replace(archive)
    finally:
        pending.unlink(missing_ok=True)
for old in sorted(destination.glob("arena-criolla-*.tar.gz"), reverse=True)[7:]:
    old.unlink()
print(f"Backup saved: {archive}")
