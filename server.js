const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

/* ------------------------------------------------------
   🔒 CACHE LIMITÉ → empêche fuite mémoire (RAM stable)
------------------------------------------------------- */
let cache = [];
const CACHE_LIMIT = 5000;

function addToCache(id) {
  cache.push(id);
  if (cache.length > CACHE_LIMIT) {
    cache.shift(); // supprime les plus anciennes entrées
  }
}

function isInCache(id) {
  return cache.includes(id);
}

/* ------------------------------------------------------
   🔄 SCRAPER VINTED
------------------------------------------------------- */
async function fetchVinted() {
  try {
    const url =
      "https://www.vinted.fr/catalog?search_text=cartes%20pokemon&price_from=1.1&currency=EUR&page=1&order=newest_first";

    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      }
    });

    const $ = cheerio.load(data);
    let newItems = [];

    const items = $("[data-testid='item-box']");

    if (items.length === 0) {
      console.log("⚠️ Vinted n’a retourné aucun item. Temp block probable.");
      return;
    }

    items.each((_, el) => {
      const id = $(el).attr("data-id");
      if (!id) return;

      if (!isInCache(id)) {
        addToCache(id);

        const link = "https://www.vinted.fr" + $(el).find("a").attr("href");
        const title = $(el).find("h3").text().trim();
        const price = $(el).find("[data-testid='price']").text().trim();
        const img =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src") ||
          "";

        newItems.push({ id, title, price, img, link });
      }
    });

    if (newItems.length > 0) {
      io.emit("new_items", newItems);
      console.log("✨ Nouvelles annonces :", newItems.length);
    }

    // Garbage Collector manuel si dispo
    if (global.gc) global.gc();

  } catch (e) {
    console.log("❌ Erreur scraping :", e.message);
    // On ne crash JAMAIS — Render reste UP
  }
}

// Toutes les 3.5 secondes (= safe pour Vinted + Render)
setInterval(fetchVinted, 3500);

/* ------------------------------------------------------
   🚀 DÉMARRAGE SERVEUR
------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🚀 Monitor running on port " + PORT));
