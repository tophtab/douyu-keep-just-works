# Implementation Plan

1. Add focused gift-send behavior tests for resolver reuse, serial ordering, failed-count carry-over, and delay placement.
2. Implement the task-local room DID resolver and wire it through `sendGifts`, `executeExpiringGiftJob`, and `executeDoubleCardJob` without changing send semantics.
3. Add WebUI resource/config helper tests using the existing TypeScript module loader and narrow dependency mocks.
4. Add the shared WebUI config mutation helper and migrate task, manual-cookie, CookieCloud, and theme save paths while preserving feature-owned side effects.
5. Remove unconditional full-log loading from authenticated bootstrap and rely on the existing logs-tab lazy loader.
6. Update GitHub Actions path filters and add `npm run test:contracts` to the validate job without invoking a second Docker build.
7. Run targeted tests during each change, then run the complete quality gate:
   - `npm run lint`
   - `npm run type-check`
   - `npm run test:contracts`
   - `npm run build:docker`
8. Review the final diff for accidental changes to request concurrency, delays, config response ownership, Docker publish behavior, or unrelated files.

## Risk And Rollback Points

- Gift-send risk: changing the resolver lifetime could suppress legitimate retries. Cache only fulfilled DID values and keep the cache task-local.
- WebUI config risk: feature-specific state may stop updating if the helper owns too much. Limit it to transport, response extraction, and `rawConfig` replacement.
- Log-loading risk: direct navigation to `/Logs` must still load logs after authentication. Cover this path explicitly.
- CI risk: using `npm test` would duplicate the build. Use `npm run test:contracts` only.
- Roll back each numbered implementation area independently if its focused tests fail; no data migration or config rollback is required.

