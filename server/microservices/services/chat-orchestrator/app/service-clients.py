import httpx
import os

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")

async def get_user_profile(clerk_user_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{USER_SERVICE_URL}/users/{clerk_user_id}")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise