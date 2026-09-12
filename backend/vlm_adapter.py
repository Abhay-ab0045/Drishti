"""
vlm_adapter.py — Drishti VLM Action Planner

CRITICAL ARCHITECTURAL NOTE:
This adapter receives screenshots that have ALREADY been processed by the on-device
Phase 3 PII Detection and Phase 4 Redaction Engine. Sensitive regions (faces, Aadhaar,
PAN, passwords, etc.) are pixel-blacked-out BEFORE the image ever reaches this adapter.

This module's sole responsibility is action planning on redacted visual context.
It must NEVER speculate about, infer, or attempt to reconstruct content beneath
redacted (blacked-out) regions.
"""

import os
import json
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("drishti.vlm")

# Verified model string from https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
VLM_MODEL = "gemini-3.1-flash-lite"

SYSTEM_PROMPT = """You are a UI action planner for the Drishti privacy-preserving browser agent.

CRITICAL CONSTRAINTS:
1. The screenshot you are analyzing has already been processed by an on-device redaction engine.
   Black rectangular regions indicate where sensitive data (personal IDs, faces, passwords,
   financial details) has been masked BEFORE this image was sent to you.
2. You must NEVER speculate about, guess, infer, or describe what might exist beneath a
   blacked-out region. Treat all redacted areas as opaque and irrelevant to your task.
3. Your ONLY job is to understand the visible page structure and layout, then identify
   the next logical UI action toward the stated user goal.
4. For any form field that appears to require sensitive user input (name, ID number, date
   of birth, address, etc.), your 'value' must always be "[USER_INPUT_REQUIRED]" —
   never invent or guess actual values.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object matching this schema:
{
  "action": "click" | "type" | "scroll" | "navigate" | "wait" | "respond",
  "target": {
    "selector": "<CSS selector or null if unknown>",
    "text_hint": "<visible text label or description of the UI element>"
  },
  "value": "<string for type actions, null otherwise>",
  "confidence": <float between 0.0 and 1.0>,
  "reasoning": "<short natural-language justification shown to the user before execution>"
}

Do not include any text outside the JSON object. Do not include markdown code fences.
"""


def plan_next_action(
    image_bytes: bytes,
    task_goal: str,
    mime_type: str = "image/jpeg",
) -> dict:
    """
    Analyze an already-redacted screenshot and plan the next UI action toward task_goal.

    Args:
        image_bytes: Raw image bytes of the redacted screenshot.
        task_goal: Natural-language description of what the user wants to accomplish.
        mime_type: MIME type of the image (default: image/jpeg).

    Returns:
        A dict matching the ActionPlanResponse schema, or an error dict on failure.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY is not set — cannot call VLM.")
        return {
            "action": "respond",
            "target": None,
            "value": None,
            "confidence": 0.0,
            "reasoning": "VLM action planning is unavailable: GEMINI_API_KEY is not configured on the server.",
        }

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)

        user_message = (
            f"Task goal: {task_goal}\n\n"
            "The screenshot above shows the current browser state. "
            "Redacted (blacked-out) regions contain masked sensitive data — do not speculate about them. "
            "Analyze the visible layout and return the next action as a JSON object."
        )

        response = client.models.generate_content(
            model=VLM_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        types.Part.from_text(text=user_message),
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        parsed = json.loads(raw_text)

        # Ensure required fields exist with safe defaults
        return {
            "action": parsed.get("action", "respond"),
            "target": parsed.get("target"),
            "value": parsed.get("value"),
            "confidence": float(parsed.get("confidence", 0.5)),
            "reasoning": parsed.get("reasoning", "No reasoning provided."),
        }

    except json.JSONDecodeError as e:
        logger.error("VLM returned non-JSON response: %s", e)
        return {
            "action": "respond",
            "target": None,
            "value": None,
            "confidence": 0.0,
            "reasoning": f"VLM returned an unparseable response. Please try again. (JSONDecodeError: {e})",
        }
    except Exception as e:
        logger.exception("Unexpected error calling VLM: %s", e)
        return {
            "action": "respond",
            "target": None,
            "value": None,
            "confidence": 0.0,
            "reasoning": f"VLM call failed: {e}",
        }
