"""Pydantic models = the API contract (docs/API_CONTRACT.md)."""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

Category = Literal["tables", "chairs", "lighting", "signage", "staging"]
Condition = Literal["fair", "good", "excellent"]


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class Requirements(BaseModel):
    min_condition: Optional[Condition] = None
    max_distance_km: Optional[float] = Field(default=None, gt=0, le=1000)


class MatchRequest(BaseModel):
    request_id: Optional[str] = None
    category: Category
    quantity: int = Field(gt=0, le=100000)
    start_date: date
    end_date: date
    location: Location
    requirements: Optional[Requirements] = None
    # what the organiser cares most about; null = "balanced" (default weights)
    priority: Optional[Literal["balanced", "closest", "cheapest", "best_condition"]] = None

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        if (self.end_date - self.start_date).days > 60:
            raise ValueError("date range longer than 60 days")
        return self


class SupplierOut(BaseModel):
    id: str
    name: str
    city: str


class Impact(BaseModel):
    avoided_kgco2e: Optional[float]                    # UPPER bound: new items bought for this event alone
    avoided_kgco2e_conservative: Optional[float] = None  # production shared over assumed uses (illustrative)
    transport_kgco2e: Optional[float] = None           # round trip, already deducted from both bounds
    status: Literal["sourced", "illustrative", "unavailable"]
    basis: Optional[dict] = None                       # one-line meaning of each bound
    assumptions: list[str]


class MatchOut(BaseModel):
    item_id: str
    name: str
    supplier: SupplierOut
    reuse_mode: str
    condition: str
    available_quantity: int
    quoted_quantity: int
    missing_quantity: int          # requested - quoted; 0 when this option covers the request
    covers_quantity: bool
    distance_km: float
    unit_price_per_day_try: Optional[float]
    estimated_cost_try: Optional[float]
    score: float
    breakdown: dict
    explanation: Optional[str] = None
    impact: Impact


class Suggestion(BaseModel):
    type: str
    detail: str


InventorySource = Literal["supabase", "json_fallback"]


class MatchResponse(BaseModel):
    request_id: Optional[str]
    days: int
    total_options: int
    matches: list[MatchOut]
    suggestions: list[Suggestion]
    inventory_source: InventorySource        # live database or the offline fictional dataset
    cost_note: str                 # what estimated_cost_try does NOT include


class Selection(BaseModel):
    item_id: str
    quantity: int = Field(gt=0, le=100000)
    start_date: date
    end_date: date
    location: Location


class SummaryRequest(BaseModel):
    selections: list[Selection] = Field(min_length=1, max_length=50)


class SummaryResponse(BaseModel):
    reused_units: int
    total_distance_km: float
    estimated_cost_try: Optional[float]
    avoided_kgco2e: Optional[float]
    avoided_kgco2e_conservative: Optional[float] = None
    transport_kgco2e: Optional[float] = None
    impact_status: Literal["sourced", "illustrative", "unavailable"]
    assumptions: list[str]
    inventory_source: InventorySource


class BatchRequest(BaseModel):
    requests: list[MatchRequest] = Field(min_length=1, max_length=10)
    max_suppliers_per_request: int = Field(default=2, ge=1, le=5)

    @model_validator(mode="after")
    def _ids(self):
        # fill missing ids and require uniqueness: allocations are matched back by request_id
        for i, r in enumerate(self.requests, 1):
            if not r.request_id:
                r.request_id = f"req-{i}"
        ids = [r.request_id for r in self.requests]
        if len(set(ids)) != len(ids):
            raise ValueError("request_id values must be unique")
        return self


class BatchLine(BaseModel):
    item_id: str
    name: str
    supplier: str
    quantity: int
    distance_km: float


class BatchAllocation(BaseModel):
    request_id: Optional[str]
    lines: list[BatchLine]
    unmet: int


class BatchSummary(BaseModel):
    covered_requests: int
    total_requests: int
    unmet_units: int
    total_score: float
    total_distance_km: float


class MethodResult(BaseModel):
    allocations: list[BatchAllocation]
    summary: BatchSummary


class BatchComparison(BaseModel):
    greedy: MethodResult
    milp: MethodResult


class BatchResponse(BaseModel):
    allocations: list[BatchAllocation]
    comparison: BatchComparison
    note: Optional[str] = None
