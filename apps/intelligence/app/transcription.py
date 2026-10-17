import math
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from faster_whisper import WhisperModel


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
        self.model = WhisperModel(
            os.getenv("WHISPER_MODEL", "small"),
            device=os.getenv("WHISPER_DEVICE", "auto"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        )

    def transcribe(self, audio_path: Path, language: str | None) -> TranscriptionResult:
        segments, info = self.model.transcribe(
            str(audio_path),
            language=language,
            vad_filter=True,
            beam_size=5,
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
    return WhisperTranscriber()
