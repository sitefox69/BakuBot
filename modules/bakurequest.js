const DEFAULT_BAKUREQUEST_URL =
  "https://bakurequest.duckdns.org";


function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    }
  );
}


function textResponse(text, status = 200) {
  return new Response(
    String(text),
    {
      status,
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    }
  );
}


function getBackendUrl(env) {
  return String(
    env.BAKUREQUEST_URL ||
    DEFAULT_BAKUREQUEST_URL
  ).replace(/\/+$/, "");
}


function getApiSecret(env) {
  return String(
    env.BAKUREQUEST_API_SECRET || ""
  ).trim();
}


function getStreamElementsSecret(env) {
  return String(
    env.BAKUREQUEST_SE_SECRET || ""
  ).trim();
}


function getCallerSecret(request) {
  const authorization =
    request.headers.get("Authorization") || "";

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return authorization
      .slice(7)
      .trim();
  }

  return String(
    request.headers.get(
      "X-BakuRequest-Secret"
    ) || ""
  ).trim();
}


function secretsEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i++) {
    difference |= (
      a.charCodeAt(i) ^
      b.charCodeAt(i)
    );
  }

  return difference === 0;
}


function requireCallerSecret(request, env) {
  const expectedSecret =
    getApiSecret(env);

  if (!expectedSecret) {
    return jsonResponse(
      {
        success: false,
        error:
          "bakurequest_api_secret_not_configured",
      },
      503
    );
  }

  const receivedSecret =
    getCallerSecret(request);

  if (
    !secretsEqual(
      receivedSecret,
      expectedSecret
    )
  ) {
    return jsonResponse(
      {
        success: false,
        error: "unauthorized",
      },
      401
    );
  }

  return null;
}


function requireStreamElementsSecret(
  url,
  env
) {
  const expectedSecret =
    getStreamElementsSecret(env);

  if (!expectedSecret) {
    return textResponse(
      "BakuRequest: brak konfiguracji StreamElements.",
      503
    );
  }

  const receivedSecret =
    String(
      url.searchParams.get("key") || ""
    ).trim();

  if (
    !secretsEqual(
      receivedSecret,
      expectedSecret
    )
  ) {
    return textResponse(
      "BakuRequest: unauthorized.",
      401
    );
  }

  return null;
}


async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}


