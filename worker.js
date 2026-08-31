import {
  handleModules,
  handleDiscordModules,
} from "./modules/index.js";

const encoder = new TextEncoder();

function getConfig(env) {
  return {
    discordPublicKey: env.DISCORD_PUBLIC_KEY,
    applicationId: env.APPLICATION_ID,

    guildIds: (env.GUILD_IDS || "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean),

    channelIds: (env.CHANNEL_IDS || "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean),
  };
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("Nieprawidłowy HEX.");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }

  return bytes;
}

async function verifyDiscordRequest(request, body, publicKeyHex) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp || !publicKeyHex) {
    return false;
  }

  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKeyHex),
      {
        name: "Ed25519",
      },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      hexToBytes(signature),
      encoder.encode(timestamp + body)
    );
  } catch {
    return false;
  }
}

async function registerCommands(env, guildId) {
  const config = getConfig(env);

  if (!config.applicationId || !env.DISCORD_TOKEN) {
    return {
      status: 500,
      body: "Brakuje APPLICATION_ID lub DISCORD_TOKEN.",
    };
  }

  const response = await fetch(
    `https://discord.com/api/v10/applications/${config.applicationId}/guilds/${guildId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
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
          description: "Wyszukuje wiadomości widza na streamie",
          default_member_permissions: null,
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
          description: "Sprawdza informacje o grze na Steam",
          default_member_permissions: null,
          options: [
            {
              name: "game",
              description: "Nazwa gry",
              type: 3,
              required: true,
            },
          ],
        },
      ]),
    }
  );

  return {
    status: response.status,
    body: await response.text(),
  };
}

async function sendDiscordNotification(
  env,
  channelId,
  text,
  user
) {
  if (!channelId || !env.DISCORD_TOKEN) {
    return false;
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        content:
          `@everyone\n` +
          `Plan został zmieniony przez: *${user}*\n` +
          `**${text}**`,

        allowed_mentions: {
          parse: ["everyone"],
        },
      }),
    }
  );

  return response.ok;
}

export default {
  async fetch(request, env) {

    const moduleResponse = await handleModules(
      request,
      env
    );

    if (moduleResponse) {
      return moduleResponse;
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const params = url.searchParams;

    const config = getConfig(env);

    if (
      pathname === "/config-check"
    ) {
      return Response.json({
        applicationConfigured:
          Boolean(config.applicationId),

        publicKeyConfigured:
          Boolean(config.discordPublicKey),

        tokenConfigured:
          Boolean(env.DISCORD_TOKEN),

        guildsConfigured:
          config.guildIds.length > 0,

        channelsConfigured:
          config.channelIds.length > 0,

        kvConfigured:
          Boolean(env.PARIS),

        moderatorSecretConfigured:
          Boolean(env.MODERATOR_SECRET),
      });
    }

    if (pathname === "/register-plan") {
      if (!env.SETUP_SECRET) {
        return new Response(
          "Brakuje SETUP_SECRET w konfiguracji Workera.",
          { status: 500 }
        );
      }

      const providedSecret =
        params.get("secret");

      if (
        providedSecret !== env.SETUP_SECRET
      ) {
        return new Response(
          "Brak uprawnień.",
          { status: 403 }
        );
      }

      if (
        config.guildIds.length === 0
      ) {
        return new Response(
          "Brakuje GUILD_IDS.",
          { status: 500 }
        );
      }

      const results = {};

      for (const guildId of config.guildIds) {
        results[guildId] =
          await registerCommands(
            env,
            guildId
          );
      }

      return Response.json(results);
    }

    if (
      request.method === "POST" &&
      pathname === "/discord"
    ) {
      const body =
        await request.text();

      const valid =
        await verifyDiscordRequest(
          request,
          body,
          config.discordPublicKey
        );

      if (!valid) {
        return new Response(
          "Invalid request signature",
          { status: 401 }
        );
      }

      const data =
        JSON.parse(body);

      const moduleResponse =
        await handleDiscordModules(
          data,
          env
        );

      if (moduleResponse) {
        return moduleResponse;
      }

      if (data.type === 1) {
        return Response.json({
          type: 1,
        });
      }

      if (
        data.type === 2 &&
        data.data?.name === "plan"
      ) {
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
                "Podaj tekst.",
              flags: 64,
            },
          });
        }

        const savedText =
          text
            .replace(
              /@everyone/gi,
              ""
            )
            .trim();

        if (!savedText) {
          return Response.json({
            type: 4,

            data: {
              content:
                "Nie można zapisać pustego tekstu.",
              flags: 64,
            },
          });
        }

        await env.PARIS.put(
          "current_text",
          savedText
        );

        return Response.json({
          type: 4,

          data: {
            content:
              `**${text}**`,

            allowed_mentions: {
              parse: ["everyone"],
            },
          },
        });
      }

      return Response.json({
        type: 4,

        data: {
          content:
            "Nieznana komenda.",

          flags: 64,
        },
      });
    }

    if (
      pathname === "/zmiana"
    ) {
      const secret =
        params.get("secret");

      if (!env.MODERATOR_SECRET) {
        return new Response(
          "❌ MODERATOR_SECRET nie jest dostępny",
          { status: 500 }
        );
      }

      if (
        secret !==
        env.MODERATOR_SECRET
      ) {
        return new Response(
          "❌ Brak uprawnień",
          { status: 403 }
        );
      }

      const text =
        params.get("text");

      if (!text) {
        return new Response(
          "Podaj parametr text",
          { status: 400 }
        );
      }

      const user =
        params.get("user") ||
        "Nieznany użytkownik";

      await env.PARIS.put(
        "current_text",
        text
      );

      for (
        const channelId
        of config.channelIds
      ) {
        await sendDiscordNotification(
          env,
          channelId,
          text,
          user
        );
      }

      return new Response(
        text,
        {
          status: 200,
          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        }
      );
    }

    if (
      pathname === "/plan" ||
      pathname === "/stream"
    ) {
      const text =
        await env.PARIS.get(
          "current_text"
        );

      return new Response(
        text ||
          "Brak zapisanego tekstu",
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
          },
        }
      );
    }

    return new Response(
      "Nieznany endpoint",
      {
        status: 404,
      }
    );
  },
};
