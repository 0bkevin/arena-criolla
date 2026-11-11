"""Local safety checks; no production services or Docker commands are executed."""
import hashlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('install-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
REVISION = 'a' * 40
CHECKSUM = 'b' * 64


class ReleaseSafety(unittest.TestCase):
    def test_admission_rejects_stale_failed_and_unfinished_transactions(self):
        for status, generation in [('success', [10, 1]), ('failed', [10, 2]),
                                   ('installing', [11, 1]), ('recovery_required', [11, 1])]:
            with self.subTest(status=status):
                with self.assertRaises(RuntimeError):
                    release.admit(dict(status=status, generation=generation), REVISION, [10, 1], CHECKSUM)

    def test_successful_exact_retry_is_idempotent_but_cannot_change_image(self):
        previous = dict(status='success', generation=[10, 1], revision=REVISION, checksum=CHECKSUM)
        self.assertEqual(release.admit(previous, REVISION, [10, 1], CHECKSUM), 'current')
        with self.assertRaises(RuntimeError):
            release.admit(previous, REVISION, [10, 1], 'c' * 64)
        self.assertEqual(release.admit(previous, REVISION, [10, 2], CHECKSUM), 'install')

    def test_host_rejects_a_commit_that_is_no_longer_prod(self):
        import json
        response = io.BytesIO(json.dumps({'object': {'sha': 'c' * 40}}).encode())
        with patch.object(release.urllib.request, 'urlopen', return_value=response):
            with self.assertRaisesRegex(RuntimeError, 'prod advanced'):
                release.verify_prod_head(REVISION)

    def test_archive_is_verified_and_size_bounded(self):
        data = b'verified image archive'
        checksum = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'image.tar.gz'
            release.receive(io.BytesIO(data), target, checksum)
            self.assertEqual(target.read_bytes(), data)
            with self.assertRaises(RuntimeError):
                release.receive(io.BytesIO(data), target, CHECKSUM)
            with patch.object(release, 'MAX_ARCHIVE_BYTES', 1), self.assertRaises(RuntimeError):
                release.receive(io.BytesIO(data), target, checksum)

    def test_release_environment_preserves_other_host_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'release.env'
            with patch.object(release, 'RELEASE_ENV', target):
                release.set_image('arena-criolla:new', 'ARENA_IMAGE=old\nARENA_DATA_PATH=/private/data\n')
                self.assertEqual(target.read_text(), 'ARENA_IMAGE=arena-criolla:new\nARENA_DATA_PATH=/private/data\n')
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
                with self.assertRaises(RuntimeError):
                    release.set_image('new', 'ARENA_IMAGE=one\nARENA_IMAGE=two\n')

    def test_ssh_rejects_shell_commands_and_injection(self):
        wrapper = Path(__file__).with_name('receive-release')
        for command in ['bash', 'probe; id', 'deploy ' + REVISION + ' 1 1 ' + CHECKSUM + '; id',
                        'deploy ' + REVISION + ' 0 1 ' + CHECKSUM]:
            with self.subTest(command=command):
                result = subprocess.run(['bash', str(wrapper)], env={'SSH_ORIGINAL_COMMAND': command},
                                        capture_output=True, timeout=5)
                self.assertEqual(result.returncode, 2)

    def test_failed_deploy_only_resumes_old_image_with_unchanged_schema(self):
        for changed_schema in (False, True):
            with self.subTest(changed_schema=changed_schema), tempfile.TemporaryDirectory() as directory:
                base = Path(directory)
                environment = base / 'release.env'
                environment.write_text('ARENA_IMAGE=old\n')
                state = base / 'state.json'
                backup = base / 'arena-criolla-backup.tar.gz'
                backup.touch()
                records = []
                health_calls = []

                def health(image):
                    health_calls.append(image)
                    if image != 'old':
                        raise RuntimeError('Candidate failed readiness')

                with (patch.object(release, 'STATE', state),
                      patch.object(release, 'RELEASE_ENV', environment),
                      patch.object(release, 'health', side_effect=health),
                      patch.object(release, 'verify_prod_head'),
                      patch.object(release, 'receive'), patch.object(release, 'run'),
                      patch.object(release, 'output', return_value=REVISION),
                      patch.object(release, 'compose') as compose,
                      patch.object(release, 'schema', side_effect=[['original'], ['changed' if changed_schema else 'original']]),
                      patch.object(release, 'record', side_effect=lambda item: records.append(dict(item))),
                      patch.object(Path, 'glob', return_value=[backup])):
                    with self.assertRaisesRegex(RuntimeError, 'Candidate failed readiness'):
                        release.deploy(REVISION, [10, 1], CHECKSUM)
                self.assertEqual(records[0]['status'], 'installing')
                self.assertIn(unittest.mock.call('stop', 'app'), compose.call_args_list)
                self.assertEqual(records[-1]['status'], 'recovery_required' if changed_schema else 'failed')
                if changed_schema:
                    self.assertEqual(health_calls, ['old', release.IMAGE_PREFIX + REVISION])
                else:
                    self.assertEqual(health_calls[-1], 'old')
                    self.assertEqual(environment.read_text(), 'ARENA_IMAGE=old\n')


if __name__ == '__main__':
    unittest.main()
