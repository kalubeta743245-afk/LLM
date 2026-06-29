# Requirements Document

## Introduction

This bugfix addresses an authentication login error where the `/api/auth/login` endpoint returns HTML content instead of JSON, causing a JSON parsing error in the frontend (`Unexpected token '<', '<!DOCTYPE '... is not valid JSON`). The root cause is that Netlify's static file serving takes precedence over API routes, causing `/api/auth/login` requests to receive the static `login.html` file instead of being routed to the Express serverless function.

## Glossary

- **Netlify_Redirect_Rule**: The redirect configuration in netlify.toml that routes requests to the serverless function
- **API_Endpoint**: A server route that returns JSON responses (e.g., `/api/auth/login`, `/api/auth/register`)
- **Static_File**: An HTML, CSS, JavaScript, or image file served directly from the `src/public` directory
- **Serverless_Function**: The Express application wrapped in serverless-http and deployed as a Netlify function at `/.netlify/functions/api`
- **Frontend_Client**: The JavaScript code in login.html that makes fetch requests to API endpoints

## Requirements

### Requirement 1: API Route Prioritization

**User Story:** As a user attempting to log in, I want API requests to `/api/auth/login` to reach the backend Express handler, so that I receive a proper JSON response instead of an HTML page.

#### Acceptance Criteria

1. WHEN the Frontend_Client sends a POST request to `/api/auth/login`, THEN the Netlify_Redirect_Rule SHALL route the request to the Serverless_Function
2. WHEN the Netlify_Redirect_Rule processes a request matching `/api/*`, THEN the system SHALL bypass static file serving and route to the Serverless_Function
3. WHEN an API_Endpoint handler returns a response, THEN the Frontend_Client SHALL receive JSON content with the correct `Content-Type: application/json` header
4. WHEN the Frontend_Client receives a response from `/api/auth/login`, THEN the response body SHALL be valid JSON that can be parsed without errors

### Requirement 2: Static File Serving Preservation

**User Story:** As a user navigating the application, I want static HTML pages to continue being served correctly, so that the application remains functional for all non-API routes.

#### Acceptance Criteria

1. WHEN a user requests `/login.html`, THEN the system SHALL serve the Static_File from `src/public/login.html`
2. WHEN a user requests `/dashboard.html`, THEN the system SHALL serve the Static_File from `src/public/dashboard.html`
3. WHEN a user requests `/register.html`, THEN the system SHALL serve the Static_File from `src/public/register.html`
4. WHEN the Netlify_Redirect_Rule is configured, THEN Static_Files in `src/public` SHALL remain accessible without routing through the Serverless_Function

### Requirement 3: Redirect Configuration Correctness

**User Story:** As a developer deploying the application, I want the Netlify redirect configuration to properly distinguish between API routes and static files, so that routing behaves predictably across all environments.

#### Acceptance Criteria

1. THE Netlify_Redirect_Rule SHALL use a pattern that excludes API routes from static file serving
2. WHEN multiple Netlify_Redirect_Rules are defined, THEN they SHALL be ordered with more specific rules before catch-all rules
3. THE netlify.toml configuration SHALL explicitly route `/api/*` patterns to the Serverless_Function with status code 200
4. THE netlify.toml configuration SHALL allow Static_Files to be served first before applying function redirects

### Requirement 4: Error Prevention

**User Story:** As a user interacting with the application, I want to receive clear error messages when authentication fails, so that I can distinguish between credential errors and system errors.

#### Acceptance Criteria

1. WHEN the Serverless_Function returns a JSON error response, THEN the Frontend_Client SHALL receive the error message without HTML content
2. WHEN a network error occurs during authentication, THEN the error message SHALL not include JSON parsing errors related to HTML content
3. IF the Netlify_Redirect_Rule is misconfigured, THEN API requests SHALL fail with a clear error rather than silently returning HTML
4. WHEN debugging redirect issues, THEN response headers SHALL indicate whether the response came from a Static_File or the Serverless_Function
