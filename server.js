const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.static("public"));

let cache = [];
const CACHE_LIMIT = 2000;

function addToCache(id) {
  cache.push(id);
  if (cache.length > CACHE_LIMIT) cache.shift();
}

function isInCache(id) {
  return cache.includes(id);
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

async function scrape() {
  try {
    const url =
      "https://www.vinted.fr/catalog?search_text=cartes%20pokemon&price_from=1.1&currency=EUR&page=1&order=newest_first";

    const { data } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(data);

    let items = [];

    $("[data-testid='item-box']").each((i, el) => {
      const id = $(el).attr("data-testid") + "-" + i;
      if (!isInCache(id)) {
        addToCache(id);

        const link = "https://www.vinted.fr" + $(el).find("a").attr("href");
        const title = $(el).find("h3").text().trim();
        const price = $(el).find("[data-testid='price']").text().trim();
        const img =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src") ||
          "";

        items.push({ id, title, price, img, link });
      }
    });

    return items;
  } catch (e) {
    console.log("Erreur scraping:", e.message);
    return [];
  }
}

let lastPush = [];

app.get("/api", async (req, res) => {
  res.json(lastPush);
});

app.get("/", (req, res) => {
  res.send("OK");
});

// ⚠️ interval augmenté → Vinted bloque moins
setInterval(async () => {
  const items = await scrape();

  if (items.length) lastPush = items;

  if (global.gc) global.gc(); // anti-oom
}, 8000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Monitor running on port " + PORT));
