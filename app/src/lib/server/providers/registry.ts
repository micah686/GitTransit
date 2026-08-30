import { FakeProviderAdapter } from './fake';
import { GenericGitProviderAdapter } from './generic-git';
import { ProviderRegistry } from './types';

let instance: ProviderRegistry | undefined;

export function providerRegistry(): ProviderRegistry {
	if (!instance) {
		instance = new ProviderRegistry();
		instance.register(new FakeProviderAdapter());
		instance.register(new GenericGitProviderAdapter());
	}
	return instance;
}
