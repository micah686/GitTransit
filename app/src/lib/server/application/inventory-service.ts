import type { SqliteDatabase } from '../persistence/database';
import { database } from '../persistence/database';

export interface RouteFilters {
	pair?: string;
	status?: string;
	direction?: string;
	text?: string;
}
export interface RouteListItem {
	routeId: string;
	pairId: string;
	pairName: string;
	direction: string;
	status: string;
	warning: string | null;
	sourcePath: string;
	sourceWebUrl: string | null;
	targetPath: string | null;
	targetWebUrl: string | null;
	lastSuccessfulRunId: string | null;
}
export interface RouteDetail extends RouteListItem {
	errorCode: string | null;
	updatedAt: number;
	sourceUrl: string;
	targetUrl: string | null;
}
export interface RunListItem {
	id: string;
	pairId: string | null;
	routeId: string | null;
	trigger: string;
	kind: string;
	state: string;
	progressTotal: number;
	progressCompleted: number;
	requestedAt: number;
	completedAt: number | null;
	errorCode: string | null;
	pairName: string | null;
}
export interface RunStepItem {
	id: string;
	name: string;
	attempt: number;
	maxAttempts: number;
	state: string;
	checkpoint: string;
	errorCode: string | null;
	startedAt: number | null;
	completedAt: number | null;
}
export interface RunDetail {
	run: { id: string; kind: string; trigger: string; state: string };
	steps: readonly RunStepItem[];
}
export class InventoryService {
	constructor(private readonly db: SqliteDatabase) {}
	listRoutes(ownerId: string, filters: RouteFilters = {}, limit = 100): readonly RouteListItem[] {
		return this.db
			.prepare(
				`SELECT r.id routeId,r.pair_id pairId,p.name pairName,p.direction,r.status,r.warning_summary warning,
		 a.canonical_full_path sourcePath,a.web_url sourceWebUrl,b.canonical_full_path targetPath,b.web_url targetWebUrl,
		 r.last_successful_run_id lastSuccessfulRunId FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id
		 JOIN route_endpoints a ON a.route_id=r.id AND a.side='A' LEFT JOIN route_endpoints b ON b.route_id=r.id AND b.side='B'
		 WHERE r.user_id=? AND (? IS NULL OR r.pair_id=?) AND (? IS NULL OR r.status=?) AND (? IS NULL OR p.direction=?)
		 AND (? IS NULL OR a.canonical_full_path LIKE '%'||?||'%' OR b.canonical_full_path LIKE '%'||?||'%') ORDER BY r.updated_at DESC LIMIT ?`
			)
			.all(
				ownerId,
				filters.pair ?? null,
				filters.pair ?? null,
				filters.status ?? null,
				filters.status ?? null,
				filters.direction ?? null,
				filters.direction ?? null,
				filters.text ?? null,
				filters.text ?? null,
				filters.text ?? null,
				limit
			) as RouteListItem[];
	}
	getRoute(ownerId: string, id: string): RouteDetail | null {
		return (
			(this.db
				.prepare(
					`SELECT r.id routeId,r.pair_id pairId,p.name pairName,p.direction,r.status,r.warning_summary warning,r.safe_error_code errorCode,r.updated_at updatedAt,a.canonical_full_path sourcePath,a.fetch_url sourceUrl,a.web_url sourceWebUrl,b.canonical_full_path targetPath,b.push_url targetUrl,b.web_url targetWebUrl,r.last_successful_run_id lastSuccessfulRunId FROM repository_routes r JOIN mirror_pairs p ON p.id=r.pair_id AND p.user_id=r.user_id JOIN route_endpoints a ON a.route_id=r.id AND a.side='A' LEFT JOIN route_endpoints b ON b.route_id=r.id AND b.side='B' WHERE r.id=? AND r.user_id=?`
				)
				.get(id, ownerId) as RouteDetail | undefined) ?? null
		);
	}
	listRuns(ownerId: string, state?: string, limit = 100): readonly RunListItem[] {
		return this.db
			.prepare(
				`SELECT r.id,r.pair_id pairId,r.route_id routeId,r.trigger,r.kind,r.state,r.progress_total progressTotal,r.progress_completed progressCompleted,r.requested_at requestedAt,r.completed_at completedAt,r.safe_error_code errorCode,p.name pairName FROM runs r LEFT JOIN mirror_pairs p ON p.id=r.pair_id WHERE r.user_id=? AND (? IS NULL OR r.state=?) ORDER BY r.requested_at DESC LIMIT ?`
			)
			.all(ownerId, state ?? null, state ?? null, limit) as RunListItem[];
	}
	getRun(ownerId: string, id: string): RunDetail | null {
		const run = this.db
			.prepare('SELECT id,kind,trigger,state FROM runs WHERE id=? AND user_id=?')
			.get(id, ownerId) as RunDetail['run'] | undefined;
		if (!run) return null;
		const steps = this.db
			.prepare(
				'SELECT id,name,attempt,max_attempts maxAttempts,state,checkpoint_json checkpoint,safe_error_code errorCode,started_at startedAt,completed_at completedAt FROM run_steps WHERE run_id=? ORDER BY step_order'
			)
			.all(id) as RunStepItem[];
		return { run, steps };
	}
}
let instance: InventoryService | undefined;
export function inventoryService() {
	instance ??= new InventoryService(database());
	return instance;
}
