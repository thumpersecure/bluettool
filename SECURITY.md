# Security Policy

## Supported versions

BlueTTool is currently maintained on the `main` branch.

## Reporting a vulnerability

Please report security issues privately using GitHub Security Advisories:

<https://github.com/thumpersecure/bluettool/security/advisories/new>

Include:

- Affected file/module
- Reproduction steps
- Impact assessment
- Suggested remediation (if available)

## Response targets

- Initial acknowledgement: within 3 business days
- Triage decision: within 7 business days
- Fix timeline: depends on severity and exploitability

## Scope notes

Because BlueTTool interacts with Bluetooth-capable devices, reports related to:

- unauthorized write/read vectors,
- replay/injection safety gaps,
- unsafe import parsing,
- XSS/CSP bypass,
- sensitive data leakage in logs,

are considered high priority.
