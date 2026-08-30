import type { StepClaim } from './queue';

export type StepHandler = (
	claim: StepClaim,
	signal: AbortSignal
) => Promise<Readonly<Record<string, unknown>>>;

export class StepHandlerRegistry {
	readonly #handlers = new Map<string, StepHandler>();

	register(name: string, handler: StepHandler): void {
		if (this.#handlers.has(name)) throw new Error(`Duplicate step handler: ${name}`);
		this.#handlers.set(name, handler);
	}

	get(name: string): StepHandler {
		const handler = this.#handlers.get(name);
		if (!handler) throw new Error(`No handler registered for step: ${name}`);
		return handler;
	}
}

export function phaseTwoHandlers(): StepHandlerRegistry {
	const registry = new StepHandlerRegistry();
	registry.register('provider-contract-check', async (claim, signal) => {
		if (signal.aborted) throw signal.reason;
		return { verifiedAt: new Date().toISOString(), stepId: claim.stepId };
	});
	return registry;
}
