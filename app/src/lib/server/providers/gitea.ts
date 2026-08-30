import { GiteaFamilyAdapter } from './gitea-family';

export class GiteaProviderAdapter extends GiteaFamilyAdapter {
	constructor(fetcher: typeof fetch = fetch) {
		super('gitea', 'Gitea', fetcher);
	}
}
