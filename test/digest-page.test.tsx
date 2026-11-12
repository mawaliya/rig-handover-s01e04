import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function configFor(runsDir: string) {
  return { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };
}

describe('digest page', () => {
  it('renders rows sorted by job from the selected night', async () => {
    const response = await createApp(configFor('runs')).request('/digest/2026-10-28');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html.indexOf('digest/render')).toBeLessThan(html.indexOf('fixtures/refresh'));
    expect(html).toContain('rig/rotate-logs');
    expect(html).toContain('class="warn"');
  });

  it('returns 404 when the night file does not exist', async () => {
    const response = await createApp(configFor('runs')).request('/digest/2026-10-30');

    expect(response.status).toBe(404);
  });

  it('renders an empty night as nothing ran', async () => {
    const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(runsDir, '2026-10-28.jsonl'), '');

    try {
      const response = await createApp(configFor(runsDir)).request('/digest/2026-10-28');
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('nothing ran');
    } finally {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });
});