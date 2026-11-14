"""Optional LLM call (Anthropic). Returns None on ANY problem so callers fall back to deterministic output.

Config (server-side env only, never in the web app):
  LLM_PROVIDER=anthropic   enable LLM calls (anything else, or unset = rules/template only)
  ANTHROPIC_API_KEY=...    read by the SDK
  LLM_MODEL=...            default claude-haiku-5-5 (low cost, structured output); team decision 14 Nov
Cost controls: one call per explicit submit, low effort, bounded max_tokens, 1 retry, short TTL cache.
Raw user text is never logged.
"""
import hashlib
import json
import logging
import os
import time

log = logging.getLogger("reloop.ai")

DEFAULT_MODEL = "claude-haiku-5-5"
# Server-side refusal fallback exists only for these models; Haiku has none, so we must not send it.
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1"}
TIMEOUT_S = 25
MAX_TOKENS = 4000
CACHE_TTL_S = 120
_cache: dict[str, tuple[float, dict]] = {}


def enabled() -> bool:
    return os.getenv("LLM_PROVIDER", "").strip().lower() == "anthropic"


def model() -> str:
    return os.getenv("LLM_MODEL", "").strip() or DEFAULT_MODEL


def call_json(system: str, user_payload: dict, schema: dict) -> dict | None:
    """One structured-output call. Returns the parsed JSON object or None."""
    if not enabled():
        return None
    payload = json.dumps(user_payload, sort_keys=True, ensure_ascii=False, default=str)
    key = hashlib.sha256((model() + system + payload).encode()).hexdigest()
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_S:
        return hit[1]
    try:
        import anthropic
        client = anthropic.Anthropic(timeout=TIMEOUT_S, max_retries=1)
        kwargs = dict(
            model=model(),
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": payload}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
        )
        if model() in FALLBACK_MODELS:
            # server-side fallback model on a policy decline
            resp = client.beta.messages.create(**kwargs, betas=["server-side-fallback-2026-07-01"],
                                               fallbacks="default")
        else:
            resp = client.messages.create(**kwargs)
        if resp.stop_reason != "end_turn":
            log.warning("LLM stopped with %s; using fallback", resp.stop_reason)
            return None
        text = next(b.text for b in resp.content if b.type == "text")
        data = json.loads(text)
    except Exception as e:  # noqa: BLE001 - any failure means "use the deterministic path"
        log.warning("LLM call failed (%s); using fallback", type(e).__name__)
        return None
    _cache[key] = (time.time(), data)
    return data


def clear_cache():
    _cache.clear()
