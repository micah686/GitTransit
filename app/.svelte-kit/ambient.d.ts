
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
	export const SVELTEKIT_FORK: string;
	export const KONSOLE_DBUS_WINDOW: string;
	export const XDG_SEAT: string;
	export const KONSOLE_DBUS_SERVICE: string;
	export const GITTRANSIT_ENCRYPTION_KEY_FILE: string;
	export const _: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const LANG: string;
	export const MOTD_SHOWN: string;
	export const OLLAMA_BASE_URL: string;
	export const SYSTEMD_EXEC_PID: string;
	export const LC_PAPER: string;
	export const XDG_SESSION_DESKTOP: string;
	export const GTK2_RC_FILES: string;
	export const LC_TELEPHONE: string;
	export const EDITOR: string;
	export const GIT_PAGER: string;
	export const npm_config_globalconfig: string;
	export const XDG_MENU_PREFIX: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const LC_MEASUREMENT: string;
	export const GITTRANSIT_DATA_DIR: string;
	export const COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
	export const COLOR: string;
	export const PNPM_HOME: string;
	export const npm_config_engine_strict: string;
	export const npm_config_init_module: string;
	export const MAIL: string;
	export const GH_PAGER: string;
	export const CODEX_MANAGED_PACKAGE_ROOT: string;
	export const LC_NUMERIC: string;
	export const GTK_RC_FILES: string;
	export const XDG_CONFIG_DIRS: string;
	export const XKB_DEFAULT_LAYOUT: string;
	export const npm_config_cache: string;
	export const TERM: string;
	export const NODE: string;
	export const npm_command: string;
	export const XDG_SESSION_TYPE: string;
	export const npm_config_userconfig: string;
	export const KONSOLE_VERSION: string;
	export const LC_NAME: string;
	export const npm_lifecycle_event: string;
	export const COLORTERM: string;
	export const LC_TIME: string;
	export const ICEAUTHORITY: string;
	export const HOME: string;
	export const KDE_SESSION_UID: string;
	export const PATH: string;
	export const npm_package_name: string;
	export const npm_config_local_prefix: string;
	export const npm_config_global_prefix: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const LOGNAME: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const SHELL: string;
	export const npm_config_node_gyp: string;
	export const PLAYWRIGHT_TEST: string;
	export const COREPACK_ROOT: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const npm_package_engines_npm: string;
	export const CODEX_SANDBOX_NETWORK_DISABLED: string;
	export const SHELL_SESSION_ID: string;
	export const PAM_KWALLET5_LOGIN: string;
	export const DEBUG_COLORS: string;
	export const DESKTOP_SESSION: string;
	export const CODEX_PERMISSION_PROFILE: string;
	export const SESSION_MANAGER: string;
	export const WAYLAND_DISPLAY: string;
	export const RUSTICL_ENABLE: string;
	export const PROFILEHOME: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const VIRTUAL_ENV_DISABLE_PROMPT: string;
	export const USER: string;
	export const ROCM_PATH: string;
	export const FORCE_COLOR: string;
	export const MANROFFOPT: string;
	export const XDG_SEAT_PATH: string;
	export const npm_package_version: string;
	export const GITTRANSIT_BASE_URL: string;
	export const OLLAMA_API_KEY: string;
	export const MANAGERPID: string;
	export const NODE_ENV: string;
	export const CODEX_THREAD_ID: string;
	export const INIT_CWD: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_lifecycle_script: string;
	export const XAUTHORITY: string;
	export const npm_config_npm_version: string;
	export const XDG_SESSION_CLASS: string;
	export const KONSOLE_DBUS_SESSION: string;
	export const INVOCATION_ID: string;
	export const LC_IDENTIFICATION: string;
	export const LC_MONETARY: string;
	export const npm_config_prefix: string;
	export const COLORFGBG: string;
	export const KDE_SESSION_VERSION: string;
	export const MANPAGER: string;
	export const XDG_DATA_DIRS: string;
	export const DISPLAY: string;
	export const WINDOWID: string;
	export const CODEX_MANAGED_BY_PNPM: string;
	export const SHLVL: string;
	export const PAGER: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const DOTNET_ROOT: string;
	export const LANGUAGE: string;
	export const MANAGERPIDFDID: string;
	export const CODEX_CI: string;
	export const npm_config_user_agent: string;
	export const XDG_SESSION_PATH: string;
	export const VSSCRIPT_PATH: string;
	export const KONSOLE_DBUS_ACTIVATION_COOKIE: string;
	export const npm_execpath: string;
	export const FLATPAK_TTY_PROGRESS: string;
	export const LC_CTYPE: string;
	export const PWD: string;
	export const LC_ALL: string;
	export const npm_package_engines_node: string;
	export const KDE_FULL_SESSION: string;
	export const XDG_RUNTIME_DIR: string;
	export const LC_ADDRESS: string;
	export const NODE_PATH: string;
	export const CODEX_SESSION_ID: string;
	export const npm_package_json: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const DOCKER_HOST: string;
	export const JOURNAL_STREAM: string;
	export const BROWSER: string;
	export const npm_config_noproxy: string;
	export const npm_node_execpath: string;
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
		SVELTEKIT_FORK: string;
		KONSOLE_DBUS_WINDOW: string;
		XDG_SEAT: string;
		KONSOLE_DBUS_SERVICE: string;
		GITTRANSIT_ENCRYPTION_KEY_FILE: string;
		_: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		LANG: string;
		MOTD_SHOWN: string;
		OLLAMA_BASE_URL: string;
		SYSTEMD_EXEC_PID: string;
		LC_PAPER: string;
		XDG_SESSION_DESKTOP: string;
		GTK2_RC_FILES: string;
		LC_TELEPHONE: string;
		EDITOR: string;
		GIT_PAGER: string;
		npm_config_globalconfig: string;
		XDG_MENU_PREFIX: string;
		XDG_CURRENT_DESKTOP: string;
		LC_MEASUREMENT: string;
		GITTRANSIT_DATA_DIR: string;
		COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
		COLOR: string;
		PNPM_HOME: string;
		npm_config_engine_strict: string;
		npm_config_init_module: string;
		MAIL: string;
		GH_PAGER: string;
		CODEX_MANAGED_PACKAGE_ROOT: string;
		LC_NUMERIC: string;
		GTK_RC_FILES: string;
		XDG_CONFIG_DIRS: string;
		XKB_DEFAULT_LAYOUT: string;
		npm_config_cache: string;
		TERM: string;
		NODE: string;
		npm_command: string;
		XDG_SESSION_TYPE: string;
		npm_config_userconfig: string;
		KONSOLE_VERSION: string;
		LC_NAME: string;
		npm_lifecycle_event: string;
		COLORTERM: string;
		LC_TIME: string;
		ICEAUTHORITY: string;
		HOME: string;
		KDE_SESSION_UID: string;
		PATH: string;
		npm_package_name: string;
		npm_config_local_prefix: string;
		npm_config_global_prefix: string;
		MEMORY_PRESSURE_WRITE: string;
		LOGNAME: string;
		MEMORY_PRESSURE_WATCH: string;
		SHELL: string;
		npm_config_node_gyp: string;
		PLAYWRIGHT_TEST: string;
		COREPACK_ROOT: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		npm_package_engines_npm: string;
		CODEX_SANDBOX_NETWORK_DISABLED: string;
		SHELL_SESSION_ID: string;
		PAM_KWALLET5_LOGIN: string;
		DEBUG_COLORS: string;
		DESKTOP_SESSION: string;
		CODEX_PERMISSION_PROFILE: string;
		SESSION_MANAGER: string;
		WAYLAND_DISPLAY: string;
		RUSTICL_ENABLE: string;
		PROFILEHOME: string;
		QT_WAYLAND_RECONNECT: string;
		VIRTUAL_ENV_DISABLE_PROMPT: string;
		USER: string;
		ROCM_PATH: string;
		FORCE_COLOR: string;
		MANROFFOPT: string;
		XDG_SEAT_PATH: string;
		npm_package_version: string;
		GITTRANSIT_BASE_URL: string;
		OLLAMA_API_KEY: string;
		MANAGERPID: string;
		NODE_ENV: string;
		CODEX_THREAD_ID: string;
		INIT_CWD: string;
		DEBUGINFOD_URLS: string;
		npm_lifecycle_script: string;
		XAUTHORITY: string;
		npm_config_npm_version: string;
		XDG_SESSION_CLASS: string;
		KONSOLE_DBUS_SESSION: string;
		INVOCATION_ID: string;
		LC_IDENTIFICATION: string;
		LC_MONETARY: string;
		npm_config_prefix: string;
		COLORFGBG: string;
		KDE_SESSION_VERSION: string;
		MANPAGER: string;
		XDG_DATA_DIRS: string;
		DISPLAY: string;
		WINDOWID: string;
		CODEX_MANAGED_BY_PNPM: string;
		SHLVL: string;
		PAGER: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		DOTNET_ROOT: string;
		LANGUAGE: string;
		MANAGERPIDFDID: string;
		CODEX_CI: string;
		npm_config_user_agent: string;
		XDG_SESSION_PATH: string;
		VSSCRIPT_PATH: string;
		KONSOLE_DBUS_ACTIVATION_COOKIE: string;
		npm_execpath: string;
		FLATPAK_TTY_PROGRESS: string;
		LC_CTYPE: string;
		PWD: string;
		LC_ALL: string;
		npm_package_engines_node: string;
		KDE_FULL_SESSION: string;
		XDG_RUNTIME_DIR: string;
		LC_ADDRESS: string;
		NODE_PATH: string;
		CODEX_SESSION_ID: string;
		npm_package_json: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		DOCKER_HOST: string;
		JOURNAL_STREAM: string;
		BROWSER: string;
		npm_config_noproxy: string;
		npm_node_execpath: string;
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
