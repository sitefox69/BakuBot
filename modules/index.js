import * as ttv from "./ttv.js";
import * as steam from "./steam.js";
import * as xayo from "./xayo.js";
import * as plan from "./plan.js";
const modules = [
  ttv,
  steam,
  xayo,
  plan,
];
/**
 * @param {Request} request
 * @param {any} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response|null>}
 */
export async function handleModules(
  request,
  env,
  ctx
) {
  for (const module of modules) {
    if (
      typeof module.handle ===
      "function"
    ) {
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
  }
  return null;
}
/**
 * @param {any} data
 * @param {any} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<Response|null>}
 */
export async function handleDiscordModules(
  data,
  env,
  ctx
) {
  for (const module of modules) {
    if (
      typeof module.handleDiscord ===
      "function"
    ) {
      const response =
        await module.handleDiscord(
          data,
          env,
          ctx
        );
      if (response) {
        return response;
      }
    }
  }
  return null;
}
