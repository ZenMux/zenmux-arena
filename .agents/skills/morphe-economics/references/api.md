# Morphe API reference

Base URL: `https://morphe.zenmux.app` (override script with `MORPHE_BASE_URL`).
All endpoints are under `/api`. Spec: https://morphe.zenmux.app/openapi.json

## Auth

`securitySchemes` declares `cookieAuth` — an apiKey cookie named
`morphe_session`. Login returns an `accessToken`. The script sends the token as
**both** `Cookie: morphe_session=<token>` and `Authorization: Bearer <token>`,
which works regardless of which the server checks. The token is stored in
`~/.morphe/auth.json` as `{ "accessToken": "...", "user": {...} }`.

## POST /api/user/login

Request:
```json
{ "username": "string", "password": "string", "rememberMe": true }
```
Response 200:
```json
{ "success": true, "accessToken": "string", "user": { "id": "...", "username": "...", "account": {...} } }
```
401 on bad credentials.

## POST /api/oss/presign  (auth required)

Generates an OSS PUT presigned URL. Upload with `curl -X PUT -T code.zip "<url>"`.

Request:
```json
{ "contentType": "application/zip", "expires": 3600 }
```
Response 200:
```json
{ "success": true, "url": "<presigned PUT url>", "codeObject": "deployments/.../code.zip",
  "deploymentId": "...", "expires": 3600, "contentType": "application/zip" }
```
`codeObject` is the value to pass as `ossObjectName` to `/api/deploy`.

## POST /api/deploy  (auth required)

Deploys the uploaded OSS object to the Morphe runtime. Existing function → update,
otherwise create + HTTP trigger + reserved instance.

Request (only `functionName` + `ossObjectName` required):
```json
{
  "functionName": "user-xxxxxxxx",
  "ossObjectName": "<codeObject from presign>",
  "checksum": "<crc64 decimal string>"
}
```
Defaults applied server-side: `runtime=custom.debian11`, `handler=index.handler`,
`memorySize=512`, `timeout=60`, `instanceConcurrency=20`, `minInstances=1`,
`command="node server.js"`, `port=3000`.

Response 200:
```json
{ "success": true, "action": "created" | "updated", "functionName": "...", "triggerUrl": "https://..." }
```

### checksum note

The spec describes `checksum` as a sha256 written into `manifest.json` and **not
validated** by the server. This skill writes a **CRC-64/XZ** (Aliyun OSS
`crc64ecma`, unsigned decimal) value per the user's requirement; since the
server does not validate it, this is accepted. The same value is stored in the
project's `.morphe.json` under `checksum`.

## .morphe.json (project root)

```json
{ "checksum": "<crc64 decimal>", "function_name": "user-xxxxxxxx" }
```

`function_name` is generated once (`user-` + 8 lowercase alphanumerics) and
reused on every redeploy so the same function is updated, not duplicated.
