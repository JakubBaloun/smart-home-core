"""Mirror-style tests for the shopping list REST layer (no Quarkus equivalent
exists; this module is Python-only, so the tests follow the recipe suite's
conventions instead)."""

import copy

VALID_ITEM = {
    "name": "Milk",
    "quantity": "2 L",
    "checked": False,
    "sortOrder": 0,
}


def item(**overrides) -> dict:
    body = copy.deepcopy(VALID_ITEM)
    body.update(overrides)
    return body


def create_item(client, body: dict) -> int:
    response = client.post("/api/shopping-items", json=body)
    assert response.status_code == 200
    return response.json()["id"]


def test_create_and_list_shopping_item(client):
    response = client.post("/api/shopping-items", json=VALID_ITEM)
    assert response.status_code == 200
    created = response.json()
    assert created["name"] == "Milk"
    assert created["quantity"] == "2 L"
    assert created["checked"] is False
    assert created["sortOrder"] == 0
    assert created["createdAt"] is not None
    assert created["updatedAt"] is not None

    response = client.get("/api/shopping-items")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    listed = body[0]
    assert listed["id"] == created["id"]
    assert listed["name"] == created["name"]
    assert listed["quantity"] == created["quantity"]
    assert listed["checked"] == created["checked"]
    assert listed["sortOrder"] == created["sortOrder"]
    assert listed["createdAt"] == created["createdAt"]
    assert listed["updatedAt"] == created["updatedAt"]


def test_list_shopping_items_empty(client):
    response = client.get("/api/shopping-items")
    assert response.status_code == 200
    assert response.json() == []


def test_create_shopping_item_blank_name_rejected(client):
    response = client.post("/api/shopping-items", json=item(name=""))
    assert response.status_code == 400


def test_create_shopping_item_defaults(client):
    response = client.post("/api/shopping-items", json={"name": "Bread"})
    assert response.status_code == 200
    body = response.json()
    assert body["checked"] is False
    assert body["sortOrder"] == 0
    assert body["quantity"] is None


def test_update_shopping_item(client):
    item_id = create_item(client, VALID_ITEM)

    response = client.put(
        f"/api/shopping-items/{item_id}",
        json=item(quantity="1 L", checked=True),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["quantity"] == "1 L"
    assert body["checked"] is True

    response = client.get("/api/shopping-items")
    listed = response.json()[0]
    assert listed["quantity"] == "1 L"
    assert listed["checked"] is True


def test_update_shopping_item_not_found(client):
    response = client.put("/api/shopping-items/999999", json=VALID_ITEM)
    assert response.status_code == 404
    assert response.json() == {
        "title": "Not Found",
        "detail": "ShoppingItem with id '999999' not found",
        "status": 404,
    }


def test_delete_shopping_item(client):
    item_id = create_item(client, VALID_ITEM)

    assert client.delete(f"/api/shopping-items/{item_id}").status_code == 204
    body = client.get("/api/shopping-items").json()
    assert all(i["id"] != item_id for i in body)


def test_delete_shopping_item_not_found(client):
    assert client.delete("/api/shopping-items/999999").status_code == 404


def test_delete_checked_removes_only_checked(client):
    create_item(client, item(name="A", checked=True))
    create_item(client, item(name="B", checked=True))
    create_item(client, item(name="C", checked=False))

    response = client.delete("/api/shopping-items/checked")
    assert response.status_code == 204

    body = client.get("/api/shopping-items").json()
    assert len(body) == 1
    assert body[0]["name"] == "C"


def test_delete_checked_when_none_checked(client):
    create_item(client, item(name="A", checked=False))
    create_item(client, item(name="B", checked=False))

    response = client.delete("/api/shopping-items/checked")
    assert response.status_code == 204

    body = client.get("/api/shopping-items").json()
    assert len(body) == 2


def test_delete_checked_route_precedes_id_route(client):
    """Regression test: /checked must be registered before /{item_id}, else
    FastAPI would try (and fail) to parse "checked" as an int path param."""
    response = client.delete("/api/shopping-items/checked")
    assert response.status_code == 204


def test_list_ordering_by_sort_order_then_id(client):
    first_id = create_item(client, item(name="First", sortOrder=0))
    second_id = create_item(client, item(name="Second", sortOrder=0))
    create_item(client, item(name="Third", sortOrder=5))

    body = client.get("/api/shopping-items").json()
    ids = [i["id"] for i in body]
    assert ids == [first_id, second_id, ids[2]]
    assert [i["name"] for i in body] == ["First", "Second", "Third"]
