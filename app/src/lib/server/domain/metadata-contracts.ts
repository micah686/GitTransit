import type { MetadataComponent } from './types';

export interface MetadataIdentity {
	readonly provider: string;
	readonly connectionId: string;
	readonly repositoryId: string;
	readonly component: MetadataComponent;
	readonly externalId: string;
}

export interface NormalizedMetadataRecord {
	readonly identity: MetadataIdentity;
	readonly kind: MetadataComponent;
	readonly title: string;
	readonly body: string | null;
	readonly state: string;
	readonly sourceUrl: URL;
	readonly sourceAuthorDisplay: string;
	readonly sourceCreatedAt: string;
	readonly sourceUpdatedAt: string;
	readonly fields: Readonly<Record<string, unknown>>;
	readonly contentDigest: string;
}

export interface MetadataLossReport {
	readonly unsupportedFields: readonly string[];
	readonly lossyFields: readonly string[];
	readonly warnings: readonly string[];
}

export interface MetadataWriteResult {
	readonly targetExternalId: string;
	readonly targetUrl: URL;
	readonly loss: MetadataLossReport;
}

export interface RateLimitObservation {
	readonly category: string;
	readonly limit: number | null;
	readonly remaining: number | null;
	readonly resetAt: number | null;
	readonly retryAt: number | null;
	readonly status: string;
}
