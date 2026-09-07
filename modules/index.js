import * as ttv from "./ttv.js";
import * as steam from "./steam.js";
import * as xayo from "./xayo.js";
import * as plan from "./plan.js";
import * as bakurequest from "./bakurequest.js";


const modules = [
  ttv,
  steam,
  xayo,
  plan,
  bakurequest,
];


export async function handleModules(
  request,
  env,
  ctx
) {
  for (const module of modules) {
    if (
      typeof module.handle
      !== "function"
    ) {
      continue;
    }

    const response =
      await module.handle(
        request,
        env,
        ctx
      );

    if (response) {
      return response;
    }
  }

  return null;
}


export async function handleDiscordModules(
  request,
  env,
  ctx
) {
  for (const module of modules) {
    if (
      typeof module.handleDiscord
      !== "function"
    ) {
      continue;
    }

    const response =
      await module.handleDiscord(
        request,
        env,
        ctx
      );

    if (response) {
      return response;
    }
  }

  return null;
}
