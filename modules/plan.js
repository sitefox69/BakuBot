const PLAN_KEY = "plan";
function getPlanChannelIds(env) {
  const channels = (env.CHANNEL_IDS || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  if (
    channels.length === 0 &&
    env.PLAN_CHANNEL_ID
  ) {
    channels.push(
      env.PLAN_CHANNEL_ID.trim()
    );
  }
  return [...new Set(channels)]
    .filter(Boolean);
}
function cleanPlan(text) {
  return String(text || "")
    .replace(/@everyone/gi, "")
    .trim();
}
async function savePlan(env, text) {
  if (!env.PARIS) {
    throw new Error(
      "Brak KV PARIS."
    );
  }
  const clean =
    cleanPlan(text);
  await env.PARIS.put(
    PLAN_KEY,
    clean
  );
  return clean;
}
/* ==========================================
   DISCORD — WYSYŁANIE NA WSZYSTKIE KANAŁY
========================================== */
async function sendPlanToDiscord(
  env,
  text,
  user = null
) {
  if (!env.DISCORD_TOKEN) {
    throw new Error(
      "Brak DISCORD_TOKEN."
    );
  }
  const channelIds =
    getPlanChannelIds(env);
  if (channelIds.length === 0) {
    throw new Error(
      "Brak CHANNEL_IDS lub PLAN_CHANNEL_ID."
    );
  }
  let message;
  if (user) {
    message =
      `@everyone\n` +
      `Plan został zmieniony przez: *${user}*\n` +
      `**${text}**`;
  } else {
    message =
      `@everyone\n` +
      `**${text}**`;
  }
  await Promise.all(
    channelIds.map(
      async (channelId) => {
        const response =
          await fetch(
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
                content: message,
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
            `Discord kanał ${channelId}: HTTP ${response.status}: ${error}`
          );
        }
        return channelId;
      }
    )
  );
}
/* ==========================================
   DISCORD /plan
========================================== */
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
          "\u200B",
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
    await sendPlanToDiscord(
      env,
      clean
    );
    /*
     * Pusta odpowiedź ephemeral.
     * Użytkownik nie dostaje komunikatu
     * na kanale Discorda.
     */
    return Response.json({
      type: 4,
      data: {
        content:
          "\u200B",
        flags: 64
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
/* ==========================================
   HTTP
========================================== */
export async function handle(
  request,
  env,
  ctx
) {
  const url =
    new URL(request.url);
  /* ----------------------------------------
     GET /plan
  ---------------------------------------- */
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
        plan ||
          "Brak ustawionego planu.",
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
  /* ----------------------------------------
     GET /zmiana
     StreamElements
  ---------------------------------------- */
  if (
    request.method === "GET" &&
    url.pathname === "/zmiana"
  ) {
    const secret =
      url.searchParams.get(
        "secret"
      );
    const text =
      url.searchParams
        .get("text")
        ?.trim();
    const user =
      url.searchParams
        .get("user")
        ?.trim() ||
      "Nieznany użytkownik";
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
      /*
       * Zapisujemy plan.
       */
      const clean =
        await savePlan(
          env,
          text
        );
      /*
       * Discord wysyłamy w tle.
       * StreamElements nie musi
       * czekać na Discord API.
       */
      if (
        ctx &&
        typeof ctx.waitUntil ===
          "function"
      ) {
        ctx.waitUntil(
          sendPlanToDiscord(
            env,
            clean,
            user
          ).catch(error => {
            console.error(
              "PLAN DISCORD BACKGROUND ERROR:",
              error
            );
          })
        );
      } else {
        await sendPlanToDiscord(
          env,
          clean,
          user
        );
      }
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
