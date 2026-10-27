#!/usr/bin/env python3
"""Root-owned host control, installed independently of application releases."""
import fcntl
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.request

STATE = Path('/var/lib/arena-criolla-deploy/state.json')
RELEASE_ENV = Path('/etc/arena-criolla/release.env')
COMPOSE = Path('/opt/arena-criolla/compose.yaml')
DATA = Path('/workspace/arena-criolla-production/data')
SMOKE = Path('/usr/local/lib/arena-criolla-deploy/security-smoke.mjs')
IMAGE_PREFIX = 'arena-criolla:release-'
MAX_ARCHIVE_BYTES = 1536 * 1024**2


def run(*args, **kwargs):
    kwargs.setdefault('timeout', 600)
    return subprocess.run(args, check=True, **kwargs)


def output(*args):
    return run(*args, stdout=subprocess.PIPE, text=True).stdout.strip()


def record(state):
    state['updated_at'] = time.time()
    temporary = STATE.with_suffix('.tmp')
    with temporary.open('w') as file:
        json.dump(state, file)
        file.flush()
        os.fsync(file.fileno())
    temporary.replace(STATE)
    directory = os.open(STATE.parent, os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def admit(previous, revision, generation, checksum):
    if previous.get('status') in ('installing', 'recovery_required'):
        raise RuntimeError('Reconcile the unfinished host transaction before deploying again.')
    last_generation = previous.get('generation', [0, 0])
    if generation <= last_generation:
        if (generation == last_generation and previous.get('status') == 'success'
                and previous.get('revision') == revision and previous.get('checksum') == checksum):
            return 'current'
        raise RuntimeError('Stale or previously failed release. Re-run all jobs for a new attempt.')
    return 'install'


def receive(stream, target, checksum):
    digest = hashlib.sha256()
    size = 0
    with target.open('wb') as file:
        while chunk := stream.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_ARCHIVE_BYTES:
                raise RuntimeError('Release archive exceeds the host limit.')
            digest.update(chunk)
            file.write(chunk)
    if size == 0 or digest.hexdigest() != checksum:
        raise RuntimeError('Release archive checksum mismatch.')


def schema():
    # Never create an empty database when a mount or path is wrong.
    with closing(sqlite3.connect((DATA / 'creator/arena.sqlite').as_uri() + '?mode=ro', uri=True)) as db:
        return [db.execute('PRAGMA user_version').fetchone(), db.execute(
            'SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name'
        ).fetchall()]


def verify_prod_head(revision):
    request = urllib.request.Request(
        'https://api.github.com/repos/0bkevin/arena-criolla/git/ref/heads/prod',
        headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'arena-criolla-deploy'},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        current = json.load(response)['object']['sha']
    if current != revision:
        raise RuntimeError('prod advanced while the release was prepared; refusing a stale deployment.')


def compose(*args):
    run('docker', 'compose', '--env-file', str(RELEASE_ENV), '-f', str(COMPOSE), *args)


def set_image(image, original):
    value, count = re.subn(r'^ARENA_IMAGE=.*$', 'ARENA_IMAGE=' + image, original, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError('Expected exactly one ARENA_IMAGE in the host release environment.')
    pending = RELEASE_ENV.with_suffix('.pending')
    pending.write_text(value)
    pending.chmod(0o600)
    pending.replace(RELEASE_ENV)


def health(expected_image=None):
    if expected_image is not None:
        running = output('docker', 'inspect', '--format', '{{.Image}}', 'arena-criolla')
        expected = output('docker', 'image', 'inspect', '--format', '{{.Id}}', expected_image)
        if running != expected:
            raise RuntimeError('The running container is not the requested release image.')
    for origin in ('http://127.0.0.1:5173', 'https://arenacriolla.com'):
        with SMOKE.open('rb') as script:
            run('docker', 'exec', '-i', 'arena-criolla', 'node', '--input-type=module', '-',
                origin, stdin=script, timeout=90)


def deploy(revision, generation, checksum):
    previous = json.loads(STATE.read_text()) if STATE.exists() else {}
    image = IMAGE_PREFIX + revision
    if admit(previous, revision, generation, checksum) == 'current':
        health(image)
        print('Release already installed and healthy.', flush=True)
        return
    verify_prod_head(revision)
    original = RELEASE_ENV.read_text()
    matches = re.findall(r'^ARENA_IMAGE=(\S+)$', original, flags=re.MULTILINE)
    if len(matches) != 1:
        raise RuntimeError('Adopt the existing release environment before deploying.')
    old_image = matches[0]
    health(old_image)
    # Pull/load and back up while the existing release still serves traffic.
    with tempfile.TemporaryDirectory(prefix='image-', dir=STATE.parent) as staging:
        archive = Path(staging) / 'image.tar.gz'
        receive(sys.stdin.buffer, archive, checksum)
        run('docker', 'load', '--input', str(archive))
    actual_revision = output('docker', 'image', 'inspect', '--format',
                             '{{index .Config.Labels "org.opencontainers.image.revision"}}', image)
    if actual_revision != revision:
        raise RuntimeError('Image revision does not match the requested commit.')
    run('python3', '/opt/arena-criolla/backup.py')
    backups = list(Path('/var/backups/arena-criolla').glob('arena-criolla-*.tar.gz'))
    if not backups or max(p.stat().st_mtime for p in backups) < time.time() - 300:
        raise RuntimeError('No fresh completed backup. Production has not been changed.')
    verify_prod_head(revision)
    before = schema()
    state = dict(status='installing', revision=revision, generation=generation, checksum=checksum,
                 previous_image=old_image, image=image, schema_before=before)
    record(state)
    try:
        set_image(image, original)
        compose('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '90', 'app')
        health(image)
    except BaseException:
        # Stop the failed release before inspecting schema or restarting an old binary.
        state['status'] = 'recovery_required'
        try:
            compose('stop', 'app')
            if schema() != before:
                raise RuntimeError('Database schema changed; automatic rollback is blocked.')
            set_image(old_image, original)
            compose('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '90', 'app')
            health(old_image)
            state['status'] = 'failed'
            print('Deployment failed; the previous image is healthy again.', file=sys.stderr)
        except BaseException as recovery_error:
            print(f'Operator recovery required: {recovery_error}', file=sys.stderr)
        record(state)
        raise
    state['status'] = 'success'
    record(state)
    print(f'Production verified at {revision}.', flush=True)


def main(argv):
    os.umask(0o077)
    if os.geteuid() != 0:
        raise RuntimeError('Run using the restricted root installer.')
    if argv == ['probe']:
        urllib.request.urlopen('http://127.0.0.1:35173/api/health', timeout=5).close()
        print('Arena Criolla deployment transport ready.')
        return
    if (len(argv) != 4 or not re.fullmatch('[a-f0-9]{40}', argv[0])
            or not re.fullmatch('[1-9][0-9]{0,19}', argv[1])
            or not re.fullmatch('[1-9][0-9]{0,4}', argv[2])
            or not re.fullmatch('[a-f0-9]{64}', argv[3])):
        raise ValueError('Invalid production release parameters.')
    STATE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Share the existing deployment lock; a disconnected/crashed install stays recorded.
    with Path('/opt/arena-criolla/.deployment.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy(argv[0], [int(argv[1]), int(argv[2])], argv[3])


if __name__ == '__main__':
    main(sys.argv[1:])
