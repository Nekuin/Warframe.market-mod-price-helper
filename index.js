const express = require('express')
const app = express()
const port = 3000
const { DatabaseSync } = require('node:sqlite')

const base_url = "https://api.warframe.market/v2";
const headers = {
  "Language": "en"
}

const EXCLUDE_PVP = true;

const max_wait = 2000;
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

async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  })
}

app.get('/', (req, res) => {
  marketMods().then(async mods => {

    console.log(mods.length, "mods found");
    for await (const mod of mods) {

      let retry = 0, result;

      do {
        if (retry !== 0) {
          await wait(Math.pow(2, retry))
        }
        result = await topSellOrder(mod.slug);
        retry++;
      } while (result.timeout || Math.pow(2, retry) > max_wait)

      const r = { ...mod, ...result };
      console.log("Fetched", r)
      upsertRow(mod, result);
    }

    res.send("");
  })
})

app.get("/mods/find", (req, res) => {
  const { modName, } = req.query;
  console.log("finding", modName)
  res.json(findRow(modName));
})

app.get('/mods/lowest', (req, res) => {
  try {
    const rows = listByLowestStmt.all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/mods/average', (req, res) => {
  try {
    const rows = listByAverageStmt.all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`WF app listening on port ${port}`)
})

const getItems = async () => {
  const response = await fetch(`${base_url}/items`,
    {
      method: "GET",
      headers,
    }
  )

  const data = await response.json();
  return data.data;
}

const marketMods = async () => {
  const items = await getItems();

  return items.reduce((modItems, item) => {
    if (item.tags.includes("mod") && !item.tags.includes("pvp") && !item.gameRef.includes("PvPAugment")) {
      modItems.push({
        slug: item.slug,
        name: item.i18n.en.name,
      });
    }
    return modItems;
  }, [])
}

const topSellOrder = async (itemSlug) => {
  const response = await fetch(
    `${base_url}/orders/item/${itemSlug}/top`,
    {
      method: "GET",
      headers,
    }
  );

  if (response.status == 429) {
    return {
      timeout: true
    }
  }
  const data = await response.json();
  const sellOrders = data.data.sell;
  const platPrices = sellOrders.map(order => order.platinum);

  const exists = platPrices[0] || false;

  return {
    lowest: exists ? platPrices[0] : 0,
    average: exists ? platPrices.reduce((a, b) => a + b, 0) / platPrices.length : 0,
  }
}


const upsertRow = (mod, topSellOrder) => {
  upsert.run(mod.slug, mod.name, topSellOrder.lowest, topSellOrder.average);
}

const findRow = (modName) => {
  return findStmt.get(modName);
}
