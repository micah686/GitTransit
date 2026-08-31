import { error, type RequestHandler } from '@sveltejs/kit';
import { database } from '$lib/server/persistence/database';
export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) error(401, { code: 'AUTH_REQUIRED', message: 'Authentication required.' });
	const db = database();
	const scalar = (sql: string) => (db.prepare(sql).get(locals.user!.id) as { value: number }).value;
	const recent = (
		db
			.prepare(
				'SELECT COUNT(*) value FROM worker_heartbeats WHERE stopped_at IS NULL AND heartbeat_at>?'
			)
			.get(Date.now() - 60_000) as { value: number }
	).value;
	const body = [
		`# HELP gittransit_runs Number of runs owned by the authenticated user.`,
		`# TYPE gittransit_runs gauge`,
		`gittransit_runs{state="queued"} ${scalar("SELECT COUNT(*) value FROM runs WHERE user_id=? AND state='queued'")}`,
		`gittransit_runs{state="running"} ${scalar("SELECT COUNT(*) value FROM runs WHERE user_id=? AND state='running'")}`,
		`gittransit_runs{state="awaiting_approval"} ${scalar("SELECT COUNT(*) value FROM runs WHERE user_id=? AND state='awaiting-approval'")}`,
		`# HELP gittransit_pending_approvals Pending destructive plans.`,
		`# TYPE gittransit_pending_approvals gauge`,
		`gittransit_pending_approvals ${scalar("SELECT COUNT(*) value FROM destructive_plans WHERE user_id=? AND state='pending'")}`,
		`# HELP gittransit_notification_deliveries Notification deliveries by state.`,
		`# TYPE gittransit_notification_deliveries gauge`,
		`gittransit_notification_deliveries{state="queued"} ${scalar("SELECT COUNT(*) value FROM notification_deliveries WHERE user_id=? AND state IN ('queued','delivering')")}`,
		`gittransit_notification_deliveries{state="failed"} ${scalar("SELECT COUNT(*) value FROM notification_deliveries WHERE user_id=? AND state='failed'")}`,
		`# HELP gittransit_workers_recent Workers heartbeating in the last minute.`,
		`# TYPE gittransit_workers_recent gauge`,
		`gittransit_workers_recent ${recent}`,
		''
	].join('\n');
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; version=0.0.4; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
