export type NotificationKind = 'ntfy' | 'apprise' | 'gotify' | 'webhook';

export interface NotificationEvent {
	readonly id: string;
	readonly type: string;
	readonly resourceIds: readonly string[];
	readonly payload: Readonly<Record<string, unknown>>;
	readonly createdAt: number;
}

export interface NotificationConfig {
	readonly token?: string;
	readonly secret?: string;
	readonly allowInsecureHttp?: boolean;
	readonly allowPrivateNetwork?: boolean;
}

export interface NotificationTarget {
	readonly kind: NotificationKind;
	readonly url: URL;
	readonly config: NotificationConfig;
}

export interface NotificationAdapter {
	deliver(target: NotificationTarget, event: NotificationEvent, signal: AbortSignal): Promise<void>;
}

export class NotificationDeliveryError extends Error {
	constructor(
		readonly retryable: boolean,
		readonly retryAt: number | null,
		readonly code: string
	) {
		super(`Notification delivery failed: ${code}.`);
		this.name = 'NotificationDeliveryError';
	}
}
