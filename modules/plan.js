const PLAN_KEY = "plan";

function getPlanChannelId(env) {
  if (env.PLAN_CHANNEL_ID) {
    return env.PLAN_CHANNEL_ID.trim();
  }

  const channels = (env.CHANNEL_IDS || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  return channels[0] || null;
}

function cleanPlan(text) {
  return String(text || "")
    .replace(/@everyone/gi, "")
    .trim();
}

async function savePlan(env, text) {
  if (!env.PARIS) {
    throw new Error("Brak KV PARIS.");
  }

  const clean = cleanPlan(text);

  await env.PARIS.put(
    PLAN_KEY,
    clean
  );

  return clean;
}

async function sendPlanToDiscord(env, text) {
  if (!env.DISCORD_TOKEN) {
    throw new Error("Brak DISCORD_TOKEN.");
  }

  const channelId =
    getPlanChannelId(env);

  if (!channelId) {
    throw new Error(
      "Brak PLAN_CHANNEL_ID lub CHANNEL_IDS."
    );
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bot ${env.DISCORD_TOKEN}`,

        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        content: `**@everyone ${text}**`,

        allowed_mentions: {
          parse: ["everyone"]
        }
      })
    }
  );

  if (!response.ok) {
    const error =
      await response.text();

    throw new Error(
      `Discord HTTP ${response.status}: ${error}`
    );
  }
}

export async function handleDiscord(
  data,
  env
) {
  if (
    data?.type !== 2 ||
    data?.data?.name !== "plan"
  ) {
    return null;
  }

  const text =
    data.data.options
      ?.find(
        option =>
          option.name === "text"
      )
      ?.value
      ?.trim();

  if (!text) {
    return Response.json({
      type: 4,

      data: {
        content:
          "Podaj tekst planu.",

        flags: 64
      }
    });
  }

  try {
    const clean =
      await savePlan(
        env,
        text
      );

    return Response.json({
      type: 4,

      data: {
        content:
          `**@everyone ${clean}**`,

        allowed_mentions: {
          parse: ["everyone"]
        }
      }
    });
  } catch (error) {
    console.error(
      "PLAN DISCORD ERROR:",
      error
    );

    return Response.json({
      type: 4,

      data: {
        content:
          "Nie udało się zapisać planu.",

        flags: 64
      }
    });
  }
}

export async function handle(
  request,
  env
) {
  const url =
    new URL(request.url);

  if (
    request.method === "GET" &&
    url.pathname === "/plan" &&
    !url.searchParams.has("text")
  ) {
    try {
      const plan =
        await env.PARIS.get(
          PLAN_KEY
        );

      return new Response(
        plan || "Brak ustawionego planu.",
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",

            "Cache-Control":
              "no-store"
          }
        }
      );
    } catch (error) {
      console.error(
        "PLAN GET ERROR:",
        error
      );

      return new Response(
        "Błąd pobierania planu.",
        {
          status: 500
        }
      );
    }
  }

  if (
    request.method === "GET" &&
    url.pathname === "/zmiana"
  ) {
    const secret =
      url.searchParams.get(
        "secret"
      );

    const text =
      url.searchParams.get(
        "text"
      )?.trim();

    const user =
      url.searchParams.get(
        "user"
      ) || "";

    if (
      !env.MODERATOR_SECRET ||
      secret !== env.MODERATOR_SECRET
    ) {
      return new Response(
        "Brak uprawnień.",
        {
          status: 403
        }
      );
    }

    if (!text) {
      return new Response(
        "Podaj tekst.",
        {
          status: 400
        }
      );
    }

    try {
      const clean =
        await savePlan(
          env,
          text
        );

      await sendPlanToDiscord(
        env,
        clean
      );

      console.log(
        `Plan zmieniony przez SE: ${user}`
      );

      return new Response(
        clean,
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",

            "Cache-Control":
              "no-store"
          }
        }
      );
    } catch (error) {
      console.error(
        "PLAN ZMIANA ERROR:",
        error
      );

      return new Response(
        "Nie udało się zmienić planu.",
        {
          status: 500
        }
      );
    }
  }

  return null;
}
