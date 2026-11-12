import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function configFor(runsDir: string) {
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
}

function makeRunsDir(log?: string) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-api-'));
  if (log !== undefined) writeFileSync(join(runsDir, '2026-10-28.jsonl'), log);
  return runsDir;
}

function runRecord(job: string) {
  return JSON.stringify({ at: '2026-10-28T23:00:02+01:00', job, status: 'ok', owner: null });
}

describe('digest JSON endpoint', () => {
  it('returns the same jobs in the same order as the page', async () => {
    const log = [runRecord('z/job'), runRecord('a/job')].join('\n');
    const runsDir = makeRunsDir(log);

    try {
      const app = createApp(configFor(runsDir));
      const response = await app.request('/api/digest/2026-10-28');
      const rows = await response.json() as { job: string }[];
      const page = await app.request('/digest/2026-10-28');
      const html = await page.text();
      const pagePositions = rows.map(({ job }) => html.indexOf(`<td>${job}</td>`));

      expect(response.status).toBe(200);
      expect(rows.map(({ job }) => job)).toEqual(['a/job', 'z/job']);
      expect(pagePositions.every((position) => position >= 0)).toBe(true);
      expect(pagePositions).toEqual([...pagePositions].sort((a, b) => a - b));
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('returns 404 when the night file does not exist', async () => {
    const runsDir = makeRunsDir();

    try {
      const response = await createApp(configFor(runsDir)).request('/api/digest/2026-10-30');

      expect(response.status).toBe(404);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('returns an empty array for an empty night', async () => {
    const runsDir = makeRunsDir('');

    try {
      const response = await createApp(configFor(runsDir)).request('/api/digest/2026-10-28');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  it('skips malformed lines and returns valid rows', async () => {
    const runsDir = makeRunsDir(`not-json\n${runRecord('valid/job')}`);

    try {
      const response = await createApp(configFor(runsDir)).request('/api/digest/2026-10-28');

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject([{ job: 'valid/job' }]);
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});