// in dev, this makes Vite inject its client as this module's first dependency,
// so that global constant replacements are installed before any other module
// (including user hooks) evaluates. In build it's inert.
import.meta.hot;




export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19')
];

export const server_loads = [0,2];

export const dictionary = {
		"/(app)": [~4,[2]],
		"/(app)/approvals": [~5,[2]],
		"/(app)/conflicts": [6,[2]],
		"/(app)/connections": [~7,[2]],
		"/(app)/connections/new": [9,[2]],
		"/(app)/connections/[id]": [~8,[2]],
		"/(public)/login": [~18,[3]],
		"/(app)/pairs": [~10,[2]],
		"/(app)/pairs/new": [~12,[2]],
		"/(app)/pairs/[id]": [~11,[2]],
		"/(app)/repositories": [~13,[2]],
		"/(app)/repositories/[id]": [~14,[2]],
		"/(app)/runs": [~15,[2]],
		"/(app)/runs/[id]": [~16,[2]],
		"/(app)/settings/maintenance": [17,[2]],
		"/(public)/setup": [~19,[3]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';

export const get_error_template = () => import('../shared/error-template.js').then(m => m.default);