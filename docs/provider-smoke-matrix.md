# Provider smoke and self-hosted matrix

Normal CI uses deterministic contract fixtures and local bare Git repositories. Secret-backed tests are opt-in and read-only:

```sh
cd app
GITTRANSIT_PROVIDER_SMOKE=1 \
GITTRANSIT_SMOKE_PROVIDER=gitea \
GITTRANSIT_SMOKE_BASE_URL=https://gitea.example \
GITTRANSIT_SMOKE_API_URL=https://gitea.example/api/v1/ \
GITTRANSIT_SMOKE_TOKEN=... \
npm run test:providers
```

Run the command separately for GitHub, GitLab, Bitbucket Cloud, Gitea, and Forgejo. The smoke probe performs identity, capability, and first-page inventory reads only. Generic Git is covered by local HTTPS/SSH transport tests. Per the current scope decision, Bitbucket Data Center is not advertised as a named adapter; use generic Git until its independent licensed fixture exists.

Before release, record pass/fail and product version for: GitHub.com, GitHub Enterprise when available, GitLab.com, self-managed GitLab, Bitbucket Cloud, current Gitea, current Forgejo, Gitea-to-Gitea on separate instances, and generic HTTPS/SSH in both source and target roles. Mutation acceptance runs use dedicated disposable repositories and the four flows in section 22 of the plan.
