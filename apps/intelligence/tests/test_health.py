from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root() -> None:
    response = client.get("/")

    assert response.status_code == 200

    assert response.json() == {
        "name": "Lynvado Studio Intelligence",
        "description": (
            "AI and video intelligence service "
            "for Lynvado Studio."
        ),
        "version": "0.1.0",
        "status": "running",
    }


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200

    assert response.json() == {
        "status": "ok",
        "service": "lynvado-intelligence",
        "version": "0.1.0",
    }