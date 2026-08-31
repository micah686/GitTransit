import * as server from '../entries/pages/(app)/_page.server.ts.js';

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/(app)/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/(app)/+page.server.ts";
export const imports = ["_app/immutable/nodes/4.B5hx-ui6.js","_app/immutable/chunks/Clyg6UNk.js","_app/immutable/chunks/DZFblBEB.js","_app/immutable/chunks/xihTtKlq.js"];
export const stylesheets = [];
export const fonts = [];
