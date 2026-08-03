"""Mirror-style tests for the calendar REST layer (no Quarkus equivalent
exists; this module is Python-only, so the tests follow the recipe suite's
conventions instead)."""

import copy

VALID_EVENT = {
    "title": "Dentist",
    "person": "KUBA",
    "eventDate": "2026-08-10",
    "eventTime": None,
    "note": None,
}


def event(**overrides) -> dict:
    body = copy.deepcopy(VALID_EVENT)
    body.update(overrides)
    return body


def create_event(client, body: dict) -> int:
    response = client.post("/api/calendar-events", json=body)
    assert response.status_code == 200
    return response.json()["id"]


def test_create_and_list_calendar_event(client):
    response = client.post("/api/calendar-events", json=VALID_EVENT)
    assert response.status_code == 200
    created = response.json()
    assert created["title"] == "Dentist"
    assert created["person"] == "KUBA"
    assert created["eventDate"] == "2026-08-10"
    assert created["eventTime"] is None
    assert created["note"] is None
    assert created["createdAt"] is not None
    assert created["updatedAt"] is not None

    response = client.get("/api/calendar-events")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    listed = body[0]
    assert listed["id"] == created["id"]
    assert listed["title"] == created["title"]
    assert listed["person"] == created["person"]
    assert listed["eventDate"] == created["eventDate"]
    assert listed["eventTime"] == created["eventTime"]
    assert listed["note"] == created["note"]
    assert listed["createdAt"] == created["createdAt"]
    assert listed["updatedAt"] == created["updatedAt"]


def test_list_calendar_events_empty(client):
    response = client.get("/api/calendar-events")
    assert response.status_code == 200
    assert response.json() == []


def test_create_calendar_event_blank_title_rejected(client):
    response = client.post("/api/calendar-events", json=event(title=""))
    assert response.status_code == 400


def test_create_calendar_event_invalid_person_rejected(client):
    response = client.post("/api/calendar-events", json=event(person="MOM"))
    assert response.status_code == 400


def test_create_calendar_event_without_person_is_valid(client):
    body = event()
    del body["person"]
    response = client.post("/api/calendar-events", json=body)
    assert response.status_code == 200
    assert response.json()["person"] is None


def test_create_calendar_event_null_person_is_valid(client):
    response = client.post("/api/calendar-events", json=event(person=None))
    assert response.status_code == 200
    assert response.json()["person"] is None


def test_create_calendar_event_missing_event_date_rejected(client):
    body = event()
    del body["eventDate"]
    response = client.post("/api/calendar-events", json=body)
    assert response.status_code == 400


def test_create_calendar_event_with_event_time(client):
    response = client.post("/api/calendar-events", json=event(eventTime="14:30:00"))
    assert response.status_code == 200
    event_id = response.json()["id"]

    response = client.get("/api/calendar-events")
    body = response.json()
    listed = next(e for e in body if e["id"] == event_id)
    assert listed["eventTime"] == "14:30:00"


def test_create_calendar_event_without_event_time(client):
    response = client.post("/api/calendar-events", json=event())
    assert response.status_code == 200
    assert response.json()["eventTime"] is None


def test_create_calendar_event_for_each_person(client):
    for person in ("KUBA", "PETA", "BOTH"):
        response = client.post("/api/calendar-events", json=event(title=person, person=person))
        assert response.status_code == 200
        assert response.json()["person"] == person

    body = client.get("/api/calendar-events").json()
    assert len(body) == 3
    assert {e["person"] for e in body} == {"KUBA", "PETA", "BOTH"}


def test_update_calendar_event(client):
    event_id = create_event(client, VALID_EVENT)

    response = client.put(
        f"/api/calendar-events/{event_id}",
        json=event(
            title="Doctor",
            person="PETA",
            eventDate="2026-09-01",
            eventTime="10:00:00",
            note="Bring insurance card",
        ),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Doctor"
    assert body["person"] == "PETA"
    assert body["eventDate"] == "2026-09-01"
    assert body["eventTime"] == "10:00:00"
    assert body["note"] == "Bring insurance card"

    response = client.get("/api/calendar-events")
    listed = response.json()[0]
    assert listed["title"] == "Doctor"
    assert listed["person"] == "PETA"
    assert listed["eventDate"] == "2026-09-01"
    assert listed["eventTime"] == "10:00:00"
    assert listed["note"] == "Bring insurance card"


def test_update_calendar_event_not_found(client):
    response = client.put("/api/calendar-events/999999", json=VALID_EVENT)
    assert response.status_code == 404
    assert response.json() == {
        "title": "Not Found",
        "detail": "CalendarEvent with id '999999' not found",
        "status": 404,
    }


def test_delete_calendar_event(client):
    event_id = create_event(client, VALID_EVENT)

    assert client.delete(f"/api/calendar-events/{event_id}").status_code == 204
    body = client.get("/api/calendar-events").json()
    assert all(e["id"] != event_id for e in body)


def test_delete_calendar_event_not_found(client):
    assert client.delete("/api/calendar-events/999999").status_code == 404


def test_list_ordering_by_date_then_null_time_first_then_id(client):
    # A: 2026-08-10, no time
    a_id = create_event(client, event(title="A", eventDate="2026-08-10", eventTime=None))
    # B: 2026-08-10, 09:00
    b_id = create_event(client, event(title="B", eventDate="2026-08-10", eventTime="09:00:00"))
    # C: 2026-08-10, no time (created after A, higher id)
    c_id = create_event(client, event(title="C", eventDate="2026-08-10", eventTime=None))
    # D: 2026-08-09, 23:00
    d_id = create_event(client, event(title="D", eventDate="2026-08-09", eventTime="23:00:00"))

    body = client.get("/api/calendar-events").json()
    ids = [e["id"] for e in body]
    assert ids == [d_id, a_id, c_id, b_id]
    assert [e["title"] for e in body] == ["D", "A", "C", "B"]
