const SOUNDBOARD_API_BASE = "https://soundboardonline.com/api/v1";

const MAX_SOUND_LENGTH = 100;
const MAX_USER_LENGTH = 50;
const MAX_PREFIX_LENGTH = 20;

export async function handle(request, env) {
  const url = new URL(request.url);

  // Ten moduł obsługuje wyłącznie /soundboard.
  if (url.pathname !== "/soundboard") {
    return null;
  }

  // StreamElements wywołuje nas przez GET.
  if (request.method !== "GET") {
    return textResponse("Method Not Allowed", 405);
  }

  /*
   * ============================================================
   * AUTHORIZATION
   * ============================================================
   */

  const requestToken = url.searchParams.get("token");
  const expectedToken = env.SOUNDBOARD_WEBHOOK_SECRET;

  if (!expectedToken) {
    console.error(
      "Brak SOUNDBOARD_WEBHOOK_SECRET w konfiguracji Workera."
    );

    return textResponse(
      "Soundboard bridge nie jest skonfigurowany.",
      500
    );
  }

  if (
    !requestToken ||
    !secureCompare(requestToken, expectedToken)
  ) {
    return textResponse("Unauthorized", 401);
  }

  /*
   * ============================================================
   * PARAMETERS
   * ============================================================
   *
   * sound  = nazwa wpisana po komendzie
   * user   = nick widza
   * prefix = opcjonalny prefix dodawany przed nazwą dźwięku
   *
   * Przykład:
   *
   * sound=wikson
   * prefix=!ps
   *
   * Soundboard Online dostanie:
   *
   * !ps wikson
   */

  const sound = url.searchParams.get("sound");
  const user = url.searchParams.get("user") || "Unknown";
  const prefix = url.searchParams.get("prefix") || "";

  if (!sound) {
    return textResponse("Brak nazwy dźwięku.", 400);
  }

  const normalizedSound = sound.trim();
  const normalizedUser = user.trim();
  const normalizedPrefix = prefix.trim();

  if (!normalizedSound) {
    return textResponse(
      "Nazwa dźwięku nie może być pusta.",
      400
    );
  }

  if (normalizedSound.length > MAX_SOUND_LENGTH) {
    return textResponse(
      `Nazwa dźwięku jest za długa. Maksymalnie ${MAX_SOUND_LENGTH} znaków.`,
      400
    );
  }

  if (normalizedUser.length > MAX_USER_LENGTH) {
    return textResponse(
      `Nick użytkownika jest za długi. Maksymalnie ${MAX_USER_LENGTH} znaków.`,
      400
    );
  }

  if (normalizedPrefix.length > MAX_PREFIX_LENGTH) {
    return textResponse(
      `Prefix jest za długi. Maksymalnie ${MAX_PREFIX_LENGTH} znaków.`,
      400
    );
  }

  /*
   * ============================================================
   * FINAL SOUND NAME
   * ============================================================
   *
   * Bez prefixu:
   * Discord -> Discord
   *
   * Z prefixem !ps:
   * wikson -> !ps wikson
   */

  const finalSoundName = normalizedPrefix
    ? `${normalizedPrefix} ${normalizedSound}`
    : normalizedSound;

  /*
   * ============================================================
   * CLOUDFLARE VARIABLES
   * ============================================================
   */

  const apiKey = env.SOUNDBOARD_API_KEY;
  const roomId = env.SOUNDBOARD_ROOM_ID;

  if (!apiKey || !roomId) {
    console.error(
      "Brak SOUNDBOARD_API_KEY lub SOUNDBOARD_ROOM_ID."
    );

    return textResponse(
      "Soundboard bridge nie jest prawidłowo skonfigurowany.",
      500
    );
  }

  /*
   * ============================================================
   * SOUNDBOARD ONLINE API
   * ============================================================
   */

  const endpoint =
    `${SOUNDBOARD_API_BASE}/rooms/` +
    `${encodeURIComponent(roomId)}/play`;

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },

      body: JSON.stringify({
        sound: finalSoundName,
        by: normalizedUser,
      }),
    });
  } catch (error) {
    console.error(
      "Błąd połączenia z Soundboard Online:",
      error
    );

    return textResponse(
      "Nie udało się połączyć z Soundboard Online.",
      502
    );
  }

  /*
   * ============================================================
   * RESPONSE
   * ============================================================
   */

  const responseText = await response.text();

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }
  }

  /*
   * ============================================================
   * SUCCESS
   * ============================================================
   */

  if (response.ok) {
    const listeners = getListeners(data);

    // Jeżeli nie ma aktywnego listenera, informujemy o tym.
    if (listeners === 0) {
      return textResponse(
        `Dźwięk „${finalSoundName}” został wysłany, ` +
        `ale Soundboard Online nie ma aktywnego listenera.`,
        200
      );
    }

    // Poprawne odtworzenie.
    // Przykład:
    // Odtwarzam „!ps wikson”.
    return textResponse(
      `Odtwarzam „${finalSoundName}”.`,
      200
    );
  }

  /*
   * ============================================================
   * KNOWN ERRORS
   * ============================================================
   */

  switch (response.status) {
    case 401:
      console.error(
        "Soundboard Online: nieprawidłowy API key."
      );

      return textResponse(
        "Soundboard Online odrzucił klucz API.",
        502
      );

    case 403:
      return textResponse(
        "Soundboard jest obecnie zatrzymany lub wyłączony.",
        200
      );

    case 404:
      return textResponse(
        `Nie znaleziono dźwięku „${finalSoundName}”.`,
        200
      );

    case 409: {
      const candidates = extractCandidates(data);

      if (candidates.length > 0) {
        return textResponse(
          `Niejednoznaczna nazwa „${finalSoundName}”. ` +
          `Możliwe dźwięki: ${candidates.join(", ")}`,
          200
        );
      }

      return textResponse(
        `Nazwa „${finalSoundName}” jest niejednoznaczna.`,
        200
      );
    }

    case 429:
      return textResponse(
        "Soundboard Online ma chwilowo za dużo żądań. Spróbuj ponownie później.",
        200
      );

    default:
      console.error(
        `Soundboard Online HTTP ${response.status}:`,
        responseText
      );

      return textResponse(
        `Soundboard Online zwrócił błąd (${response.status}).`,
        502
      );
  }
}

/*
 * ================================================================
 * HELPERS
 * ================================================================
 */

function textResponse(message, status = 200) {
  return new Response(message, {
    status,

    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getListeners(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  return typeof data.listeners === "number"
    ? data.listeners
    : null;
}

function extractCandidates(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  const candidates = data.candidates;

  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((candidate) => {
      if (typeof candidate === "string") {
        return candidate;
      }

      if (
        candidate &&
        typeof candidate === "object" &&
        typeof candidate.name === "string"
      ) {
        return candidate.name;
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 5);
}

/*
 * Stałoczasowe porównanie sekretu.
 */

function secureCompare(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}
