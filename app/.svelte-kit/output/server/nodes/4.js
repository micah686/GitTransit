

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/demo/playwright/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/4.DMf6gmxO.js","_app/immutable/chunks/CbTY1Hzl.js","_app/immutable/chunks/xihTtKlq.js"];
export const stylesheets = [];
export const fonts = [];
