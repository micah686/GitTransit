import { GiteaFamilyAdapter } from './gitea-family';

export class ForgejoProviderAdapter extends GiteaFamilyAdapter {
	constructor(fetcher: typeof fetch = fetch) {
		super('forgejo', 'Forgejo', fetcher);
	}
}
