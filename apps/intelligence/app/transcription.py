import math
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import av
from fastapi import HTTPException
from faster_whisper import WhisperModel


# faster-whisper 1.2.1 passes metadata_errors to av.open, but PyAV 19
# removed that keyword. Keep decoding local and compatible until the upstream
# call is updated.
_av_open = av.open


def _compatible_av_open(*args: Any, **kwargs: Any) -> Any:
    kwargs.pop("metadata_errors", None)
    return _av_open(*args, **kwargs)


av.open = _compatible_av_open


@dataclass(frozen=True)
class TranscriptionSegment:
    start_ms: int
    end_ms: int
    text: str
    confidence: float | None


@dataclass(frozen=True)
class TranscriptionResult:
    language: str | None
    language_probability: float | None
    duration_ms: int
    segments: list[TranscriptionSegment]


class WhisperTranscriber:
    def __init__(self) -> None:
        configured_model = os.getenv("WHISPER_MODEL", "base")
        models_directory = Path(__file__).resolve().parents[1] / "models"
        bundled_model = models_directory / configured_model
        default_local_model = models_directory / "faster-whisper-base.en"
        if bundled_model.is_dir():
            model = str(bundled_model)
        elif default_local_model.is_dir():
            model = str(default_local_model)
        else:
            model = configured_model
        self.model = WhisperModel(
            model,
            device=os.getenv("WHISPER_DEVICE", "auto"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        )

    def transcribe(self, audio_path: Path, language: str | None) -> TranscriptionResult:
        segments, info = self.model.transcribe(
            str(audio_path),
            language=language,
            vad_filter=True,
            beam_size=3,
            condition_on_previous_text=False,
        )
        output: list[TranscriptionSegment] = []

        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            confidence = max(0.0, min(1.0, math.exp(segment.avg_logprob)))
            output.append(
                TranscriptionSegment(
                    start_ms=max(0, round(segment.start * 1000)),
                    end_ms=max(0, round(segment.end * 1000)),
                    text=text,
                    confidence=confidence,
                )
            )

        return TranscriptionResult(
            language=info.language,
            language_probability=info.language_probability,
            duration_ms=max(0, round(info.duration * 1000)),
            segments=output,
        )


@lru_cache(maxsize=1)
def get_transcriber() -> WhisperTranscriber:
    try:
        return WhisperTranscriber()
    except Exception as error:
        model = os.getenv("WHISPER_MODEL", "base")
        raise HTTPException(
            status_code=503,
            detail=(
                f"Whisper model '{model}' is unavailable. "
                "Download it once while connected to the internet, then retry processing."
            ),
        ) from error
