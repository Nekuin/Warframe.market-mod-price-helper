import { DatabaseSync } from 'node:sqlite'
import { marketMods, topSellOrder } from '../api/index.js';
import { wait } from '../util/index.js';

const db = new DatabaseSync('data.db');

const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mod_prices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lowest INTEGER NOT NULL,
      average REAL NOT NULL
    )
  `);
};

initDb();

const upsert = db.prepare(`
INSERT INTO mod_prices (id, name, lowest, average)
VALUES (?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
name = excluded.name,
lowest = excluded.lowest,
average = excluded.average
`);

const findStmt = db.prepare(
  `
    SELECT * FROM mod_prices WHERE name = ?
`);

const listByLowestStmt = db.prepare(`
  SELECT id, name, lowest, average
  FROM mod_prices
  ORDER BY lowest DESC
`);

const listByAverageStmt = db.prepare(`
  SELECT id, name, lowest, average
  FROM mod_prices
  ORDER BY average DESC
`);

export const upsertRow = (mod, topSellOrder) => {
  upsert.run(mod.slug, mod.name, topSellOrder.lowest, topSellOrder.average);
}

export const findRow = (modName) => {
  return findStmt.get(modName);
}

export const listByLowestDesc = () => {
  return listByLowestStmt.all();
}

export const listByAverageDesc = () => {
  return listByAverageStmt.all();
}

export const refreshDb = () => {
  const MAX_WAIT = 2000;
  marketMods().then(async mods => {

    const len = mods.length;
    console.log(len, "mods found");

    let i = 0;
    for await (const mod of mods) {

      let result;
      let delay = 1;
      let remaining = MAX_WAIT;

      do {
        result = await topSellOrder(mod.slug);

        // success
        if (!result.timeout) {
          break;
        }

        // time budget exhausted
        if (remaining <= 0) {
          break;
        }

        const waitTime = Math.min(delay, remaining);
        await wait(waitTime);

        remaining -= waitTime;
        delay *= 2;
      } while (true)
      i++;

      const r = { ...mod, ...result };
      console.log(`Fetched (${i}/${len})`, r)
      upsertRow(mod, result);
    }
    console.log("All mods refreshed")
  })
}
