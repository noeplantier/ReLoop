"""Pydantic models for the AI endpoints (docs/API_CONTRACT_REVIEW.md, D5 and D6)."""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

Category = Literal["tables", "chairs", "lighting", "signage", "staging"]
Condition = Literal["fair", "good", "excellent"]

MAX_TEXT_CHARS = 1000


# ---------- /parse-request ----------

class ParseContext(BaseModel):
    today: Optional[date] = None          # used to fill a missing year; defaults to the server date


class ParseIn(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_CHARS)
    context: Optional[ParseContext] = None


class Need(BaseModel):
    category: Category
    quantity: int = Field(gt=0, le=100000)
    label: str                             # the user's own words, e.g. "stage lights"


class ParsedLocation(BaseModel):
    place_text: Optional[str] = None       # what the user wrote
    preset_id: Optional[str] = None        # only set when it matches a labelled preset
    preset_label: Optional[str] = None
    lat: Optional[float] = None            # only from the preset list, never guessed
    lon: Optional[float] = None


class ParsedRequirements(BaseModel):
    min_condition: Optional[Condition] = None
    max_distance_km: Optional[float] = Field(default=None, gt=0, le=1000)


class ParseOut(BaseModel):
    needs: list[Need]
    start_date: Optional[date]
    end_date: Optional[date]
    location: ParsedLocation
    requirements: ParsedRequirements
    missing_fields: list[Literal["needs", "dates", "location"]]
    warnings: list[str]
    parser: Literal["llm", "rules"]


# ---------- /explain ----------

class ExplainRequestCtx(BaseModel):
    """The /match body the client sent (plus the user's label for the need)."""
    category: Category
    quantity: int = Field(gt=0)
    start_date: date
    end_date: date
    label: Optional[str] = None


class SupplierFacts(BaseModel):
    id: str
    name: str
    city: str


class ImpactFacts(BaseModel):
    avoided_kgco2e: Optional[float] = None
    status: Literal["sourced", "illustrative", "unavailable"]
    assumptions: list[str] = []


class MatchFacts(BaseModel):
    """Subset of backend MatchOut that explanations may use. Extra fields are ignored."""
    item_id: str
    name: str
    supplier: SupplierFacts
    reuse_mode: str
    condition: str
    available_quantity: int
    quoted_quantity: int
    covers_quantity: bool
    distance_km: float
    unit_price_per_day_try: Optional[float] = None
    estimated_cost_try: Optional[float] = None
    score: float
    breakdown: dict
    impact: ImpactFacts


class ExplainIn(BaseModel):
    request: ExplainRequestCtx
    matches: list[MatchFacts] = Field(max_length=10)


class Explanation(BaseModel):
    item_id: str
    summary: str
    reasons: list[str]
    things_to_check: list[str]
    avoided_kgco2e: Optional[float]        # copied from the engine, never generated
    impact_status: Literal["sourced", "illustrative", "unavailable"]
    source: Literal["llm", "template"]


class ExplainOut(BaseModel):
    explanations: list[Explanation]
    explainer: Literal["llm", "template"]