async function fetchBakuRequest(
  env,
  path,
  options = {}
) {
  const baseUrl =
    getBackendUrl(env);

  const apiSecret =
    getApiSecret(env);

  if (!apiSecret) {
    return {
      ok: false,
      status: 503,
      data: {
        success: false,
        error:
          "bakurequest_api_secret_not_configured",
      },
    };
  }

  const headers =
    new Headers(
      options.headers || {}
    );

  headers.set(
    "Accept",
    "application/json"
  );

  headers.set(
    "X-BakuRequest-Secret",
    apiSecret
  );

  if (
    options.body !== undefined &&
    options.body !== null &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  try {
    const response =
      await fetch(
        `${baseUrl}${path}`,
        {
          ...options,
          headers,
        }
      );

    const contentType =
      response.headers.get(
        "Content-Type"
      ) || "";

    let data;

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      data =
        await response.json();
    } else {
      data = {
        success: response.ok,
        response:
          await response.text(),
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };

  } catch (error) {
    return {
      ok: false,
      status: 502,
      data: {
        success: false,
        error:
          "bakurequest_backend_unavailable",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
    };
  }
}


async function callBakuRequest(
  env,
  path,
  options = {}
) {
  const result =
    await fetchBakuRequest(
      env,
      path,
      options
    );

  return jsonResponse(
    result.data,
    result.status
  );
}


async function handleStatus(env) {
  const baseUrl =
    getBackendUrl(env);

  try {
    const response =
      await fetch(
        `${baseUrl}/sr/current`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    return jsonResponse(
      {
        success: response.ok,
        backendStatus:
          response.status,
        backend:
          baseUrl,
      },
      response.ok ? 200 : 502
    );

  } catch (error) {
    return jsonResponse(
      {
        success: false,
        backend:
          baseUrl,
        error:
          "bakurequest_backend_unavailable",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      502
    );
  }
}


function songRequestMessage(
  result,
  requestedSong
) {
  const data =
    result.data || {};

  if (
    result.ok &&
    data.success
  ) {
    if (
      data.pending === true ||
      data.accepted === true
    ) {
      const title =
        String(
          data.song?.title ||
          requestedSong ||
          data.songId ||
          ""
        ).trim();

      if (title) {
        return (
          `Dodano utwór: ${title}`
        );
      }

      return "Dodano utwór.";
    }

    const title =
      data.song?.title ||
      String(
        requestedSong ||
        data.songId ||
        "utwór"
      ).trim();

    return (
      `Dodano do kolejki: ${title}`
    );
  }

  switch (data.error) {
    case "missing_song_id":
      return (
        "Podaj link lub ID utworu."
      );

    case "song_not_found":
      return (
        "Nie znaleziono utworu."
      );

    case "song_banned":
      return (
        "Ten utwór jest zablokowany."
      );

    case "user_banned":
      return (
        "Nie możesz dodawać utworów."
      );

    case "user_timed_out":
      return (
        "Masz timeout na Song Request."
      );

    case "song_too_long":
      return (
        "Ten utwór jest za długi."
      );

    case "song_duration_unknown":
      return (
        "Nie udało się odczytać długości utworu."
      );

    case "user_song_limit_reached":
      return (
        "Masz już maksymalną liczbę utworów w kolejce."
      );

    default:
      return (
        "Nie udało się dodać utworu."
      );
  }
}


function wrongSongMessage(result) {
  const data =
    result.data || {};

  if (
    result.ok &&
    data.success
  ) {
    const title =
      data.removedSong?.title ||
      "utwór";

    return (
      `Usunięto z kolejki: ${title}`
    );
  }

  switch (data.error) {
    case "no_user_song_in_queue":
      return (
        "Nie masz utworu do usunięcia z kolejki."
      );

    default:
      return (
        "Nie udało się usunąć utworu."
      );
  }
}


function voteSkipMessage(
  result,
  user
) {
  const data =
    result.data || {};

  if (
    result.ok &&
    data.success
  ) {
    let voteCount = null;

    if (Array.isArray(data.votes)) {
      voteCount =
        data.votes.length;
    } else if (
      Number.isFinite(
        Number(data.voteCount)
      )
    ) {
      voteCount =
        Number(data.voteCount);
    } else if (
      Number.isFinite(
        Number(data.votes)
      )
    ) {
      voteCount =
        Number(data.votes);
    }

    const threshold =
      Number.isFinite(
        Number(data.threshold)
      )
        ? Number(data.threshold)
        : null;

    const nick =
      String(
        user || ""
      ).trim();

    if (
      nick &&
      voteCount !== null &&
      threshold !== null
    ) {
      return (
        `VoteSkip ${nick} ${voteCount}/${threshold}`
      );
    }

    if (
      voteCount !== null &&
      threshold !== null
    ) {
      return (
        `VoteSkip ${voteCount}/${threshold}`
      );
    }

    return "Głos na skip zapisany.";
  }

  switch (data.error) {
    case "user_banned":
      return (
        "Nie możesz głosować."
      );

    case "user_timed_out":
      return (
        "Masz timeout na Song Request."
      );

    default:
      return (
        "Nie udało się oddać głosu."
      );
  }
}


function playMessage(result) {
  const data =
    result.data || {};

  if (
    result.ok &&
    data.success
  ) {
    return "Odtwarzanie wznowione.";
  }

  if (
    data.error === "no_current_song" ||
    data.error === "nothing_playing"
  ) {
    return "Brak utworu do odtworzenia.";
  }

  return "Nie udało się wznowić odtwarzania.";
}


function pauseMessage(result) {
  const data =
    result.data || {};

  if (
    result.ok &&
    data.success
  ) {
    return "Odtwarzanie wstrzymane.";
  }

  if (
    data.error === "no_current_song" ||
    data.error === "nothing_playing"
  ) {
    return "Brak utworu do wstrzymania.";
  }

  return "Nie udało się wstrzymać odtwarzania.";
}


function skipMessage(result) {
  const data =
    result.data || {};

  if (
    result.ok &&
    data.success
  ) {
    return "Pominięto utwór.";
  }

  if (
    data.error === "no_current_song" ||
    data.error === "nothing_playing"
  ) {
    return "Brak utworu do pominięcia.";
  }

  return "Nie udało się pominąć utworu.";
}


function formatTime(seconds) {
  const value =
    Number(seconds);

  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  const total =
    Math.floor(value);

  const minutes =
    Math.floor(total / 60);

  const remainingSeconds =
    total % 60;

  return (
    `${minutes}:` +
    `${String(remainingSeconds).padStart(2, "0")}`
  );
}


function currentSongMessage(result) {
  const data =
    result.data || {};

  if (!result.ok) {
    return (
      "Nie udało się sprawdzić aktualnego utworu."
    );
  }

  const song =
    data.song ||
    data.currentSong ||
    data.current ||
    null;

  if (!song) {
    return "Aktualnie nic nie gra.";
  }

  const title =
    String(
      song.title ||
      song.name ||
      "Nieznany utwór"
    ).trim();

  const addedBy =
    String(
      song.addedBy ||
      song.added_by ||
      song.requestedBy ||
      song.requested_by ||
      ""
    ).trim();

  const position =
    formatTime(
      data.position ??
      data.currentTime ??
      data.elapsed
    );

  const duration =
    formatTime(
      data.duration ??
      song.duration
    );

  let message =
    `Aktualny utwór: ${title}`;

  if (addedBy) {
    message +=
      ` | dodał: ${addedBy}`;
  }

  if (
    position !== null &&
    duration !== null
  ) {
    message +=
      ` | ${position} / ${duration}`;
  }

  if (
    data.paused === true ||
    data.playing === false
  ) {
    message += " | pauza";
  }

  return message;
}


export async function handle(
  request,
  env,
  ctx
) {
  const url =
    new URL(request.url);

  const path =
    url.pathname;

  const method =
    request.method.toUpperCase();


  // =========================
  // STATUS
  // =========================

  if (
    method === "GET" &&
    path === "/bakurequest/status"
  ) {
    return handleStatus(env);
  }


  // =========================
  // CURRENT SONG — API
  // =========================

  if (
    method === "GET" &&
    path === "/bakurequest/current"
  ) {
    return callBakuRequest(
      env,
      "/sr/current",
      {
        method: "GET",
      }
    );
  }


  // =========================
  // QUEUE — API
  // =========================

  if (
    method === "GET" &&
    path === "/bakurequest/queue"
  ) {
    return callBakuRequest(
      env,
      "/sr/queue",
      {
        method: "GET",
      }
    );
  }


  // =========================
  // SONG REQUEST — API
  // =========================

  if (
    method === "POST" &&
    path === "/bakurequest/request"
  ) {
    const authError =
      requireCallerSecret(
        request,
        env
      );

    if (authError) {
      return authError;
    }

    const data =
      await readJson(request);

    const songId =
      String(
        data.songId || ""
      ).trim();

    const addedBy =
      String(
        data.addedBy || ""
      ).trim();

    if (!songId) {
      return jsonResponse(
        {
          success: false,
          error:
            "missing_song_id",
        },
        400
      );
    }

    if (!addedBy) {
      return jsonResponse(
        {
          success: false,
          error:
            "missing_added_by",
        },
        400
      );
    }

    return callBakuRequest(
      env,
      "/sr/request",
      {
        method: "POST",
        body: JSON.stringify({
          songId,
          addedBy,
        }),
      }
    );
  }


  // =========================
  // WRONG SONG — API
  // =========================

  if (
    method === "POST" &&
    path ===
      "/bakurequest/wrong-song"
  ) {
    const authError =
      requireCallerSecret(
        request,
        env
      );

    if (authError) {
      return authError;
    }

    const data =
      await readJson(request);

    const userId =
      String(
        data.userId || ""
      ).trim();

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          error:
            "missing_user_id",
        },
        400
      );
    }

    return callBakuRequest(
      env,
      "/sr/wrong-song",
      {
        method: "POST",
        body: JSON.stringify({
          userId,
        }),
      }
    );
  }


  // =========================
  // PLAY — API
  // =========================

  if (
    method === "POST" &&
    path === "/bakurequest/play"
  ) {
    const authError =
      requireCallerSecret(
        request,
        env
      );

    if (authError) {
      return authError;
    }

    return callBakuRequest(
      env,
      "/bot/sr/play",
      {
        method: "POST",
      }
    );
  }


  // =========================
  // PAUSE — API
  // =========================

  if (
    method === "POST" &&
    path === "/bakurequest/pause"
  ) {
    const authError =
      requireCallerSecret(
        request,
        env
      );

    if (authError) {
      return authError;
    }

    return callBakuRequest(
      env,
      "/bot/sr/pause",
      {
        method: "POST",
      }
    );
  }


  // =========================
  // SKIP — API
  // =========================

  if (
    method === "POST" &&
    path === "/bakurequest/skip"
  ) {
    const authError =
      requireCallerSecret(
        request,
        env
      );

    if (authError) {
      return authError;
    }

    return callBakuRequest(
      env,
      "/bot/sr/skip",
      {
        method: "POST",
      }
    );
  }


  // =========================
  // VOTESKIP — API STATUS
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/voteskip"
  ) {
    return callBakuRequest(
      env,
      "/sr/voteskip",
      {
        method: "GET",
      }
    );
  }


  // =========================
  // VOTESKIP — API VOTE
  // =========================

  if (
    method === "POST" &&
    path ===
      "/bakurequest/voteskip"
  ) {
    const authError =
      requireCallerSecret(
        request,
        env
      );

    if (authError) {
      return authError;
    }

    const data =
      await readJson(request);

    const userId =
      String(
        data.userId || ""
      ).trim();

    if (!userId) {
      return jsonResponse(
        {
          success: false,
          error:
            "missing_user_id",
        },
        400
      );
    }

    return callBakuRequest(
      env,
      "/sr/voteskip",
      {
        method: "POST",
        body: JSON.stringify({
          userId,
        }),
      }
    );
  }


  // =========================
  // STREAMELEMENTS — !SR
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/request"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const songId =
      String(
        url.searchParams.get(
          "song"
        ) || ""
      ).trim();

    const user =
      String(
        url.searchParams.get(
          "user"
        ) || ""
      ).trim();

    if (
      !songId ||
      !user
    ) {
      return textResponse(
        "Użycie: !sr <link lub tytuł>",
        400
      );
    }

    const result =
      await fetchBakuRequest(
        env,
        "/sr/request",
        {
          method: "POST",
          body: JSON.stringify({
            songId,
            addedBy: user,
          }),
        }
      );

    return textResponse(
      songRequestMessage(
        result,
        songId
      ),
      200
    );
  }


  // =========================
  // STREAMELEMENTS — !WS
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/wrong-song"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const user =
      String(
        url.searchParams.get(
          "user"
        ) || ""
      ).trim();

    if (!user) {
      return textResponse(
        "Brak użytkownika.",
        400
      );
    }

    const result =
      await fetchBakuRequest(
        env,
        "/sr/wrong-song",
        {
          method: "POST",
          body: JSON.stringify({
            userId: user,
          }),
        }
      );

    return textResponse(
      wrongSongMessage(
        result
      ),
      200
    );
  }


  // =========================
  // STREAMELEMENTS — !PLAY
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/play"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const result =
      await fetchBakuRequest(
        env,
        "/bot/sr/play",
        {
          method: "POST",
        }
      );

    return textResponse(
      playMessage(result),
      200
    );
  }


  // =========================
  // STREAMELEMENTS — !PAUSE
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/pause"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const result =
      await fetchBakuRequest(
        env,
        "/bot/sr/pause",
        {
          method: "POST",
        }
      );

    return textResponse(
      pauseMessage(result),
      200
    );
  }


  // =========================
  // STREAMELEMENTS — !SKIP
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/skip"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const result =
      await fetchBakuRequest(
        env,
        "/bot/sr/skip",
        {
          method: "POST",
        }
      );

    return textResponse(
      skipMessage(result),
      200
    );
  }


  // =========================
  // STREAMELEMENTS — !SONG
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/song"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const result =
      await fetchBakuRequest(
        env,
        "/sr/current",
        {
          method: "GET",
        }
      );

    return textResponse(
      currentSongMessage(result),
      200
    );
  }


  // =========================
  // STREAMELEMENTS — !VOTESKIP
  // =========================

  if (
    method === "GET" &&
    path ===
      "/bakurequest/se/voteskip"
  ) {
    const authError =
      requireStreamElementsSecret(
        url,
        env
      );

    if (authError) {
      return authError;
    }

    const user =
      String(
        url.searchParams.get(
          "user"
        ) || ""
      ).trim();

    if (!user) {
      return textResponse(
        "Brak użytkownika.",
        400
      );
    }

    const result =
      await fetchBakuRequest(
        env,
        "/sr/voteskip",
        {
          method: "POST",
          body: JSON.stringify({
            userId: user,
          }),
        }
      );

    return textResponse(
      voteSkipMessage(
        result,
        user
      ),
      200
    );
  }


  return null;
}
