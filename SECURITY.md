# Security policy

StepSlate is a static web application. All calculation happens in your browser;
it makes **no network requests** after the page has loaded, stores nothing on a
server, and keeps practice progress only in your browser's `localStorage`
(clearable with one button). The bundled local server (`npm start`) only serves
static files and binds to `127.0.0.1` by default. The page ships a Content
Security Policy that blocks loading anything from other origins.

Please report vulnerabilities privately through GitHub's "Report a vulnerability"
(security advisories) on <https://github.com/Kinfxhk/stepslate> rather than in a
public issue.
