import {
  handleModules,
  handleDiscordModules,
} from "./modules/index.js";

const encoder = new TextEncoder();

function getConfig(env) {
  return {
    applicationId: env.APPLICATION_ID,
    publicKey: env.DISCORD_PUBLIC_KEY,
    token: env.DISCORD_TOKEN,

    guildIds: (env.GUILD_IDS || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean),

    channelIds: (env.CHANNEL_IDS || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean),
  };
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("Nieprawidłowy HEX.");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    const value = parseInt(
      hex.slice(i, i + 2),
      16
    );

    if (Number.isNaN(value)) {
      throw new Error("Nieprawidłowy HEX.");
    }

    bytes[i / 2] = value;
  }

  return bytes;
}

async function verifyDiscordRequest(
  request,
  body,
  publicKey
) {
  const signature =
    request.headers.get(
      "X-Signature-Ed25519"
    );

  const timestamp =
    request.headers.get(
      "X-Signature-Timestamp"
    );

  if (!signature || !timestamp || !publicKey) {
    return false;
  }

  try {
    const key =
      await crypto.subtle.importKey(
        "raw",
        hexToBytes(publicKey),
        {
          name: "Ed25519",
        },
        false,
        ["verify"]
      );

    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      encoder.encode(timestamp + body)
    );
  } catch (error) {
    console.error(
      "Discord verification error:",
      error
    );

    return false;
  }
}

function getCommands() {
  return [
    {
      name: "plan",
      description: "Ustawia tekst dla Twitcha",

      default_member_permissions: "8",

      options: [
        {
          name: "text",
          description: "Tekst do zapisania",
          type: 3,
          required: true,
        },
      ],
    },

    {
      name: "log",
      description:
        "Wyszukuje wiadomości widza na streamie",

      options: [
        {
          name: "stream",
          description: "Nazwa streamera",
          type: 3,
          required: true,
        },
        {
          name: "user",
          description: "Nazwa widza",
          type: 3,
          required: true,
        },
      ],
    },

    {
      name: "gra",
      description:
        "Sprawdza informacje o grze na Steam",

      options: [
        {
          name: "game",
          description: "Nazwa gry",
          type: 3,
          required: true,
        },
      ],
    },

    {
      name: "xayoo",
      description:
        "Pokazuje czas oglądania widza",

      options: [
        {
          name: "nick",
          description:
            "Nick streamera na Twitchu",
          type: 3,
          required: true,
        },

        {
          name: "viewer",
          description:
            "Opcjonalny nick widza",
          type: 3,
          required: false,
        },
      ],
    },
  ];
}

async function registerCommands(
  env,
  guildId
) {
  const cfg = getConfig(env);

  if (!cfg.applicationId || !cfg.token) {
    return {
      status: 500,
      body:
        "Brakuje APPLICATION_ID lub DISCORD_TOKEN.",
    };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/applications/${cfg.applicationId}/guilds/${guildId}/commands`,
      {
        method: "PUT",

        headers: {
          Authorization:
            `Bot ${cfg.token}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          getCommands()
        ),
      }
    );

    return {
      status: response.status,
      body: await response.text(),
    };
  } catch (error) {
    console.error(
      "Register commands error:",
      error
    );

    return {
      status: 500,
      body: String(error),
    };
  }
}

async function editOriginalResponse(
  env,
  interactionToken,
  content
) {
  const cfg = getConfig(env);

  if (!cfg.applicationId || !interactionToken) {
    return;
  }

  const url =
    `https://discord.com/api/v10/webhooks/` +
    `${cfg.applicationId}/` +
    `${interactionToken}/messages/@original`;

  try {
    const response = await fetch(
      url,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          content:
            String(
              content ||
                "Brak odpowiedzi."
            ).slice(0, 2000),
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "Discord edit response:",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.error(
      "Discord edit error:",
      error
    );
  }
}


async function handleDiscordInteraction(
  data,
  env,
  ctx
) {
  /* PING */

  if (data.type === 1) {
    return Response.json({
      type: 1,
    });
  }

  if (data.type !== 2) {
    return Response.json({
      type: 4,

      data: {
        content:
          "Nieobsługiwana interakcja.",
        flags: 64,
      },
    });
  }

  ctx.waitUntil(
    (async () => {
      try {
        const result =
          await handleDiscordModules(
            data,
            env
          );

        if (!result) {
          await editOriginalResponse(
            env,
            data.token,
            "Nieznana komenda."
          );

          return;
        }

        const json =
          await result.json();

        const content =
          json?.data?.content;

        await editOriginalResponse(
          env,
          data.token,
          content ||
            "Nie udało się uzyskać odpowiedzi."
        );
      } catch (error) {
        console.error(
          "Discord module error:",
          error
        );

        await editOriginalResponse(
          env,
          data.token,
          "Wystąpił błąd podczas wykonywania komendy."
        );
      }
    })()
  );

  return Response.json({
    type: 5,
  });
}

async function configCheck(
  env
) {
  const cfg = getConfig(env);

  return Response.json({
    applicationConfigured:
      Boolean(cfg.applicationId),

    publicKeyConfigured:
      Boolean(cfg.publicKey),

    tokenConfigured:
      Boolean(cfg.token),

    guildsConfigured:
      cfg.guildIds.length > 0,

    channelsConfigured:
      cfg.channelIds.length > 0,

    kvConfigured:
      Boolean(env.PARIS),

    setupSecretConfigured:
      Boolean(env.SETUP_SECRET),

    moderatorSecretConfigured:
      Boolean(env.MODERATOR_SECRET),
  });
}

export default {
  async fetch(
    request,
    env,
    ctx
  ) {
    const url =
      new URL(request.url);

    const pathname =
      url.pathname;

    const cfg =
      getConfig(env);

    if (
      pathname === "/config-check"
    ) {
      return configCheck(env);
    }

    if (
      pathname === "/register-plan"
    ) {
      const secret =
        url.searchParams.get(
          "secret"
        );

      if (
        !env.SETUP_SECRET ||
        secret !== env.SETUP_SECRET
      ) {
        return new Response(
          "Brak uprawnień.",
          {
            status: 403,
          }
        );
      }

      if (
        cfg.guildIds.length === 0
      ) {
        return new Response(
          "Brak GUILD_IDS.",
          {
            status: 500,
          }
        );
      }

      const results = {};

      for (
        const guildId
        of cfg.guildIds
      ) {
        results[guildId] =
          await registerCommands(
            env,
            guildId
          );
      }

      return Response.json(
        results
      );
    }

    if (
      pathname === "/discord" &&
      request.method === "POST"
    ) {
      const body =
        await request.text();

      const valid =
        await verifyDiscordRequest(
          request,
          body,
          cfg.publicKey
        );

      if (!valid) {
        return new Response(
          "Invalid request signature",
          {
            status: 401,
          }
        );
      }

      let data;

      try {
        data =
          JSON.parse(body);
      } catch {
        return new Response(
          "Invalid JSON",
          {
            status: 400,
          }
        );
      }

      return handleDiscordInteraction(
        data,
        env,
        ctx
      );
    }

    try {
      const response =
        await handleModules(
          request,
          env
        );

      if (response) {
        return response;
      }
    } catch (error) {
      console.error(
        "Module HTTP error:",
        error
      );

      return new Response(
        "Błąd modułu.",
        {
          status: 500,
        }
      );
    }

    return new Response(
      "Nieznany endpoint.",
      {
        status: 404,
      }
    );
  },
}; 
