# Deploy the FastAPI backend to Azure Container Apps

This folder contains the deployable backend. It runs `server/app.py` as a Docker container; the Next.js app remains on Vercel.

## Resulting architecture

```text
Browser -> Vercel / Next.js -> Azure Container Apps / FastAPI
                                      |
                                      +-> Neon Postgres
                                      +-> Groq API (hosted model inference)
Google OAuth -> Azure callback -> Vercel profile page
```

The Azure service is externally reachable only for `/health` and the Google OAuth callback. Every application mutation and chat request from Next.js carries `X-Internal-Secret` and is rejected by FastAPI without it.

## 1. Before you start

Have these ready before you open Azure Portal:

- An Azure subscription with permission to create and edit resources.
- The values from `azure.env.example`.
- Your production Vercel URL.
- Your Google OAuth client details.

Use the Azure Portal for the full setup. This guide intentionally avoids CLI steps.

## 2. Create the Azure resources in the portal

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Create or open the resource group you want to use, for example `elevate-ai-rg`.
3. Create an Azure Container Apps environment in a nearby region. `eastus` is a sensible first choice because the Neon database is already in US East.
4. Create a Container App named `elevate-ai-api`.
5. Use the backend container image built from this folder's `Dockerfile`.
6. Set the container app ingress to External.
7. Set the target port to `8080`.

If the portal asks for CPU and memory, start with 1 vCPU and 2 GiB memory. Set min replicas to 1 and max replicas to 2.

## 3. Add secrets

In the Azure Portal, open **Container App > elevate-ai-api > Secrets** and add these secrets. Use your real values, but keep the secret names short because Container Apps limits secret name length.

| Secret name            | Backend variable                     |
| ---------------------- | ------------------------------------ |
| `database-url`         | `DATABASE_URL`                       |
| `int-api-secret`       | `INTERNAL_API_SECRET`                |
| `groq-api-key`         | `GROQ_API_KEY`                       |
| `groq-fallback-key`    | `GROQ_API_KEY_FALLBACK`              |
| `tavily-api-key`       | `TAVILY_API_KEY` if used             |
| `google-client-id`     | `GOOGLE_CLIENT_ID`                   |
| `google-client-secret` | `GOOGLE_CLIENT_SECRET`               |
| `google-state-secret`  | `GOOGLE_OAUTH_STATE_SECRET`          |
| `gmail-sender-email`   | `GMAIL_SENDER_EMAIL` if used         |
| `gmail-sender-refresh` | `GMAIL_SENDER_REFRESH_TOKEN` if used |
| `livekit-api-key`      | `LIVEKIT_API_KEY` if used            |
| `livekit-api-secret`   | `LIVEKIT_API_SECRET` if used         |

## 4. Set environment variables

In the same Container App, open **Containers > Environment variables** and add these values. For secret-backed values, choose the secret reference instead of pasting the raw value into the variable field.

| Variable                        | Value                                                                   |
| ------------------------------- | ----------------------------------------------------------------------- |
| `PORT`                          | `8080`                                                                  |
| `CORS_ALLOWED_ORIGINS`          | `https://elevate-ai-snowy.vercel.app,http://localhost:3000`             |
| `DATABASE_URL`                  | Secret reference `database-url`                                         |
| `INTERNAL_API_SECRET`           | Secret reference `int-api-secret`                                       |
| `GROQ_BASE_URL`                 | `https://api.groq.com/openai/v1`                                        |
| `GROQ_MODEL`                    | `openai/gpt-oss-20b`                                                    |
| `GROQ_API_KEY`                  | Secret reference `groq-api-key`                                         |
| `GROQ_API_KEY_FALLBACK`         | Secret reference `groq-fallback-key`                                    |
| `GOOGLE_CLIENT_ID`              | Secret reference `google-client-id`                                     |
| `GOOGLE_CLIENT_SECRET`          | Secret reference `google-client-secret`                                 |
| `GOOGLE_OAUTH_STATE_SECRET`     | Secret reference `google-state-secret`                                  |
| `GOOGLE_OAUTH_REDIRECT_URI`     | `https://YOUR-APP.REGION.azurecontainerapps.io/api/google/callback`     |
| `GOOGLE_OAUTH_SUCCESS_REDIRECT` | `https://elevate-ai-snowy.vercel.app/profile?google_calendar=connected` |
| `GOOGLE_OAUTH_FAILURE_REDIRECT` | `https://elevate-ai-snowy.vercel.app/profile?google_calendar=failed`    |

Add the optional variables only when the related integration is enabled.

## 5. Configure health probes

In **Containers > Health probes**, add HTTP probes that check `/health` on port `8080`.

- Startup probe: initial delay 10 seconds, period 10 seconds, failure threshold 30.
- Readiness probe: initial delay 5 seconds, period 10 seconds.
- Liveness probe: initial delay 10 seconds, period 20 seconds.

## 6. Copy the Azure URL into Vercel

After the Container App is created, open it in the portal and copy the public ingress URL from the Overview page.

Then in Vercel, open **Project > Settings > Environment Variables** and add or update these values for Production, Preview, and Development as needed:

```text
PYTHON_BACKEND_URL=https://YOUR-APP.REGION.azurecontainerapps.io
INTERNAL_API_SECRET=the-same-value-as-the-Azure-secret
GROQ_API_KEY=your-primary-groq-key
GROQ_API_KEY_FALLBACK=your-secondary-groq-key
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=openai/gpt-oss-20b
```

`PYTHON_BACKEND_URL` is server-only, so do not prefix it with `NEXT_PUBLIC_`. The Groq keys are also server-only secrets.

> Groq enforces an organization-wide rate-limit ceiling. A second key from the same organization can help with key-specific or temporary failures, but it does not bypass the organization-wide limit.

## 7. Update Google OAuth

In Google Cloud Console, open **APIs & Services > Credentials > your OAuth web client** and add this Authorized redirect URI:

```text
https://YOUR-APP.REGION.azurecontainerapps.io/api/google/callback
```

It must match the value you entered for `GOOGLE_OAUTH_REDIRECT_URI` exactly: same hostname, HTTPS, and path, with no trailing slash. Keep `http://localhost:5000/api/google/callback` if you still use local development.

## 8. Verify the deployment

1. In the Azure Portal, open the Container App and confirm the latest revision is running.
2. Open the app URL in a browser and check that `/health` returns `{"ok":true}`.
3. Trigger a chat request from the Vercel app and confirm it uses the Azure backend.
4. Try Google Calendar connect from Profile and confirm the redirect returns to the profile page.
5. Open **Log stream** in the Container App if something does not start correctly.

## 9. Updating later

When the code changes, update the container image in your deployment workflow, then return to the Azure Portal and open the latest revision if you need to confirm the rollout. If you change secrets or environment variables, save the changes and restart or create a new revision so the container picks them up.
