# Deploy the FastAPI backend to Azure Container Apps

This folder is the deployable backend. It runs `server/app.py` as a Docker
container; the Next.js app remains on Vercel.

## Resulting architecture

```text
Browser -> Vercel / Next.js -> Azure Container Apps / FastAPI
                                      |
                                      +-> Neon Postgres
                                      +-> Groq API (hosted model inference)
Google OAuth -> Azure /api/google/callback -> Vercel profile page
```

The Azure service is externally reachable only for the Google OAuth callback
and `/health`. Every application mutation and chat request from Next.js carries
`X-Internal-Secret` and is rejected by FastAPI without it.

## 1. Prerequisites

- Azure subscription with Contributor permissions.
- Azure CLI installed, then sign in with `az login`.
- Docker is optional. `az containerapp up --source .` can build the image in
  Azure from this folder's `Dockerfile`.
- A copy of the values from `azure.env.example`. Never commit real values.

From PowerShell, run the following from the repository root:

```powershell
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

$resourceGroup = "elevate-ai-rg"
$location = "eastus"
$environment = "elevate-ai-env"
$appName = "elevate-ai-api"

Set-Location .\server
az containerapp up `
  --name $appName `
  --resource-group $resourceGroup `
  --location $location `
  --environment $environment `
  --source . `
  --ingress external `
  --target-port 8080 `
  --env-vars PORT=8080
```

`eastus` is a sensible first choice because the existing Neon database is in
US East. Choose another supported region only if latency or budget requires it.
The first command creates the resource group, Container Apps environment,
container registry, image, and Container App. It outputs an Azure FQDN.

```powershell
$fqdn = az containerapp show --name $appName --resource-group $resourceGroup --query "properties.configuration.ingress.fqdn" --output tsv
$backendUrl = "https://$fqdn"
Invoke-WebRequest "$backendUrl/health" | Select-Object -Expand Content
```

Expected output: `{"ok":true}`.

## 2. Configure secrets and environment variables

In the Azure portal, open **Container App > elevate-ai-api > Security >
Secrets** and add secrets with these names. Use the values in your local
environment; the names are deliberately short because Container Apps limits
secret names to 20 characters.

| Secret name | Backend variable |
| --- | --- |
| `database-url` | `DATABASE_URL` |
| `int-api-secret` | `INTERNAL_API_SECRET` |
| `groq-api-key` | `GROQ_API_KEY` |
| `tavily-api-key` | `TAVILY_API_KEY` (if used) |
| `google-client-id` | `GOOGLE_CLIENT_ID` |
| `google-client-secret` | `GOOGLE_CLIENT_SECRET` |
| `google-state-secret` | `GOOGLE_OAUTH_STATE_SECRET` |
| `gmail-sender-email` | `GMAIL_SENDER_EMAIL` (if used) |
| `gmail-sender-refresh` | `GMAIL_SENDER_REFRESH_TOKEN` (if used) |
| `livekit-api-key` | `LIVEKIT_API_KEY` (if used) |
| `livekit-api-secret` | `LIVEKIT_API_SECRET` (if used) |

Then open **Containers > Edit and deploy > Environment variables** and set:

| Variable | Value |
| --- | --- |
| `PORT` | `8080` |
| `CORS_ALLOWED_ORIGINS` | `https://elevate-ai-snowy.vercel.app,http://localhost:3000` |
| `DATABASE_URL` | Reference secret `database-url` |
| `INTERNAL_API_SECRET` | Reference secret `int-api-secret` |
| `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` |
| `GROQ_MODEL` | `openai/gpt-oss-20b` |
| `GROQ_API_KEY` | Reference secret `groq-api-key` |
| `GOOGLE_CLIENT_ID` | Reference secret `google-client-id` |
| `GOOGLE_CLIENT_SECRET` | Reference secret `google-client-secret` |
| `GOOGLE_OAUTH_STATE_SECRET` | Reference secret `google-state-secret` |
| `GOOGLE_OAUTH_REDIRECT_URI` | `$backendUrl/api/google/callback` (use the actual URL) |
| `GOOGLE_OAUTH_SUCCESS_REDIRECT` | `https://elevate-ai-snowy.vercel.app/profile?google_calendar=connected` |
| `GOOGLE_OAUTH_FAILURE_REDIRECT` | `https://elevate-ai-snowy.vercel.app/profile?google_calendar=failed` |

