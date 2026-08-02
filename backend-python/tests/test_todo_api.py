"""Mirror-style tests for the todo list REST layer (no Quarkus equivalent
exists; this module is Python-only, so the tests follow the recipe suite's
conventions instead)."""

import copy

VALID_ITEM = {
    "title": "Buy groceries",
    "dueDate": None,
    "done": False,
    "sortOrder": 0,
}


def item(**overrides) -> dict:
    body = copy.deepcopy(VALID_ITEM)
    body.update(overrides)
    return body


def create_item(client, body: dict) -> int:
    response = client.post("/api/todo-items", json=body)
    assert response.status_code == 200
    return response.json()["id"]


def test_create_and_list_todo_item(client):
    response = client.post("/api/todo-items", json=VALID_ITEM)
    assert response.status_code == 200
    created = response.json()
    assert created["title"] == "Buy groceries"
    assert created["dueDate"] is None
    assert created["done"] is False
    assert created["sortOrder"] == 0
    assert created["createdAt"] is not None
    assert created["updatedAt"] is not None

    response = client.get("/api/todo-items")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    listed = body[0]
    assert listed["id"] == created["id"]
    assert listed["title"] == created["title"]
    assert listed["dueDate"] == created["dueDate"]
    assert listed["done"] == created["done"]
    assert listed["sortOrder"] == created["sortOrder"]
    assert listed["createdAt"] == created["createdAt"]
    assert listed["updatedAt"] == created["updatedAt"]


def test_list_todo_items_empty(client):
    response = client.get("/api/todo-items")
    assert response.status_code == 200
    assert response.json() == []


def test_create_todo_item_blank_title_rejected(client):
    response = client.post("/api/todo-items", json=item(title=""))
    assert response.status_code == 400


def test_create_todo_item_defaults(client):
    response = client.post("/api/todo-items", json={"title": "Wash car"})
    assert response.status_code == 200
    body = response.json()
    assert body["done"] is False
    assert body["sortOrder"] == 0
    assert body["dueDate"] is None


def test_create_todo_item_with_due_date(client):
    response = client.post("/api/todo-items", json=item(dueDate="2026-08-15"))
    assert response.status_code == 200
    item_id = response.json()["id"]

    response = client.get("/api/todo-items")
    body = response.json()
    listed = next(i for i in body if i["id"] == item_id)
    assert listed["dueDate"] == "2026-08-15"


def test_create_todo_item_without_due_date(client):
    response = client.post("/api/todo-items", json=item())
    assert response.status_code == 200
    assert response.json()["dueDate"] is None


def test_update_todo_item(client):
    item_id = create_item(client, VALID_ITEM)

    response = client.put(
        f"/api/todo-items/{item_id}",
        json=item(done=True, dueDate="2026-09-01"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["done"] is True
    assert body["dueDate"] == "2026-09-01"

    response = client.get("/api/todo-items")
    listed = response.json()[0]
    assert listed["done"] is True
    assert listed["dueDate"] == "2026-09-01"


def test_update_todo_item_not_found(client):
    response = client.put("/api/todo-items/999999", json=VALID_ITEM)
    assert response.status_code == 404
    assert response.json() == {
        "title": "Not Found",
        "detail": "TodoItem with id '999999' not found",
        "status": 404,
    }


def test_delete_todo_item(client):
    item_id = create_item(client, VALID_ITEM)

    assert client.delete(f"/api/todo-items/{item_id}").status_code == 204
    body = client.get("/api/todo-items").json()
    assert all(i["id"] != item_id for i in body)


def test_delete_todo_item_not_found(client):
    assert client.delete("/api/todo-items/999999").status_code == 404


def test_delete_done_removes_only_done(client):
    create_item(client, item(title="A", done=True))
    create_item(client, item(title="B", done=True))
    create_item(client, item(title="C", done=False))

    response = client.delete("/api/todo-items/done")
    assert response.status_code == 204

    body = client.get("/api/todo-items").json()
    assert len(body) == 1
    assert body[0]["title"] == "C"


def test_delete_done_when_none_done(client):
    create_item(client, item(title="A", done=False))
    create_item(client, item(title="B", done=False))

    response = client.delete("/api/todo-items/done")
    assert response.status_code == 204

    body = client.get("/api/todo-items").json()
    assert len(body) == 2


def test_delete_done_route_precedes_id_route(client):
    """Regression test: /done must be registered before /{item_id}, else
    FastAPI would try (and fail) to parse "done" as an int path param."""
    response = client.delete("/api/todo-items/done")
    assert response.status_code == 204


def test_list_ordering_by_sort_order_then_id(client):
    first_id = create_item(client, item(title="First", sortOrder=0))
    second_id = create_item(client, item(title="Second", sortOrder=0))
    create_item(client, item(title="Third", sortOrder=5))

    body = client.get("/api/todo-items").json()
    ids = [i["id"] for i in body]
    assert ids == [first_id, second_id, ids[2]]
    assert [i["title"] for i in body] == ["First", "Second", "Third"]
