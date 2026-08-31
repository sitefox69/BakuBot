import * as ttv from "./ttv.js";
import * as steam from "./steam.js";

const modules = [
  ttv,
  steam,
];

export async function handleModules(request, env) {
  for (const module of modules) {
    if (typeof module.handle === "function") {
      const response = await module.handle(request, env);

      if (response) {
        return response;
      }
    }
  }

  return null;
}

export async function handleDiscordModules(data, env) {
  for (const module of modules) {
    if (typeof module.handleDiscord === "function") {
      const response = await module.handleDiscord(data, env);

      if (response) {
        return response;
      }
    }
  }

  return null;
}
