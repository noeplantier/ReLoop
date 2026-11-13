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
    max_distance_km: Optional[float] = Field(default=None, gt=0)


class MatchRequest(BaseModel):
    request_id: Optional[str] = None
    category: Category
    quantity: int = Field(gt=0)
    start_date: date
    end_date: date
    location: Location
    requirements: Optional[Requirements] = None

    @model_validator(mode="after")
    def _dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class SupplierOut(BaseModel):
    id: str
    name: str
    city: str


class Impact(BaseModel):
    avoided_kgco2e: Optional[float]
    status: Literal["sourced", "illustrative", "unavailable"]
    assumptions: list[str]


class MatchOut(BaseModel):
    item_id: str
    name: str
    supplier: SupplierOut
    reuse_mode: str
    condition: str
    available_quantity: int
    quoted_quantity: int
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


class MatchResponse(BaseModel):
    request_id: Optional[str]
    days: int
    total_options: int
    matches: list[MatchOut]
    suggestions: list[Suggestion]


class Selection(BaseModel):
    item_id: str
    quantity: int = Field(gt=0)
    start_date: date
    end_date: date
    location: Location


class SummaryRequest(BaseModel):
    selections: list[Selection] = Field(min_length=1)


class SummaryResponse(BaseModel):
    reused_units: int
    total_distance_km: float
    estimated_cost_try: Optional[float]
    avoided_kgco2e: Optional[float]
    impact_status: Literal["sourced", "illustrative", "unavailable"]
    assumptions: list[str]
