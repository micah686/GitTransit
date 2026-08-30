# Phase 4 implementation

Phase 4 enables Gitea, Forgejo, GitLab/self-managed GitLab, GitHub/GitHub Enterprise, and Bitbucket Cloud as named provider connections.

Each adapter implements:

- authenticated identity and product/version probing
- default and explicitly overridden API base URLs
- credential-aware capability snapshots
- namespace and repository pagination using provider-native cursors
- stable repository identity and subgroup/workspace path normalization
- find-or-create empty repository operations
- credential-free HTTPS clone/push endpoint resolution
- typed authentication, permission, not-found, validation, rate-limit, server, and network errors

All provider HTTP requests use manual redirect handling. Authorization is forwarded only across redirects that retain the exact origin, and raw provider error bodies are never exposed through normalized errors.

The implementation follows the providers' official API contracts:

- [Gitea API usage](https://docs.gitea.com/1.24/development/api-usage/) and [repository creation](https://docs.gitea.com/api/next/operations/create-current-user-repo/)
- [Forgejo API documentation](https://forgejo.org/docs/latest/user/api/)
- [GitLab Projects API](https://docs.gitlab.com/api/projects/) and [REST pagination](https://docs.gitlab.com/api/rest/)
- [GitHub Repositories REST API](https://docs.github.com/en/rest/repos/repos)
- [Bitbucket Cloud repositories](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/) and [opaque pagination](https://developer.atlassian.com/cloud/bitbucket/rest/)

Discovery fetches every page before opening its persistence transaction. A partial or cyclic scan therefore changes no inventory rows. Successful scans upsert by connection plus provider-stable ID, preserve original display casing, and retain full GitLab subgroup and Bitbucket workspace/project identities.

The connection UI provides provider branding, SaaS defaults, API override fields for enterprise/self-managed installations, token/basic/app-password variants, detected capability reasons, and an explicit discovery action. Bitbucket Data Center remains unsupported and has no selectable adapter.
