function createTTVLink(streamer, user) {
  return `https://tv.supa.sh/logs?c=${encodeURIComponent(streamer)}&u=${encodeURIComponent(user)}`;
}

export async function handle(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/log") {
    const streamer = url.searchParams.get("stream")?.trim();
    const user = url.searchParams.get("user")?.trim();

    if (!streamer || !user) {
      return new Response("Podaj streamera i widza.", {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    return new Response(createTTVLink(streamer, user), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return null;
}

export async function handleDiscord(data, env) {

  if (data.type !== 2 || data.data?.name !== "log") {
    return null;
  }

  const streamer = data.data.options
    ?.find(option => option.name === "stream")
    ?.value
    ?.trim();

  const user = data.data.options
    ?.find(option => option.name === "user")
    ?.value
    ?.trim();

  if (!streamer || !user) {
    return Response.json({
      type: 4,
      data: {
        content: "Podaj streamera i widza.",
      },
    });
  }

  const link = createTTVLink(streamer, user);

  return Response.json({
    type: 4,
    data: {
      content: link,
    },
  });
}
