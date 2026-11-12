import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function configFor(runsDir: string) {
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
}

function makeRunsDir(log?: string) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-page-'));
  if (log !== undefined) writeFileSync(join(runsDir, '2026-10-28.jsonl'), log);
  return runsDir;
}

function runRecord(job: string, status: 'ok' | 'fail' = 'ok') {
  return JSON.stringify({
    at: '2026-10-28T23:00:02+01:00',
    job,
    status,
    owner: null,
    ...(status === 'fail' ? { error: 'failed' } : {}),
  });
}

describe('digest page', () => {
  it('renders rows sorted by job from a temporary night file', async () => {
    const runsDir = makeRunsDir([runRecord('z/job'), runRecord('a/job', 'fail')].join('\n'));

    try {
      const response = await createApp(configFor(runsDir)).request('/digest/2026-10-28');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('z/job'));
      expect(html).toContain('class="warn"');
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('returns 404 when the night file does not exist', async () => {
    const runsDir = makeRunsDir();

    try {
      const response = await createApp(configFor(runsDir)).request('/digest/2026-10-30');

      expect(response.status).toBe(404);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('renders an empty night as nothing ran', async () => {
    const runsDir = makeRunsDir('');

    try {
      const response = await createApp(configFor(runsDir)).request('/digest/2026-10-28');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('nothing ran');
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('renders valid rows and counts malformed lines', async () => {
    const runsDir = makeRunsDir(`not-json\n${runRecord('valid/job')}`);

    try {
      const response = await createApp(configFor(runsDir)).request('/digest/2026-10-28');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('1 malformed line');
      expect(html).toContain('valid/job');
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});