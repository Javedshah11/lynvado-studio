from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.transcription import (
    TranscriptionResult,
    TranscriptionSegment,
    get_transcriber,
)


class FakeTranscriber:
    def transcribe(self, audio_path: Path, language: str | None) -> TranscriptionResult:
        assert audio_path.read_bytes() == b"wave-data"
        assert language == "en"
        return TranscriptionResult(
            language="en",
            language_probability=0.99,
            duration_ms=1500,
            segments=[
                TranscriptionSegment(
                    start_ms=100,
                    end_ms=1400,
                    text="Hello from Lynvado.",
                    confidence=0.95,
                )
            ],
        )


def test_transcription_endpoint() -> None:
    app.dependency_overrides[get_transcriber] = lambda: FakeTranscriber()
    client = TestClient(app)

    try:
        response = client.post(
            "/v1/transcriptions",
            files={"file": ("audio.wav", b"wave-data", "audio/wav")},
            data={"language": "en"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "language": "en",
        "language_probability": 0.99,
        "duration_ms": 1500,
        "segments": [
            {
                "start_ms": 100,
                "end_ms": 1400,
                "text": "Hello from Lynvado.",
                "confidence": 0.95,
            }
        ],
    }
