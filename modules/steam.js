function formatPrice(value) {
  if (typeof value !== "number") return null;

  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value / 100);
}

function formatGenres(genres) {
  if (!Array.isArray(genres) || genres.length === 0) {
    return "Brak danych";
  }

  const translations = {
    Action: "Akcja",
    Adventure: "Przygodowe",
    RPG: "RPG",
    Strategy: "Strategia",
    Simulation: "Symulacja",
    Sports: "Sportowe",
    Racing: "Wyścigi",
    Indie: "Niezależne",
    Casual: "Casual",
    Horror: "Horror",
    "Free to Play": "Free to Play",
    MassivelyMultiplayer: "MMO",
  };

  return genres
    .slice(0, 3)
    .map(genre => translations[genre.description] || genre.description)
    .join(", ");
}

async function findSteamGame(query) {
  const url =
    `https://store.steampowered.com/api/storesearch/` +
    `?term=${encodeURIComponent(query)}` +
    `&l=polish&cc=PL`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Nie udało się wyszukać gry.");
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  return data.items[0];
}

async function getSteamGame(appId) {
  const url =
    `https://store.steampowered.com/api/appdetails` +
    `?appids=${appId}&cc=PL&l=polish`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Nie udało się pobrać danych gry.");
  }

  const data = await response.json();
  const app = data?.[appId];

  if (!app?.success || !app.data) {
    return null;
  }

  return app.data;
}

async function getSteamReviews(appId) {
  const url =
    `https://store.steampowered.com/appreviews/${appId}` +
    `?json=1&language=all&purchase_type=all`;

  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  if (!data.success || !data.query_summary) {
    return null;
  }

  const positive = Number(data.query_summary.total_positive || 0);
  const negative = Number(data.query_summary.total_negative || 0);

  const total = positive + negative;

  if (total === 0) {
    return null;
  }

  const percentage = Math.round((positive / total) * 100);

  return percentage;
}

function createSteamMessage(game, reviews) {
  const price = game.price_overview;

  let priceText = "💰 Cena niedostępna";

  if (price) {
    const initialPrice = formatPrice(price.initial);
    const finalPrice = formatPrice(price.final);
    const discount = price.discount_percent || 0;

    if (discount > 0) {
      priceText =
        `💰 ${initialPrice} → ${finalPrice} (-${discount}%)`;
    } else {
      priceText = `💰 ${finalPrice}`;
    }
  }

  const ratingText =
    reviews !== null && reviews !== undefined
      ? `⭐ ${reviews}%`
      : "⭐ Brak danych";

  const genres = formatGenres(game.genres);

  const releaseDate =
    game.release_date?.date || "Brak danych";

  const steamUrl =
    `https://store.steampowered.com/app/${game.steam_appid}/?l=polish`;

  return (
    `🎮 ${game.name} | ` +
    `${priceText} | ` +
    `${ratingText} | ` +
    `🏷️ ${genres} | ` +
    `📅 ${releaseDate} | ` +
    `🔗 ${steamUrl}`
  );
}

async function createSteamResponse(query) {
  const searchResult = await findSteamGame(query);

  if (!searchResult) {
    return `https://i.ibb.co/Kc5ybnLj/Co-posz-o-nie-tak.png`;
  }

  const game = await getSteamGame(searchResult.id);

  if (!game) {
    return `Nie udało się pobrać danych gry „${query}”.`;
  }

  const reviews = await getSteamReviews(searchResult.id);

  return createSteamMessage(game, reviews);
}

export async function handle(request, env) {
  const url = new URL(request.url);

  if (url.pathname !== "/steam") {
    return null;
  }

  const query = url.searchParams.get("game")?.trim();

  if (!query) {
  return new Response(
    "🎮 Użycie: !gra <tytuł gry> | Przykład: !gra Cyberpunk 2077",
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}

  try {
    const message = await createSteamResponse(query);

    return new Response(message, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Steam error:", error);

    return new Response(
      "Wystąpił błąd podczas pobierania danych ze Steam.",
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      }
    );
  }
}


export async function handleDiscord(data, env) {
  if (data.type !== 2 || data.data?.name !== "gra") {
    return null;
  }

  const query = data.data.options
    ?.find(option => option.name === "game")
    ?.value
    ?.trim();

  if (!query) {
    return Response.json({
      type: 4,
      data: {
        content: "Podaj nazwę gry.",
        flags: 64,
      },
    });
  }

  try {
    const message = await createSteamResponse(query);

    return Response.json({
      type: 4,
      data: {
        content: message,
      },
    });
  } catch (error) {
    console.error("Steam Discord error:", error);

    return Response.json({
      type: 4,
      data: {
        content:
          "Wystąpił błąd podczas pobierania danych ze Steam.",
        flags: 64,
      },
    });
  }
}
