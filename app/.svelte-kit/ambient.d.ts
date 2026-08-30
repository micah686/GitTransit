
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
	export const NODE_ENV: string;
	export const KONSOLE_DBUS_WINDOW: string;
	export const LC_NUMERIC: string;
	export const npm_node_execpath: string;
	export const KDE_APPLICATIONS_AS_SCOPE: string;
	export const npm_config_noproxy: string;
	export const JOURNAL_STREAM: string;
	export const DOCKER_HOST: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const npm_package_json: string;
	export const NODE_PATH: string;
	export const XDG_RUNTIME_DIR: string;
	export const LC_ALL: string;
	export const LC_CTYPE: string;
	export const npm_execpath: string;
	export const npm_config_user_agent: string;
	export const CODEX_CI: string;
	export const MANAGERPIDFDID: string;
	export const XDG_SESSION_ID: string;
	export const XDG_VTNR: string;
	export const PAGER: string;
	export const SHLVL: string;
	export const DISPLAY: string;
	export const XDG_DATA_DIRS: string;
	export const MANPAGER: string;
	export const KDE_SESSION_VERSION: string;
	export const COLORFGBG: string;
	export const npm_config_prefix: string;
	export const KONSOLE_DBUS_ACTIVATION_COOKIE: string;
	export const LC_IDENTIFICATION: string;
	export const XDG_SESSION_CLASS: string;
	export const npm_config_npm_version: string;
	export const npm_lifecycle_script: string;
	export const DEBUGINFOD_URLS: string;
	export const INIT_CWD: string;
	export const CODEX_THREAD_ID: string;
	export const MANAGERPID: string;
	export const OLLAMA_API_KEY: string;
	export const XDG_SEAT_PATH: string;
	export const MANROFFOPT: string;
	export const KDE_FULL_SESSION: string;
	export const CODEX_PERMISSION_PROFILE: string;
	export const DESKTOP_SESSION: string;
	export const CODEX_MANAGED_BY_PNPM: string;
	export const PAM_KWALLET5_LOGIN: string;
	export const SHELL_SESSION_ID: string;
	export const CODEX_SANDBOX_NETWORK_DISABLED: string;
	export const NO_COLOR: string;
	export const INVOCATION_ID: string;
	export const npm_package_engines_npm: string;
	export const LC_ADDRESS: string;
	export const LANGUAGE: string;
	export const VSSCRIPT_PATH: string;
	export const npm_config_node_gyp: string;
	export const SHELL: string;
	export const npm_config_globalconfig: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const npm_config_global_prefix: string;
	export const DOTNET_ROOT: string;
	export const npm_config_local_prefix: string;
	export const XAUTHORITY: string;
	export const PATH: string;
	export const KDE_SESSION_UID: string;
	export const ICEAUTHORITY: string;
	export const COLORTERM: string;
	export const npm_lifecycle_event: string;
	export const LC_NAME: string;
	export const LOGNAME: string;
	export const npm_command: string;
	export const npm_package_engines_node: string;
	export const SESSION_MANAGER: string;
	export const NODE: string;
	export const TERM: string;
	export const XDG_CONFIG_DIRS: string;
	export const LC_TIME: string;
	export const RUSTICL_ENABLE: string;
	export const GTK_RC_FILES: string;
	export const CODEX_MANAGED_PACKAGE_ROOT: string;
	export const HOME: string;
	export const MAIL: string;
	export const LC_MONETARY: string;
	export const XDG_SESSION_PATH: string;
	export const npm_config_init_module: string;
	export const npm_config_engine_strict: string;
	export const npm_config_cache: string;
	export const PNPM_HOME: string;
	export const COLOR: string;
	export const COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
	export const GH_PAGER: string;
	export const LC_MEASUREMENT: string;
	export const npm_package_name: string;
	export const XKB_DEFAULT_LAYOUT: string;
	export const XDG_MENU_PREFIX: string;
	export const QT_WAYLAND_RECONNECT: string;
	export const PROFILEHOME: string;
	export const GIT_PAGER: string;
	export const EDITOR: string;
	export const PWD: string;
	export const GTK2_RC_FILES: string;
	export const XDG_SESSION_DESKTOP: string;
	export const XDG_SESSION_TYPE: string;
	export const LC_TELEPHONE: string;
	export const LC_PAPER: string;
	export const KONSOLE_VERSION: string;
	export const SYSTEMD_EXEC_PID: string;
	export const WINDOWID: string;
	export const OLLAMA_BASE_URL: string;
	export const FLATPAK_TTY_PROGRESS: string;
	export const MOTD_SHOWN: string;
	export const LANG: string;
	export const ROCM_PATH: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const _: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const USER: string;
	export const VIRTUAL_ENV_DISABLE_PROMPT: string;
	export const COREPACK_ROOT: string;
	export const KONSOLE_DBUS_SERVICE: string;
	export const XDG_SEAT: string;
	export const CODEX_SESSION_ID: string;
	export const npm_package_version: string;
	export const WAYLAND_DISPLAY: string;
	export const npm_config_userconfig: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const KONSOLE_DBUS_SESSION: string;
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
		NODE_ENV: string;
		KONSOLE_DBUS_WINDOW: string;
		LC_NUMERIC: string;
		npm_node_execpath: string;
		KDE_APPLICATIONS_AS_SCOPE: string;
		npm_config_noproxy: string;
		JOURNAL_STREAM: string;
		DOCKER_HOST: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		npm_package_json: string;
		NODE_PATH: string;
		XDG_RUNTIME_DIR: string;
		LC_ALL: string;
		LC_CTYPE: string;
		npm_execpath: string;
		npm_config_user_agent: string;
		CODEX_CI: string;
		MANAGERPIDFDID: string;
		XDG_SESSION_ID: string;
		XDG_VTNR: string;
		PAGER: string;
		SHLVL: string;
		DISPLAY: string;
		XDG_DATA_DIRS: string;
		MANPAGER: string;
		KDE_SESSION_VERSION: string;
		COLORFGBG: string;
		npm_config_prefix: string;
		KONSOLE_DBUS_ACTIVATION_COOKIE: string;
		LC_IDENTIFICATION: string;
		XDG_SESSION_CLASS: string;
		npm_config_npm_version: string;
		npm_lifecycle_script: string;
		DEBUGINFOD_URLS: string;
		INIT_CWD: string;
		CODEX_THREAD_ID: string;
		MANAGERPID: string;
		OLLAMA_API_KEY: string;
		XDG_SEAT_PATH: string;
		MANROFFOPT: string;
		KDE_FULL_SESSION: string;
		CODEX_PERMISSION_PROFILE: string;
		DESKTOP_SESSION: string;
		CODEX_MANAGED_BY_PNPM: string;
		PAM_KWALLET5_LOGIN: string;
		SHELL_SESSION_ID: string;
		CODEX_SANDBOX_NETWORK_DISABLED: string;
		NO_COLOR: string;
		INVOCATION_ID: string;
		npm_package_engines_npm: string;
		LC_ADDRESS: string;
		LANGUAGE: string;
		VSSCRIPT_PATH: string;
		npm_config_node_gyp: string;
		SHELL: string;
		npm_config_globalconfig: string;
		MEMORY_PRESSURE_WRITE: string;
		npm_config_global_prefix: string;
		DOTNET_ROOT: string;
		npm_config_local_prefix: string;
		XAUTHORITY: string;
		PATH: string;
		KDE_SESSION_UID: string;
		ICEAUTHORITY: string;
		COLORTERM: string;
		npm_lifecycle_event: string;
		LC_NAME: string;
		LOGNAME: string;
		npm_command: string;
		npm_package_engines_node: string;
		SESSION_MANAGER: string;
		NODE: string;
		TERM: string;
		XDG_CONFIG_DIRS: string;
		LC_TIME: string;
		RUSTICL_ENABLE: string;
		GTK_RC_FILES: string;
		CODEX_MANAGED_PACKAGE_ROOT: string;
		HOME: string;
		MAIL: string;
		LC_MONETARY: string;
		XDG_SESSION_PATH: string;
		npm_config_init_module: string;
		npm_config_engine_strict: string;
		npm_config_cache: string;
		PNPM_HOME: string;
		COLOR: string;
		COREPACK_ENABLE_DOWNLOAD_PROMPT: string;
		GH_PAGER: string;
		LC_MEASUREMENT: string;
		npm_package_name: string;
		XKB_DEFAULT_LAYOUT: string;
		XDG_MENU_PREFIX: string;
		QT_WAYLAND_RECONNECT: string;
		PROFILEHOME: string;
		GIT_PAGER: string;
		EDITOR: string;
		PWD: string;
		GTK2_RC_FILES: string;
		XDG_SESSION_DESKTOP: string;
		XDG_SESSION_TYPE: string;
		LC_TELEPHONE: string;
		LC_PAPER: string;
		KONSOLE_VERSION: string;
		SYSTEMD_EXEC_PID: string;
		WINDOWID: string;
		OLLAMA_BASE_URL: string;
		FLATPAK_TTY_PROGRESS: string;
		MOTD_SHOWN: string;
		LANG: string;
		ROCM_PATH: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		_: string;
		XDG_CURRENT_DESKTOP: string;
		USER: string;
		VIRTUAL_ENV_DISABLE_PROMPT: string;
		COREPACK_ROOT: string;
		KONSOLE_DBUS_SERVICE: string;
		XDG_SEAT: string;
		CODEX_SESSION_ID: string;
		npm_package_version: string;
		WAYLAND_DISPLAY: string;
		npm_config_userconfig: string;
		MEMORY_PRESSURE_WATCH: string;
		KONSOLE_DBUS_SESSION: string;
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
