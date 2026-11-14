from ai import llm, service
from ai.explain import check_grounded
from ai.schemas import ExplainIn, ExplainRequestCtx, MatchFacts

from conftest import REQ, match


def _inp(*matches, **req):
    return ExplainIn(request={**REQ, **req}, matches=list(matches))


def test_template_full_match_uses_only_engine_numbers():
    out = service.explain(_inp(match()))
    e = out.explanations[0]
    assert out.explainer == "template" and e.source == "template"
    text = " ".join([e.summary, *e.reasons])
    assert "all 50 chairs" in text and "1,800 TRY" in text and "3 days" in text
    assert "Illustrative estimate" in text and "95.6–956 kgCO2e" in text
    assert e.avoided_kgco2e == 956.02 and e.avoided_kgco2e_conservative == 95.6
    assert e.impact_status == "illustrative"
    assert check_grounded(text, MatchFacts(**match()), ExplainRequestCtx(**REQ))


def test_template_partial_match_says_missing():
    m = match(available_quantity=40, quoted_quantity=40, covers_quantity=False, estimated_cost_try=1440.0)
    e = service.explain(_inp(m)).explanations[0]
    assert "40 of 50" in e.summary and "10 are still missing" in e.summary
    assert "where to get the missing units" in e.things_to_check


def test_template_free_loan_and_no_impact():
    m = match(reuse_mode="loan", unit_price_per_day_try=None, estimated_cost_try=None,
              impact={"avoided_kgco2e": None, "status": "unavailable", "assumptions": []})
    e = service.explain(_inp(m)).explanations[0]
    text = " ".join(e.reasons)
    assert "No rental price" in text and "kgCO2e" not in text


def test_grounding_rejects_invented_numbers_and_claims():
    m, r = MatchFacts(**match()), ExplainRequestCtx(**REQ)
    assert check_grounded("Covers all 50 chairs at 1,800 TRY, 0.0 km away.", m, r)
    assert not check_grounded("Saves you 2,500 TRY compared with buying.", m, r)
    assert not check_grounded("Avoids 95.6–956 kgCO2e.", m, r)                # not framed as estimate
    assert not check_grounded("An illustrative estimate of 956 kgCO2e avoided.", m, r)  # upper bound alone
    assert check_grounded("An illustrative estimate of 95.6–956 kgCO2e avoided.", m, r)
    assert check_grounded("An illustrative estimate of 96 to 956 kgCO2e avoided.", m, r)
    assert not check_grounded("Verified supplier with 50 chairs.", m, r)


def _fake_llm(monkeypatch, data):
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-used")
    monkeypatch.setattr(llm, "call_json", lambda *a, **k: data)


def test_llm_text_used_when_grounded(monkeypatch):
    _fake_llm(monkeypatch, {"explanations": [{
        "item_id": match()["item_id"],
        "summary": "These excellent banquet chairs cover all 50 chairs at your venue.",
        "reasons": ["They are 0.0 km away.", "Estimated rental is 1,800 TRY for 3 days."]}]})
    out = service.explain(_inp(match()))
    assert out.explainer == "llm" and out.explanations[0].source == "llm"
    assert out.explanations[0].avoided_kgco2e == 956.02          # always from the engine


def test_llm_hallucinated_number_replaced_by_template(monkeypatch):
    _fake_llm(monkeypatch, {"explanations": [{
        "item_id": match()["item_id"], "summary": "Great deal: 30% cheaper than buying new.",
        "reasons": ["Cheap."]}]})
    out = service.explain(_inp(match()))
    assert out.explainer == "template" and "30%" not in out.explanations[0].summary


def test_llm_partial_match_must_say_so(monkeypatch):
    m = match(available_quantity=40, quoted_quantity=40, covers_quantity=False, estimated_cost_try=1440.0)
    _fake_llm(monkeypatch, {"explanations": [{
        "item_id": m["item_id"], "summary": "Good chairs nearby.", "reasons": ["Excellent condition."]}]})
    assert service.explain(_inp(m)).explanations[0].source == "template"


def test_llm_failure_and_unknown_ids(monkeypatch):
    _fake_llm(monkeypatch, None)
    assert service.explain(_inp(match())).explainer == "template"
    _fake_llm(monkeypatch, {"explanations": [{"item_id": "other", "summary": "x", "reasons": ["y"]}]})
    assert service.explain(_inp(match())).explainer == "template"


def test_empty_matches():
    out = service.explain(_inp())
    assert out.explanations == [] and out.explainer == "template"
