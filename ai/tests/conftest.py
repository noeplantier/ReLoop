import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))                 # import ai.*
sys.path.insert(0, str(ROOT / "backend"))     # integration test imports Atay's main.py

# Tests never call a real LLM or Supabase.
os.environ["LLM_PROVIDER"] = "none"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""


@pytest.fixture(autouse=True)
def _fresh_llm_cache():
    from ai import llm
    llm.clear_cache()
    yield
    llm.clear_cache()


def match(**over):
    """A MatchOut-shaped dict with the values the engine returns for the demo (50 chairs, Lara)."""
    m = {
        "item_id": "b0000000-0000-4000-8000-000000000001",
        "name": "Stackable banquet chairs",
        "supplier": {"id": "a0000000-0000-4000-8000-000000000001",
                     "name": "Demo Lara Event Hall (fictional)", "city": "Antalya"},
        "reuse_mode": "rental", "condition": "excellent",
        "available_quantity": 150, "quoted_quantity": 50, "covers_quantity": True,
        "distance_km": 0.0, "unit_price_per_day_try": 12.0, "estimated_cost_try": 1800.0,
        "score": 0.92,
        "breakdown": {"distance_score": 1.0, "condition_score": 1.0, "price_score": 0.6,
                      "weights": {"distance": 0.5, "condition": 0.3, "price": 0.2}},
        "explanation": None,
        "impact": {"avoided_kgco2e": 956.02, "avoided_kgco2e_conservative": 95.6, "transport_kgco2e": 0.0,
                   "status": "illustrative", "assumptions": ["..."]},
    }
    m.update(over)
    return m


REQ = {"category": "chairs", "quantity": 50, "start_date": "2026-11-21", "end_date": "2026-11-23",
       "label": "chairs"}
