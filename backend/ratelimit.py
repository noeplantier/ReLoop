"""Request limits for the public API: protects a free server and any paid AI budget.

In-memory, per process (one Render instance is enough for a hackathon demo; a restart resets it).
  - per client IP, sliding 60 s window: general POSTs, the optimiser, and the AI routes separately
  - a GLOBAL cap per UTC day on AI requests (hard ceiling on paid LLM calls, whoever calls)
  - a maximum request body size
All limits come from env vars, so they can be tightened on Render without a deploy of new code.
"""
import os
import threading
import time
from collections import defaultdict, deque

AI_PATHS = ("/parse-request", "/explain")
HEAVY_PATHS = ("/match/batch",)


def _int(name, default):
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


class Limits:
    def __init__(self):
        self.per_min = _int("RATE_LIMIT_PER_MIN", 60)          # /match, /impact/summary, ...
        self.heavy_per_min = _int("HEAVY_RATE_LIMIT_PER_MIN", 10)  # /match/batch (MILP)
        self.ai_per_min = _int("AI_RATE_LIMIT_PER_MIN", 10)    # /parse-request, /explain per IP
        self.ai_per_day = _int("AI_DAILY_LIMIT", 300)          # all clients together, per UTC day
        self.max_body = _int("MAX_BODY_BYTES", 64 * 1024)
        self._hits = defaultdict(deque)                        # (bucket, ip) -> timestamps
        self._day, self._ai_today = None, 0
        self._lock = threading.Lock()

    def reset(self):
        with self._lock:
            self._hits.clear()
            self._day, self._ai_today = None, 0

    def check(self, path, ip, now=None):
        """None if allowed, else (http_status, message)."""
        now = time.time() if now is None else now
        if path in AI_PATHS:
            bucket, limit = "ai", self.ai_per_min
        elif path in HEAVY_PATHS:
            bucket, limit = "heavy", self.heavy_per_min
        else:
            bucket, limit = "general", self.per_min
        with self._lock:
            q = self._hits[(bucket, ip)]
            while q and now - q[0] >= 60:
                q.popleft()
            if len(q) >= limit:
                return 429, f"Too many requests: limit is {limit} per minute. Please wait a moment."
            if bucket == "ai":
                day = time.strftime("%Y-%m-%d", time.gmtime(now))
                if day != self._day:
                    self._day, self._ai_today = day, 0
                if self._ai_today >= self.ai_per_day:
                    return 429, "The AI assistant has reached today's limit. You can still fill in the request manually."
                self._ai_today += 1
            q.append(now)
        return None

    def ai_used_today(self):
        return self._ai_today if self._day == time.strftime("%Y-%m-%d", time.gmtime()) else 0


def client_ip(request):
    """The client address used for per-IP limits.

    X-Forwarded-For is a list that every proxy APPENDS to. Its first entries come from the client itself
    and can be forged (found on the deployed API, 15 Nov: a fake first entry bypassed the per-IP limit).
    Only the entries added by our own proxies can be trusted, i.e. the last TRUSTED_PROXY_HOPS of them;
    the client address is the entry just before those, counted from the right.
    TRUSTED_PROXY_HOPS = number of proxies in front of the app that append to the header (Render: 1).
    """
    hops = max(_int("TRUSTED_PROXY_HOPS", 1), 0)
    fwd = request.headers.get("x-forwarded-for")
    if fwd and hops:
        entries = [e.strip() for e in fwd.split(",") if e.strip()]
        if len(entries) >= hops:
            return entries[-hops]
    return request.client.host if request.client else "unknown"
