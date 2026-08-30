import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () =>
	json({ status: 'ok', version: '0.0.1', time: new Date().toISOString() });
