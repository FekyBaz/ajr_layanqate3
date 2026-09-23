# Security Policy

## Reporting a vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

For a suspected vulnerability, contact the project maintainers privately through the contact method listed in the repository profile or project documentation. Include:

- A clear description of the issue
- Affected component or file
- Steps to reproduce, if safe to share
- Potential impact
- Any suggested mitigation

Please do not include secrets, credentials, personal data, or production access tokens in a report.

## Secrets

Never commit:

- Supabase service-role keys
- Admin API keys
- Private keys or tokens
- Production environment files
- Personal access tokens

If a credential is accidentally exposed, revoke/rotate it immediately and then remove it from the repository and, when necessary, from Git history.
