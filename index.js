import express from "express"
import { refreshDb, findRow, listByLowestDesc, listByAverageDesc } from "./db/index.js"

const app = express()
const port = 3000

app.listen(port, () => {
  console.log(`WF app listening on port ${port} http://localhost:${port}`)
})

app.get("/", (req, res) => {
  const endpoints = [
    "/refresh",
    "/mods/find",
    "/mods/lowest",
    "/mods/average"
  ];
  const instructions = endpoints.join(", ")
  res.send("Endpoints: \n " + instructions)
})

app.get('/refresh', (req, res) => {
  refreshDb();
  res.send("Refreshing DB in the background (check logs on progress)");
})

app.get("/mods/find", (req, res) => {
  const { modName, } = req.query;
  console.log("finding", modName)
  res.json(findRow(modName));
})

app.get('/mods/lowest', (req, res) => {
  try {
    const rows = listByLowestDesc();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/mods/average', (req, res) => {
  try {
    const rows = listByAverageDesc();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
