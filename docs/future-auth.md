# Future authentication seam

GitTransit currently supports local email/password accounts only. Sessions are deliberately independent of the login mechanism so a future identity provider can end by creating the same opaque database session.

Future provider work must implement the internal `LoginProvider` and `IdentityLinker` contracts described in the product plan. It must include OIDC issuer/audience/nonce/PKCE validation, SAML metadata/signature/replay validation, an explicit trusted-header proxy boundary, allowed-domain policy, safe identity linking, and administrator recovery. No current route or environment variable advertises these features.
