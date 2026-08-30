export type MetadataComponent =
	'topics' | 'labels' | 'milestones' | 'issues' | 'change-requests' | 'releases' | 'wiki';

export interface MetadataPage<T> {
	readonly items: readonly T[];
	readonly nextCursor: string | null;
}
export interface MetadataReadRequest {
	readonly routeId: string;
	readonly component: MetadataComponent;
	readonly cursor?: string;
}
export interface MetadataWriteRequest<T> {
	readonly routeId: string;
	readonly component: MetadataComponent;
	readonly items: readonly T[];
}
export interface MetadataTransport {
	read<T>(request: MetadataReadRequest): Promise<MetadataPage<T>>;
	write<T>(request: MetadataWriteRequest<T>): Promise<void>;
}
