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

let cache = new Set();

async function fetchVinted() {
  try {
    const url =
      "https://www.vinted.fr/catalog?search_text=cartes%20pokemon&price_from=1.1&currency=EUR&page=1&order=newest_first";

    const { data } = await axios.get(url, {
      timeout: 8000, // évite les longues attentes
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      }
    });

    const $ = cheerio.load(data);
    let newItems = [];

    // IMPORTANT : Vinted change souvent, on log si rien n'est trouvé
    const items = $("[data-testid='item-box']");
    if (items.length === 0) {
      console.log("⚠️ Aucun item trouvé — Vinted bloque probablement la requête");
      return; // ne pas crash
    }

    items.each((_, el) => {
      const id = $(el).attr("data-id");

      if (!cache.has(id)) {
        cache.add(id);

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

  } catch (e) {
    console.log("❌ Erreur lors du fetch :", e.message);
    // surtout ne pas throw → sinon Render redémarre
  }
}

setInterval(fetchVinted, 3500); // interval plus slow pour éviter blocage

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🚀 Monitor running on port " + PORT));
