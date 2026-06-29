# Implementation Plan: Fix Auth Login JSON Response

## Overview

This implementation plan addresses a critical Netlify routing issue where API endpoints return HTML instead of JSON responses. The fix involves updating the `netlify.toml` configuration to add an explicit redirect rule for `/api/*` routes with the `force = true` flag, ensuring API requests bypass static file serving and reach the Express serverless function.

## Tasks

- [ ] 1. Update netlify.toml with explicit API route redirect
  - Add new `[[redirects]]` block for `/api/*` pattern before the catch-all rule
  - Set `from = "/api/*"` to match all API endpoints
  - Set `to = "/.netlify/functions/api"` to route to serverless function
  - Set `status = 200` to rewrite (not redirect) the URL
  - Add `force = true` to bypass static file serving entirely
  - Ensure the `/api/*` rule appears **before** the `/*` catch-all rule
  - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3_

- [ ] 2. Verify netlify.toml syntax and structure
  - Validate TOML syntax is correct (no parsing errors)
  - Confirm `[build]` section remains unchanged
  - Confirm `[[headers]]` section remains unchanged
  - Verify redirect rules are in correct order (specific before general)
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 3. Test configuration locally with Netlify CLI
  - Run `netlify dev` to simulate Netlify routing locally
  - Test POST request to `/api/auth/login` returns JSON (not HTML)
  - Verify `Content-Type: application/json` header is present
  - Test that `/login.html` still serves static HTML correctly
  - Test that `/dashboard.html` still serves static HTML correctly
  - _Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.4_

- [ ] 4. Checkpoint - Verify local testing passes
  - Ensure all local tests pass, ask the user if questions arise.

- [ ] 5. Deploy to Netlify preview environment
  - Commit changes to a preview branch
  - Push to trigger Netlify preview deploy
  - Wait for preview deployment to complete
  - Note the preview URL for testing
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Verify API endpoints return JSON on preview deployment
  - Use curl or browser to POST to `https://preview-url/api/auth/login`
  - Verify response has `Content-Type: application/json` header
  - Verify response body is valid JSON (not HTML)
  - Test with invalid credentials to confirm error responses are JSON
  - Test `/api/auth/register` endpoint returns JSON
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2_

- [ ] 7. Verify static files remain accessible on preview deployment
  - Navigate to `https://preview-url/login.html` in browser
  - Verify HTML page loads correctly (not routed through function)
  - Check response headers show `Content-Type: text/html`
  - Repeat for `/dashboard.html` and `/register.html`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4_

- [ ] 8. Test full authentication flow end-to-end
  - Open browser DevTools Network tab
  - Navigate to `/register.html` on preview URL
  - Submit registration form with test credentials
  - Verify no JSON parsing errors in console
  - Verify API response is JSON in Network tab
  - Navigate to `/login.html`
  - Submit login form with registered credentials
  - Verify successful authentication and redirect
  - _Requirements: 1.1, 1.3, 1.4, 4.2_

- [ ] 9. Verify Netlify function logs show API requests
  - Access Netlify dashboard function logs
  - Make a request to `/api/auth/login` on preview URL
  - Confirm function invocation appears in logs
  - Verify request reached Express handler (no routing error)
  - Check response headers indicate function origin
  - _Requirements: 1.1, 4.3, 4.4_

- [ ] 10. Final checkpoint - Confirm all requirements met
  - Review acceptance criteria verification table from design
  - Confirm no JSON parsing errors occur in any scenario
  - Confirm API routes return JSON with correct headers
  - Confirm static files are still accessible
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This is a **configuration-only change** — no code modifications required
- The fix is minimal and targets the root cause (Netlify redirect precedence)
- Testing focuses on integration and manual verification (no property-based tests needed)
- The `force = true` flag is critical — it bypasses static file serving entirely for `/api/*`
- Rule ordering matters: specific `/api/*` must come before catch-all `/*`
- Zero-downtime deployment: redirect rules apply instantly on Netlify deploy
- Rollback is simple: revert the commit and redeploy
- All requirements are covered by implementation and verification tasks
- No optional tasks — all steps are required for this critical bugfix

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6", "7"] },
    { "id": 5, "tasks": ["8", "9"] }
  ]
}
```
