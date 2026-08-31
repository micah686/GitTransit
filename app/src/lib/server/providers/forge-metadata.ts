import { createHash } from 'node:crypto';
import type { MetadataComponent } from '../domain/types';
import type {
	MetadataLossReport,
	NormalizedMetadataRecord,
	RateLimitObservation
} from '../domain/metadata-contracts';
import { ProviderHttpClient, nextPageFromLink, pageCursor } from './http';
import type { AdapterContext, MetadataAdapter } from './types';

export type ForgeMetadataDialect = 'github' | 'gitlab' | 'gitea' | 'bitbucket-cloud';

interface ForgeMetadataOptions {
	readonly provider: string;
	readonly dialect: ForgeMetadataDialect;
	readonly components: readonly MetadataComponent[];
	readonly api: (context: AdapterContext) => URL;
	readonly tokenScheme: string;
	readonly fetcher: typeof fetch;
}

function stable(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
	if (value && typeof value === 'object')
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
			.join(',')}}`;
	return JSON.stringify(value) ?? 'null';
}

function numberHeader(headers: Headers, ...names: string[]): number | null {
	for (const name of names) {
		const value = headers.get(name);
		if (value && /^\d+$/u.test(value)) return Number(value);
	}
	return null;
}

function rate(headers: Headers, category: string): RateLimitObservation {
	const reset = numberHeader(headers, 'x-ratelimit-reset', 'ratelimit-reset');
	return {
		category,
		limit: numberHeader(headers, 'x-ratelimit-limit', 'ratelimit-limit'),
		remaining: numberHeader(headers, 'x-ratelimit-remaining', 'ratelimit-remaining'),
		resetAt: reset === null ? null : reset * 1000,
		retryAt: null,
		status: 'observed'
	};
}

function stringValue(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function nested(raw: Record<string, unknown>, path: readonly string[]): unknown {
	let value: unknown = raw;
	for (const key of path) {
		if (!value || typeof value !== 'object') return undefined;
		value = (value as Record<string, unknown>)[key];
	}
	return value;
}

function externalId(raw: Record<string, unknown>): string {
	return stringValue(raw.id ?? raw.number ?? raw.iid ?? raw.name ?? raw.tag_name ?? raw.title);
}

function targetIdentity(
	dialect: ForgeMetadataDialect,
	component: MetadataComponent,
	raw: Record<string, unknown>
): string {
	if (component === 'labels') return stringValue(raw.name ?? raw.id);
	if (component === 'milestones' || component === 'issues' || component === 'change-requests')
		return stringValue(raw.number ?? raw.iid ?? raw.id);
	if (component === 'releases' && dialect === 'gitlab') return stringValue(raw.tag_name ?? raw.id);
	return externalId(raw);
}

function sourceUrl(raw: Record<string, unknown>, fallback: URL): URL {
	const value =
		raw.html_url ?? raw.web_url ?? nested(raw, ['links', 'html', 'href']) ?? raw.url ?? fallback;
	try {
		return new URL(String(value), fallback);
	} catch {
		return fallback;
	}
}

function normalize(
	options: ForgeMetadataOptions,
	context: AdapterContext,
	repository: string,
	component: MetadataComponent,
	raw: Record<string, unknown>,
	fallback: URL
): NormalizedMetadataRecord {
	const id = externalId(raw);
	const author = raw.user ?? raw.author ?? raw.actor;
	const authorRecord =
		author && typeof author === 'object' ? (author as Record<string, unknown>) : {};
	const title = stringValue(raw.title ?? raw.name ?? raw.tag_name ?? raw.topic, id);
	const body = raw.body ?? raw.description ?? raw.content ?? raw.message;
	const created = stringValue(
		raw.created_at ?? raw.created_on ?? raw.createdAt,
		new Date(0).toISOString()
	);
	const updated = stringValue(raw.updated_at ?? raw.updated_on ?? raw.updatedAt, created);
	const fields: Record<string, unknown> = {
		labels: raw.labels ?? [],
		milestone: raw.milestone ?? null,
		comments: raw.comments ?? raw.notes ?? [],
		assets: raw.assets ?? nested(raw, ['links', 'downloads']) ?? [],
		tag: raw.tag_name ?? raw.tag ?? null,
		dueAt: raw.due_on ?? raw.due_date ?? null,
		confidential: raw.confidential ?? false,
		draft: raw.draft ?? false,
		mergedAt: raw.merged_at ?? null,
		raw
	};
	return {
		identity: {
			provider: options.provider,
			connectionId: context.connectionId,
			repositoryId: repository,
			component,
			externalId: id
		},
		kind: component,
		title,
		body: body === null || body === undefined ? null : String(body),
		state: stringValue(raw.state ?? raw.status, 'open'),
		sourceUrl: sourceUrl(raw, fallback),
		sourceAuthorDisplay: stringValue(
			authorRecord.name ?? authorRecord.display_name ?? authorRecord.login ?? authorRecord.username,
			'Unknown author'
		),
		sourceCreatedAt: created,
		sourceUpdatedAt: updated,
		fields,
		contentDigest: createHash('sha256')
			.update(stable({ component, title, body, state: raw.state, fields }))
			.digest('hex')
	};
}

function repositoryBase(
	options: ForgeMetadataOptions,
	context: AdapterContext,
	repository: string
): URL {
	const api = options.api(context);
	if (options.dialect === 'gitlab')
		return new URL(`projects/${encodeURIComponent(repository)}/`, api);
	if (options.dialect === 'bitbucket-cloud') return new URL(`repositories/${repository}/`, api);
	return new URL(`repos/${repository}/`, api);
}

function collection(dialect: ForgeMetadataDialect, component: MetadataComponent): string {
	if (component === 'topics' && dialect === 'gitlab') return '';
	if (component === 'change-requests')
		return dialect === 'gitlab'
			? 'merge_requests'
			: dialect === 'bitbucket-cloud'
				? 'pullrequests'
				: 'pulls';
	if (component === 'milestones' && dialect === 'gitlab') return 'milestones';
	return component;
}

function requestBody(
	record: NormalizedMetadataRecord,
	provenance: string
): Record<string, unknown> {
	const marker = `\n\n<!-- ${provenance} -->`;
	const comments = Array.isArray(record.fields.comments)
		? record.fields.comments
				.map((value) => {
					const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
					const author = item.user ?? item.author;
					const who =
						author && typeof author === 'object'
							? stringValue(
									(author as Record<string, unknown>).login ??
										(author as Record<string, unknown>).username ??
										(author as Record<string, unknown>).display_name,
									'Unknown author'
								)
							: 'Unknown author';
					return `> **${who}** · ${stringValue(item.created_at ?? item.created_on)}\n>\n> ${stringValue(item.body ?? item.content).replace(/\n/gu, '\n> ')}`;
				})
				.join('\n\n')
		: '';
	const assets = Array.isArray(record.fields.assets)
		? record.fields.assets
				.map((value) => {
					const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
					const url =
						item.browser_download_url ?? item.url ?? nested(item, ['links', 'self', 'href']);
					return url ? `- [${stringValue(item.name, 'asset')}](${String(url)})` : '';
				})
				.filter(Boolean)
				.join('\n')
		: '';
	const archive = [
		comments ? `\n\n---\nImported comments\n\n${comments}` : '',
		assets ? `\n\n---\nImported release assets\n\n${assets}` : ''
	].join('');
	const body = `${record.body ?? ''}${archive}${marker}`;
	return {
		title: record.title,
		name: record.title,
		body,
		description: body,
		state: record.state,
		state_event: record.state === 'closed' ? 'close' : 'reopen',
		tag_name: record.fields.tag,
		due_on: record.fields.dueAt
	};
}

export class ForgeMetadataAdapter implements MetadataAdapter {
	readonly supportedComponents: ReadonlySet<string>;
	constructor(private readonly options: ForgeMetadataOptions) {
		this.supportedComponents = new Set(options.components);
	}

	#client(context: AdapterContext) {
		return new ProviderHttpClient(context, this.options.tokenScheme, this.options.fetcher);
	}

	previewLoss(component: MetadataComponent, record: NormalizedMetadataRecord): MetadataLossReport {
		const unsupportedFields: string[] = [];
		const lossyFields: string[] = [];
		if (record.fields.confidential === true && this.options.dialect !== 'gitlab')
			unsupportedFields.push('confidential');
		if (component === 'change-requests')
			lossyFields.push('review state', 'approvals', 'inline review threads');
		if (
			(component === 'issues' || component === 'change-requests') &&
			Array.isArray(record.fields.comments) &&
			record.fields.comments.length
		)
			lossyFields.push('native comment threading');
		if (
			component === 'releases' &&
			Array.isArray(record.fields.assets) &&
			record.fields.assets.length
		)
			lossyFields.push('asset download metadata');
		return { unsupportedFields, lossyFields, warnings: [] };
	}

	async list(
		context: AdapterContext,
		repository: string,
		component: MetadataComponent,
		cursor?: string
	) {
		const base = repositoryBase(this.options, context, repository);
		const page = pageCursor(cursor);
		const suffix = collection(this.options.dialect, component);
		const separator = suffix.includes('?') ? '&' : '?';
		const url = new URL(
			`${suffix}${separator}state=all&per_page=100&pagelen=100&page=${page}`,
			base
		);
		const response = await this.#client(context).json<unknown>(url);
		if (!response) throw new Error('Metadata response was empty.');
		let rawItems: unknown = response.value;
		if (component === 'topics' && !Array.isArray(rawItems)) {
			const values =
				(rawItems as Record<string, unknown>).names ??
				(rawItems as Record<string, unknown>).topics ??
				[];
			rawItems = Array.isArray(values)
				? [{ id: 'topics', title: 'Repository topics', topics: values }]
				: [];
		}
		if (!Array.isArray(rawItems)) rawItems = (rawItems as Record<string, unknown>).values ?? [];
		const sourceItems = (rawItems as unknown[])
			.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
			.filter((item) => component !== 'issues' || !(item.pull_request || item.merge_request));
		for (const item of sourceItems) {
			const id = stringValue(item.number ?? item.iid ?? item.id);
			if (id && (component === 'issues' || component === 'change-requests')) {
				const parent = collection(this.options.dialect, component);
				const commentsName = this.options.dialect === 'gitlab' ? 'notes' : 'comments';
				const comments = await this.#client(context).json<unknown[]>(
					new URL(
						`${parent}/${encodeURIComponent(id)}/${commentsName}?per_page=100&pagelen=100`,
						base
					),
					{ allowNotFound: true }
				);
				if (comments)
					item.comments = Array.isArray(comments.value)
						? comments.value
						: ((comments.value as unknown as Record<string, unknown>).values ?? []);
			}
			if (id && component === 'releases' && this.options.dialect !== 'gitlab') {
				const assets = await this.#client(context).json<unknown[]>(
					new URL(`releases/${encodeURIComponent(id)}/assets?per_page=100`, base),
					{ allowNotFound: true }
				);
				if (assets) item.assets = assets.value;
			}
		}
		const items = sourceItems.map((item) =>
			normalize(this.options, context, repository, component, item, base)
		);
		const next =
			nextPageFromLink(response.headers) ??
			(typeof nested(response.value as Record<string, unknown>, ['next']) === 'string'
				? String(nested(response.value as Record<string, unknown>, ['next']))
				: null);
		return {
			items,
			nextCursor: next ? String(page + 1) : null,
			rateLimit: rate(response.headers, `metadata:${component}`)
		};
	}

	async upsert(
		context: AdapterContext,
		repository: string,
		record: NormalizedMetadataRecord,
		provenance: string,
		targetExternalId: string | null
	) {
		const base = repositoryBase(this.options, context, repository);
		const targetComponent = record.kind === 'change-requests' ? 'issues' : record.kind;
		const suffix = collection(this.options.dialect, targetComponent);
		const url =
			record.kind === 'topics' && this.options.dialect === 'gitlab'
				? base
				: new URL(
						targetExternalId ? `${suffix}/${encodeURIComponent(targetExternalId)}` : suffix,
						base
					);
		const raw = record.fields.raw;
		const topics =
			raw && typeof raw === 'object' ? (raw as Record<string, unknown>).topics : undefined;
		const response = await this.#client(context).json<Record<string, unknown>>(url, {
			method:
				record.kind === 'topics'
					? 'PUT'
					: targetExternalId
						? this.options.dialect === 'gitlab' || this.options.dialect === 'bitbucket-cloud'
							? 'PUT'
							: 'PATCH'
						: 'POST',
			body:
				record.kind === 'topics'
					? this.options.dialect === 'gitlab'
						? { topics: Array.isArray(topics) ? topics : [] }
						: { names: Array.isArray(topics) ? topics : [] }
					: requestBody(record, provenance)
		});
		if (!response) throw new Error('Metadata write response was empty.');
		const id =
			record.kind === 'topics'
				? 'topics'
				: targetIdentity(this.options.dialect, record.kind, response.value) || targetExternalId;
		if (!id) throw new Error('Metadata target did not return a stable identity.');
		return {
			targetExternalId: id,
			targetUrl: sourceUrl(response.value, url),
			loss: this.previewLoss(record.kind, record),
			rateLimit: rate(response.headers, `metadata:${record.kind}`)
		};
	}
}
