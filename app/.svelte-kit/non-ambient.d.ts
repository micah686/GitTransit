
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/(public)" | "/(app)" | "/" | "/api" | "/api/v1" | "/api/v1/approvals" | "/api/v1/approvals/[id]" | "/api/v1/events" | "/api/v1/health" | "/api/v1/maintenance" | "/api/v1/maintenance/cleanup" | "/api/v1/metrics" | "/api/v1/ready" | "/(app)/approvals" | "/(app)/conflicts" | "/(app)/connections" | "/(app)/connections/new" | "/(app)/connections/[id]" | "/demo" | "/demo/playwright" | "/health" | "/(public)/login" | "/logout" | "/(app)/pairs" | "/(app)/pairs/new" | "/(app)/pairs/[id]" | "/ready" | "/(app)/repositories" | "/(app)/repositories/[id]" | "/(app)/runs" | "/(app)/runs/[id]" | "/(app)/settings" | "/(app)/settings/authentication" | "/(app)/settings/general" | "/(app)/settings/maintenance" | "/(public)/setup";
		RouteParams(): {
			"/api/v1/approvals/[id]": { id: string };
			"/(app)/connections/[id]": { id: string };
			"/(app)/pairs/[id]": { id: string };
			"/(app)/repositories/[id]": { id: string };
			"/(app)/runs/[id]": { id: string }
		};
		LayoutParams(): {
			"/(public)": Record<string, never>;
			"/(app)": { id?: string | undefined };
			"/": { id?: string | undefined };
			"/api": { id?: string | undefined };
			"/api/v1": { id?: string | undefined };
			"/api/v1/approvals": { id?: string | undefined };
			"/api/v1/approvals/[id]": { id: string };
			"/api/v1/events": Record<string, never>;
			"/api/v1/health": Record<string, never>;
			"/api/v1/maintenance": Record<string, never>;
			"/api/v1/maintenance/cleanup": Record<string, never>;
			"/api/v1/metrics": Record<string, never>;
			"/api/v1/ready": Record<string, never>;
			"/(app)/approvals": Record<string, never>;
			"/(app)/conflicts": Record<string, never>;
			"/(app)/connections": { id?: string | undefined };
			"/(app)/connections/new": Record<string, never>;
			"/(app)/connections/[id]": { id: string };
			"/demo": Record<string, never>;
			"/demo/playwright": Record<string, never>;
			"/health": Record<string, never>;
			"/(public)/login": Record<string, never>;
			"/logout": Record<string, never>;
			"/(app)/pairs": { id?: string | undefined };
			"/(app)/pairs/new": Record<string, never>;
			"/(app)/pairs/[id]": { id: string };
			"/ready": Record<string, never>;
			"/(app)/repositories": { id?: string | undefined };
			"/(app)/repositories/[id]": { id: string };
			"/(app)/runs": { id?: string | undefined };
			"/(app)/runs/[id]": { id: string };
			"/(app)/settings": Record<string, never>;
			"/(app)/settings/authentication": Record<string, never>;
			"/(app)/settings/general": Record<string, never>;
			"/(app)/settings/maintenance": Record<string, never>;
			"/(public)/setup": Record<string, never>
		};
		Pathname(): "/" | `/api/v1/approvals/${string}` & {} | "/api/v1/events" | "/api/v1/health" | "/api/v1/maintenance/cleanup" | "/api/v1/metrics" | "/api/v1/ready" | "/approvals" | "/conflicts" | "/connections" | "/connections/new" | `/connections/${string}` & {} | "/health" | "/login" | "/logout" | "/pairs" | "/pairs/new" | `/pairs/${string}` & {} | "/ready" | "/repositories" | `/repositories/${string}` & {} | "/runs" | `/runs/${string}` & {} | "/settings/maintenance" | "/setup";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}