Add optional secrets only when the corresponding integration is enabled.
Creating or changing environment variables creates a new revision. Secrets
themselves are not automatically picked up by existing revisions, so restart or
deploy a new revision after changing a secret.

For CLI users, the equivalent pattern is:

```powershell
az containerapp secret set --name $appName --resource-group $resourceGroup --secrets "int-api-secret=YOUR_VALUE"
az containerapp update --name $appName --resource-group $resourceGroup --set-env-vars "INTERNAL_API_SECRET=secretref:int-api-secret"
```

Use the portal or Azure Key Vault for the full secret set instead of putting
real values in shell history.

## 3. Configure health and scale

In **Containers > Health probes**, configure HTTP probes against `/health` on
port `8080`:

- Startup: initial delay 10 seconds, period 10 seconds, failure threshold 30.
- Readiness: initial delay 5 seconds, period 10 seconds.
- Liveness: initial delay 10 seconds, period 20 seconds.

Start with **1 vCPU, 2 GiB memory, min replicas 1, max replicas 2**. Keeping
one replica warm avoids a slow Python/LangGraph cold start. Groq handles model
capacity, while Azure scale limits keep your own infrastructure spending and
request concurrency predictable.

## 4. Point Vercel at Azure

In Vercel > Project > Settings > Environment Variables, add these for
Production, Preview, and Development as appropriate:

```text
PYTHON_BACKEND_URL=https://YOUR-APP.REGION.azurecontainerapps.io
INTERNAL_API_SECRET=the-exact-same-value-as-Azure
```

`PYTHON_BACKEND_URL` is server-only; do not prefix it with `NEXT_PUBLIC_`.
The new Clerk-protected `/api/google/connect` route means the browser no longer
needs the Azure backend URL.

Redeploy Vercel after saving the variables. Remove any legacy Render URL values
from `FASTAPI_URL`, `FLASK_BACKEND_URL`, and `NEXT_PUBLIC_FLASK_BACKEND_URL`
after confirming the Azure URL is active. Keep `PYTHON_BACKEND_URL`: it is the
new canonical server-only address.

## 5. Update Google OAuth

In Google Cloud Console > APIs & Services > Credentials > your OAuth web client,
add this exact Authorized redirect URI:

```text
https://YOUR-APP.REGION.azurecontainerapps.io/api/google/callback
```

It must exactly match `GOOGLE_OAUTH_REDIRECT_URI`: same hostname, HTTPS, and
path, with no trailing slash. Keep `http://localhost:5000/api/google/callback`
as an additional URI for local development if you use it.

## 6. Verification checklist

```powershell
# Public probe
Invoke-WebRequest "$backendUrl/health" | Select-Object -Expand Content

# FastAPI must reject untrusted chat traffic
Invoke-WebRequest "$backendUrl/api/chat" -Method POST -ContentType "application/json" -Body '{"message":"hello","clerkUserId":"test"}'
# Expected: 401 or 503, never a successful response.
```

Then on the deployed Vercel app:

1. Send a chatbot message; it should return a response or use the local
   fallback, never call Render.
2. Run a simulation evaluation and a calendar action.
3. Connect Google Calendar from Profile; it should go through
   `/api/google/connect`, consent, Azure callback, then return to Profile.
4. In Azure, use **Log stream** for the Container App and check the active
   revision is healthy.

## 7. Updating later

Push the code to your normal branch, then either rerun the source deployment
command from this folder or set up the GitHub Actions workflow generated by
`az containerapp up --repo <repository-url>`. For a manual source update:

```powershell
Set-Location .\server
az containerapp up --name $appName --resource-group $resourceGroup --source .
```

Do not rerun `--repo` merely to deploy an update: Azure's CLI documentation
notes that it can generate additional workflows. Push to the generated workflow
instead.
