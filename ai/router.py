"""FastAPI router for the AI layer. Backend integration (Atay): app.include_router(ai_router)."""
from datetime import date

from fastapi import APIRouter

from . import service
from .schemas import ExplainIn, ExplainOut, ParseIn, ParseOut

router = APIRouter(tags=["ai"])


@router.post("/parse-request", response_model=ParseOut)
def parse_request(body: ParseIn):
    today = body.context.today if body.context and body.context.today else date.today()
    return service.parse(body.text, today)


@router.post("/explain", response_model=ExplainOut)
def explain(body: ExplainIn):
    return service.explain(body)
