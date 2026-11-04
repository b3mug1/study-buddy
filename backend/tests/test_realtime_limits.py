from uuid import UUID

from app import realtime


def test_realtime_connections_are_bounded_per_user_and_globally(monkeypatch) -> None:
    monkeypatch.setattr(realtime, "MAX_ACTIVE_SOCKETS", 2)
    monkeypatch.setattr(realtime, "MAX_SOCKETS_PER_USER", 1)
    realtime._active_sockets.clear()
    first = UUID("00000000-0000-0000-0000-000000000001")
    second = UUID("00000000-0000-0000-0000-000000000002")
    third = UUID("00000000-0000-0000-0000-000000000003")
    try:
        assert realtime._reserve_socket(first)
        assert not realtime._reserve_socket(first)
        assert realtime._reserve_socket(second)
        assert not realtime._reserve_socket(third)
        realtime._release_socket(first)
        assert realtime._reserve_socket(third)
    finally:
        realtime._active_sockets.clear()
