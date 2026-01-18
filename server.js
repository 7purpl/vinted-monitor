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
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const $ = cheerio.load(data);
    let newItems = [];

    $("[data-testid='item-box']").each((_, el) => {
      const id = $(el).attr("data-id");

      if (!cache.has(id)) {
        cache.add(id);

        const link = "https://www.vinted.fr" + $(el).find("a").attr("href");
        const title = $(el).find("h3").text().trim();
        const price = $(el).find("[data-testid='price']").text().trim();
        const img = $(el).find("img").attr("src") ||
                    $(el).find("img").attr("data-src") ||
                    "";

        newItems.push({
          id,
          title,
          price,
          img,
          link
        });
      }
    });

    if (newItems.length > 0) {
      io.emit("new_items", newItems);
      console.log("Nouvelles annonces :", newItems.length);
    }

  } catch (e) {
    console.log("Erreur scraping :", e.message);
  }
}

setInterval(fetchVinted, 2000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Monitor running on port " + PORT));
