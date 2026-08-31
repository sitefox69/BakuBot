const XAYO_BASE_URL = 
  "https://www.xayo.pl/api/chatters";

function formatWatchtime(minutes) {
  const total =
    Number(minutes) || 0;

  const days =
    Math.floor(total / 1440);

  const hours =
    Math.floor(
      (total % 1440) / 60
    );

  const mins =
    total % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }

  return `${mins}m`;
}

async function getWatchtime(
  channel
) {
  const url =
    `${XAYO_BASE_URL}/` +
    `${encodeURIComponent(channel)}` +
    `/watchtime?platform=twitch&period=all`;

  const response =
    await fetch(url, {
      method: "GET",

      headers: {
        Accept:
          "application/json",
      },
    });

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Xayo API HTTP ${response.status}`
    );
  }

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    throw new Error(
      "Xayo zwróciło nieprawidłowy JSON."
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Xayo API nie zwróciło tablicy."
    );
  }

  return data
    .filter(
      user =>
        user &&
        typeof user.streamerName ===
          "string" &&
        Number.isFinite(
          Number(user.minutes)
        )
    )
    .sort(
      (a, b) =>
        Number(b.minutes) -
        Number(a.minutes)
    );
}

function formatTop3(data) {
  const medals = [
    "🥇",
    "🥈",
    "🥉",
  ];

  return data
    .slice(0, 3)
    .map(
      (user, index) =>
        `${medals[index]}${user.streamerName} (${formatWatchtime(user.minutes)})`
    )
    .join("\n");
}

function findViewer(
  data,
  viewer
) {
  const normalized =
    viewer.toLowerCase();

  return data.find(
    user =>
      user.streamerName
        .toLowerCase() ===
      normalized
  );
}

async function createXayoResponse(
  channel,
  viewer = null
) {
  const data =
    await getWatchtime(channel);

  if (data.length === 0) {
    return (
      `Brak danych watchtime ` +
      `dla kanału ${channel}.`
    );
  }

  if (viewer) {
    const user =
      findViewer(
        data,
        viewer
      );

    if (!user) {
      return (
        `Nie znaleziono widza ` +
        `${viewer} w danych Xayo ` +
        `dla kanału ${channel}.`
      );
    }

    return (
      `${user.streamerName} ` +
      `(${formatWatchtime(user.minutes)})`
    );
  }

  return formatTop3(data);
}

export async function handle(
  request,
  env
) {
  const url =
    new URL(request.url);

  if (
    url.pathname !== "/xayoo"
  ) {
    return null;
  }

  const channel =
    url.searchParams
      .get("channel")
      ?.trim();

  const viewer =
    url.searchParams
      .get("viewer")
      ?.trim();

  if (!channel) {
    return new Response(
      "Brak nicku streamera.",
      {
        status: 400,
      }
    );
  }

  try {
    const message =
      await createXayoResponse(
        channel,
        viewer
      );

    return new Response(
      message,
      {
        status: 200,

        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  } catch (error) {
    console.error(
      "Xayo HTTP error:",
      error
    );

    return new Response(
      "Wystąpił błąd podczas pobierania danych z Xayo.",
      {
        status: 500,
      }
    );
  }
}

export async function handleDiscord(
  data,
  env
) {
  if (
    data.type !== 2 ||
    data.data?.name !== "xayoo"
  ) {
    return null;
  }

  const options =
    data.data.options || [];

  const channel =
    options
      .find(
        option =>
          option.name ===
          "nick"
      )
      ?.value
      ?.trim();

  const viewer =
    options
      .find(
        option =>
          option.name ===
          "viewer"
      )
      ?.value
      ?.trim();

  if (!channel) {
    return Response.json({
      type: 4,

      data: {
        content:
          "Podaj nick streamera.",
        flags: 64,
      },
    });
  }

  try {
    const message =
      await createXayoResponse(
        channel,
        viewer
      );

    return Response.json({
      type: 4,

      data: {
        content: message,
      },
    });
  } catch (error) {
    console.error(
      "Xayo Discord error:",
      error
    );

    return Response.json({
      type: 4,

      data: {
        content:
          "Wystąpił błąd podczas pobierania danych z Xayo.",
        flags: 64,
      },
    });
  }
}
