import pytest

from app.database import DatabaseError, PostgresDatabase


def test_table_names_and_columns_are_allowlisted() -> None:
    database = PostgresDatabase("00000000-0000-0000-0000-000000000001")

    with pytest.raises(DatabaseError, match="Unknown database table"):
        database.table("profiles; drop table users")
    with pytest.raises(DatabaseError, match="Invalid database column"):
        database.table("profiles").select("id; drop table users")


def test_discovery_and_message_queries_apply_user_access_predicates() -> None:
    database = PostgresDatabase("00000000-0000-0000-0000-000000000001")
    profiles = database.table("profiles").select("id, full_name").eq("is_onboarded", True)
    messages = database.table("messages").delete().eq("id", "message-id")

    profile_sql, profile_params = profiles._where_clause()
    message_sql, message_params = messages._where_clause()

    assert "show_in_discovery" in profile_sql
    assert "connections" in profile_sql
    assert "group_members" in profile_sql
    assert len(profile_params) == 7
    assert "conversation_members" in message_sql
    assert "author_id = %s" in message_sql
    assert message_params == [database.user_id] * 5 + ["message-id"]


def test_direct_message_insert_is_rejected_in_favor_of_guarded_rpc() -> None:
    database = PostgresDatabase("00000000-0000-0000-0000-000000000001")
    query = database.table("messages").insert(
        {
            "conversation_id": "conversation-id",
            "author_id": database.user_id,
            "body": "hello",
        }
    )

    with pytest.raises(DatabaseError, match="guarded conversation send operation"):
        query._validate_insert_access()
