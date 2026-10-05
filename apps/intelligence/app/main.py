from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel


class RootResponse(BaseModel):
    name: str
    description: str
    version: str
    status: Literal["running"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["lynvado-intelligence"]
    version: str


app = FastAPI(
    title="Lynvado Studio Intelligence",
    description=(
        "AI and video intelligence service "
        "for Lynvado Studio."
    ),
    version="0.1.0",
)


@app.get(
    "/",
    response_model=RootResponse,
)
async def root() -> RootResponse:
    return RootResponse(
        name="Lynvado Studio Intelligence",
        description=(
            "AI and video intelligence service "
            "for Lynvado Studio."
        ),
        version="0.1.0",
        status="running",
    )


@app.get(
    "/health",
    response_model=HealthResponse,
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="lynvado-intelligence",
        version="0.1.0",
    )