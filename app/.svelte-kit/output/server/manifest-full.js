export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.AiY6VNUE.js",app:"_app/immutable/entry/app.DsWsmdDi.js",imports:["_app/immutable/entry/start.AiY6VNUE.js","_app/immutable/chunks/Dca1uf2f.js","_app/immutable/chunks/Clyg6UNk.js","_app/immutable/entry/app.DsWsmdDi.js","_app/immutable/chunks/Clyg6UNk.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js')),
			__memo(() => import('./nodes/17.js')),
			__memo(() => import('./nodes/18.js')),
			__memo(() => import('./nodes/19.js')),
			__memo(() => import('./nodes/20.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/(app)",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/api/v1/approvals/[id]",
				pattern: /^\/api\/v1\/approvals\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/approvals/_id_/_server.ts.js'))
			},
			{
				id: "/api/v1/conflicts/[id]/resolve",
				pattern: /^\/api\/v1\/conflicts\/([^/]+?)\/resolve\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/conflicts/_id_/resolve/_server.ts.js'))
			},
			{
				id: "/api/v1/events",
				pattern: /^\/api\/v1\/events\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/events/_server.ts.js'))
			},
			{
				id: "/api/v1/health",
				pattern: /^\/api\/v1\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/health/_server.ts.js'))
			},
			{
				id: "/api/v1/maintenance/cleanup",
				pattern: /^\/api\/v1\/maintenance\/cleanup\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/maintenance/cleanup/_server.ts.js'))
			},
			{
				id: "/api/v1/metrics",
				pattern: /^\/api\/v1\/metrics\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/metrics/_server.ts.js'))
			},
			{
				id: "/api/v1/ready",
				pattern: /^\/api\/v1\/ready\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/v1/ready/_server.ts.js'))
			},
			{
				id: "/(app)/approvals",
				pattern: /^\/approvals\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/(app)/conflicts",
				pattern: /^\/conflicts\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/(app)/conflicts/[id]",
				pattern: /^\/conflicts\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/(app)/connections",
				pattern: /^\/connections\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/(app)/connections/new",
				pattern: /^\/connections\/new\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/(app)/connections/[id]",
				pattern: /^\/connections\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/health",
				pattern: /^\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/health/_server.ts.js'))
			},
			{
				id: "/(public)/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 19 },
				endpoint: null
			},
			{
				id: "/logout",
				pattern: /^\/logout\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/logout/_server.ts.js'))
			},
			{
				id: "/(app)/pairs",
				pattern: /^\/pairs\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/(app)/pairs/new",
				pattern: /^\/pairs\/new\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/(app)/pairs/[id]",
				pattern: /^\/pairs\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/ready",
				pattern: /^\/ready\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/ready/_server.ts.js'))
			},
			{
				id: "/(app)/repositories",
				pattern: /^\/repositories\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/(app)/repositories/[id]",
				pattern: /^\/repositories\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 15 },
				endpoint: null
			},
			{
				id: "/(app)/runs",
				pattern: /^\/runs\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 16 },
				endpoint: null
			},
			{
				id: "/(app)/runs/[id]",
				pattern: /^\/runs\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 17 },
				endpoint: null
			},
			{
				id: "/(app)/settings/maintenance",
				pattern: /^\/settings\/maintenance\/?$/,
				params: [],
				page: { layouts: [0,2,], errors: [1,,], leaf: 18 },
				endpoint: null
			},
			{
				id: "/(public)/setup",
				pattern: /^\/setup\/?$/,
				params: [],
				page: { layouts: [0,3,], errors: [1,,], leaf: 20 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
