import type { SqliteDatabase } from '../persistence/database';
import type { MetadataComponent, MetadataMode } from '../domain/types';
import { metadataExecutionOrder } from '../domain/metadata-policy';
import type { AdapterContext, MetadataAdapter } from '../providers/types';
import { MetadataStore } from './store';

export interface MetadataSyncCheckpoint {
	readonly component?: MetadataComponent;
	readonly cursor?: string;
	readonly processed?: number;
}

export interface MetadataSyncRequest {
	readonly routeId: string;
	readonly sourceRepository: string;
	readonly targetRepository: string;
	readonly sourceConnectionId: string;
	readonly targetConnectionId: string;
	readonly sourceContext: AdapterContext;
	readonly targetContext: AdapterContext;
	readonly source: MetadataAdapter;
	readonly target: MetadataAdapter;
	readonly components: Readonly<Record<MetadataComponent, MetadataMode>>;
	readonly checkpoint: MetadataSyncCheckpoint;
	readonly saveCheckpoint: (checkpoint: MetadataSyncCheckpoint) => void;
	readonly releaseTagExists: (tag: string) => boolean;
}

export interface MetadataSyncResult {
	readonly processed: number;
	readonly written: number;
	readonly unchanged: number;
	readonly warnings: readonly string[];
}

export const metadataProvenance = (
	routeId: string,
	component: MetadataComponent,
	sourceId: string
) => `gittransit:${routeId}:${component}:${sourceId}`;

export class MetadataSyncService {
	readonly #store: MetadataStore;
	constructor(db: SqliteDatabase) {
		this.#store = new MetadataStore(db);
	}

	async execute(request: MetadataSyncRequest): Promise<MetadataSyncResult> {
		let processed = request.checkpoint.processed ?? 0;
		let written = 0;
		let unchanged = 0;
		const warnings: string[] = [];
		const start = request.checkpoint.component
			? metadataExecutionOrder.indexOf(request.checkpoint.component)
			: 0;
		for (let index = Math.max(0, start); index < metadataExecutionOrder.length; index += 1) {
			const component = metadataExecutionOrder[index];
			if (!component) continue;
			const mode = request.components[component];
			if (mode === 'off') continue;
			if (
				!request.source.supportedComponents.has(component) ||
				!request.target.supportedComponents.has(component)
			) {
				const message = `${component} is unsupported and was skipped.`;
				if (mode === 'required') throw new Error(message);
				warnings.push(message);
				continue;
			}
			if (!request.source.list || !request.target.upsert) {
				const message = `${component} is declared but its provider operation is unavailable.`;
				if (mode === 'required') throw new Error(message);
				warnings.push(message);
				continue;
			}
			let cursor =
				request.checkpoint.component === component ? request.checkpoint.cursor : undefined;
			do {
				try {
					const page = await request.source.list(
						request.sourceContext,
						request.sourceRepository,
						component,
						cursor
					);
					if (page.rateLimit) this.#store.recordRate(request.sourceConnectionId, page.rateLimit);
					for (const record of page.items) {
						processed += 1;
						if (component === 'releases') {
							const tag = record.fields.tag;
							if (typeof tag === 'string' && !request.releaseTagExists(tag))
								throw new Error(`Release ${record.title} is waiting for transferred tag ${tag}.`);
						}
						const mapping = this.#store.mapping(request.routeId, record);
						if (mapping?.digest === record.contentDigest) {
							unchanged += 1;
							continue;
						}
						const loss = request.target.previewLoss?.(component, record);
						if (loss) {
							warnings.push(...loss.warnings.map((warning) => `${component}: ${warning}`));
							if (loss.unsupportedFields.length)
								warnings.push(
									`${component}: unsupported fields ${loss.unsupportedFields.join(', ')}.`
								);
							if (loss.lossyFields.length)
								warnings.push(`${component}: lossy fields ${loss.lossyFields.join(', ')}.`);
						}
						const provenance = metadataProvenance(
							request.routeId,
							component,
							record.identity.externalId
						);
						const result = await request.target.upsert(
							request.targetContext,
							request.targetRepository,
							record,
							provenance,
							mapping?.targetIdentity ?? null
						);
						if (result.rateLimit)
							this.#store.recordRate(request.targetConnectionId, result.rateLimit);
						this.#store.record(request.routeId, record, provenance, result);
						written += 1;
					}
					cursor = page.nextCursor ?? undefined;
					request.saveCheckpoint({ component, ...(cursor ? { cursor } : {}), processed });
				} catch (error) {
					if (mode === 'required') throw error;
					warnings.push(`${component}: ${error instanceof Error ? error.message : 'sync failed'}`);
					cursor = undefined;
				}
			} while (cursor);
		}
		return { processed, written, unchanged, warnings: [...new Set(warnings)] };
	}
}
