
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const XDG_SESSION_PATH: string;
	export const KDE_SESSION_UID: string;
	export const MANAGERPIDFDID: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const LC_TIME: string;
	export const NODE_PATH: string;
	export const XDG_SEAT_PATH: string;
	export const MAIL: string;
	export const FORCE_COLOR: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const DOCKER_HOST: string;
	export const OLLAMA_API_KEY: string;
	export const PATH: string;
	export const XDG_MENU_PREFIX: string;
	export const LOGNAME: string;
	export const XDG_CONFIG_DIRS: string;
	export const DOTNET_ROOT: string;
	export const WAYLAND_DISPLAY: string;
	export const XAUTHORITY: string;
	export const ROCM_PATH: string;
	export const LC_PAPER: string;
	export const LC_MEASUREMENT: string;
	export const XDG_SESSION_ID: string;
	export const OLLAMA_BASE_URL: string;
	export const npm_config_color: string;
	export const MOTD_SHOWN: string;
	export const XKB_DEFAULT_LAYOUT: string;
	export const XDG_SEAT: string;
	export const XDG_VTNR: string;
	export const MANPAGER: string;
	export const XDG_SESSION_DESKTOP: string;
	export const PNPM_HOME: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const LC_TELEPHONE: string;
	export const INVOCATION_ID: string;
	export const RUSTICL_ENABLE: string;
	export const LC_ADDRESS: string;
	export const ICEAUTHORITY: string;
	export const XDG_DATA_DIRS: string;
	export const SHELL: string;
	export const DEBUG_COLORS: string;
	export const XDG_SESSION_CLASS: string;
	export const SESSION_MANAGER: string;
	export const COLORTERM: string;
	export const LC_IDENTIFICATION: string;
	export const DISPLAY: string;
	export const HOME: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const DEBUGINFOD_URLS: string;
	export const KDE_SESSION_VERSION: string;
	export const LC_NUMERIC: string;
	export const LC_NAME: string;
	export const MOCHA_COLORS: string;
	export const GTK_RC_FILES: string;
	export const LANG: string;
	export const VIRTUAL_ENV_DISABLE_PROMPT: string;
	export const GTK2_RC_FILES: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const SYSTEMD_EXEC_PID: string;
	export const XDG_RUNTIME_DIR: string;
	export const PAM_KWALLET5_LOGIN: string;
	export const MANAGERPID: string;
	export const DESKTOP_SESSION: string;
	export const USER: string;
	export const XDG_SESSION_TYPE: string;
	export const KDE_FULL_SESSION: string;
	export const LC_MONETARY: string;
	export const PWD: string;
	export const MANROFFOPT: string;
	export const JOURNAL_STREAM: string;
	export const VSSCRIPT_PATH: string;
	export const NODE_ENV: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		XDG_SESSION_PATH: string;
		KDE_SESSION_UID: string;
		MANAGERPIDFDID: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		LC_TIME: string;
		NODE_PATH: string;
		XDG_SEAT_PATH: string;
		MAIL: string;
		FORCE_COLOR: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		DOCKER_HOST: string;
		OLLAMA_API_KEY: string;
		PATH: string;
		XDG_MENU_PREFIX: string;
		LOGNAME: string;
		XDG_CONFIG_DIRS: string;
		DOTNET_ROOT: string;
		WAYLAND_DISPLAY: string;
		XAUTHORITY: string;
		ROCM_PATH: string;
		LC_PAPER: string;
		LC_MEASUREMENT: string;
		XDG_SESSION_ID: string;
		OLLAMA_BASE_URL: string;
		npm_config_color: string;
		MOTD_SHOWN: string;
		XKB_DEFAULT_LAYOUT: string;
		XDG_SEAT: string;
		XDG_VTNR: string;
		MANPAGER: string;
		XDG_SESSION_DESKTOP: string;
		PNPM_HOME: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		LC_TELEPHONE: string;
		INVOCATION_ID: string;
		RUSTICL_ENABLE: string;
		LC_ADDRESS: string;
		ICEAUTHORITY: string;
		XDG_DATA_DIRS: string;
		SHELL: string;
		DEBUG_COLORS: string;
		XDG_SESSION_CLASS: string;
		SESSION_MANAGER: string;
		COLORTERM: string;
		LC_IDENTIFICATION: string;
		DISPLAY: string;
		HOME: string;
		MEMORY_PRESSURE_WATCH: string;
		XDG_CURRENT_DESKTOP: string;
		DEBUGINFOD_URLS: string;
		KDE_SESSION_VERSION: string;
		LC_NUMERIC: string;
		LC_NAME: string;
		MOCHA_COLORS: string;
		GTK_RC_FILES: string;
		LANG: string;
		VIRTUAL_ENV_DISABLE_PROMPT: string;
		GTK2_RC_FILES: string;
		QT_WAYLAND_RECONNECT: string;
		MEMORY_PRESSURE_WRITE: string;
		SYSTEMD_EXEC_PID: string;
		XDG_RUNTIME_DIR: string;
		PAM_KWALLET5_LOGIN: string;
		MANAGERPID: string;
		DESKTOP_SESSION: string;
		USER: string;
		XDG_SESSION_TYPE: string;
		KDE_FULL_SESSION: string;
		LC_MONETARY: string;
		PWD: string;
		MANROFFOPT: string;
		JOURNAL_STREAM: string;
		VSSCRIPT_PATH: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
