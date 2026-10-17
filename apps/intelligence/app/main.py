from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.transcription import WhisperTranscriber, get_transcriber


class RootResponse(BaseModel):
    name: str
    description: str
    version: str
    status: Literal["running"]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["lynvado-intelligence"]
    version: str


class TranscriptSegmentResponse(BaseModel):
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None


class TranscriptionResponse(BaseModel):
    language: str | None
    language_probability: float | None
    duration_ms: int
    segments: list[TranscriptSegmentResponse]


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


@app.post("/v1/transcriptions", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: Annotated[UploadFile, File()],
    language: Annotated[str | None, Form()] = None,
    transcriber: WhisperTranscriber = Depends(get_transcriber),
) -> TranscriptionResponse:
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"

    with NamedTemporaryFile(suffix=suffix, delete=False) as temporary:
        temporary_path = Path(temporary.name)
        while chunk := await file.read(1024 * 1024):
            temporary.write(chunk)

    try:
        result = await run_in_threadpool(
            transcriber.transcribe,
            temporary_path,
            language,
        )
        return TranscriptionResponse(
            language=result.language,
            language_probability=result.language_probability,
            duration_ms=result.duration_ms,
            segments=[
                TranscriptSegmentResponse(
                    start_ms=segment.start_ms,
                    end_ms=segment.end_ms,
                    text=segment.text,
                    confidence=segment.confidence,
                )
                for segment in result.segments
            ],
        )
    finally:
        temporary_path.unlink(missing_ok=True)
