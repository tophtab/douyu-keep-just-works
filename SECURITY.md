# Security Policy

## Supported Versions

Security fixes are considered for the current Docker WebUI release line. Please
upgrade to the latest published Docker image before reporting an issue that may
already be fixed.

## Reporting a Vulnerability

Please do not report security vulnerabilities in public issues.

Use GitHub private vulnerability reporting if it is enabled for this repository.
If private reporting is not available, open a minimal public issue asking for a
private security contact and do not include exploit details.

Do not post any of the following in public issues, discussions, screenshots, or
logs:

- Douyu cookies
- WebUI passwords
- Raw `config.json` files
- Full request headers or browser storage dumps

When sharing diagnostics, redact secrets first. It is usually enough to include
the Docker image tag, sanitized logs, the affected task, and a short description
of the expected and actual behavior.

Maintainers will acknowledge actionable private reports when possible and will
coordinate a fix or mitigation before public disclosure.
