import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.notFound();

    try {
      return c.json(readNight(config.runsDir, night).rows);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return c.notFound();
      }
      throw error;
    }
  });

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.notFound();

    try {
      const { rows, malformedLines } = readNight(config.runsDir, night);
      return c.html(
        <Layout title={`digest ${night}`} lane={lane()}>
          <DigestPage night={night} rows={rows} malformedLines={malformedLines} />
        </Layout>,
      );
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return c.notFound();
      }
      throw error;
    }
  });

  return app;
}
