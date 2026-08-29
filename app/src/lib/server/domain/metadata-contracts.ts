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
	readonly title: string;
	readonly body: string | null;
	readonly state: string;
	readonly sourceUrl: URL;
	readonly sourceAuthorDisplay: string;
	readonly sourceCreatedAt: string;
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
