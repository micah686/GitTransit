import { FakeProviderAdapter } from './fake';
import { GenericGitProviderAdapter } from './generic-git';
import { GiteaProviderAdapter } from './gitea';
import { ForgejoProviderAdapter } from './forgejo';
import { GitLabProviderAdapter } from './gitlab';
import { GitHubProviderAdapter } from './github';
import { BitbucketCloudProviderAdapter } from './bitbucket-cloud';
import { ProviderRegistry } from './types';

let instance: ProviderRegistry | undefined;

export function providerRegistry(): ProviderRegistry {
	if (!instance) {
		instance = new ProviderRegistry();
		instance.register(new FakeProviderAdapter());
		instance.register(new GenericGitProviderAdapter());
		instance.register(new GiteaProviderAdapter());
		instance.register(new ForgejoProviderAdapter());
		instance.register(new GitLabProviderAdapter());
		instance.register(new GitHubProviderAdapter());
		instance.register(new BitbucketCloudProviderAdapter());
	}
	return instance;
}
