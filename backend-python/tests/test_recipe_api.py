"""Mirror of RecipeResourceTest and TagResourceTest."""

import copy

VALID_RECIPE = {
    "title": "Pancakes",
    "description": "Fluffy pancakes",
    "servingsBase": 4,
    "prepTimeMinutes": 10,
    "cookTimeMinutes": 15,
    "notes": "Serve warm",
    "ingredients": [
        {"name": "Flour", "amount": 200, "unit": "G"},
        {"name": "Milk", "amount": 300, "unit": "ML"},
    ],
    "steps": [
        {"title": "Mix", "content": "Mix everything", "timerSeconds": None},
        {"title": "Bake", "content": "Bake at 200C", "timerSeconds": 600},
    ],
    "tags": ["breakfast", "sweet"],
}


def recipe(**overrides) -> dict:
    body = copy.deepcopy(VALID_RECIPE)
    body.update(overrides)
    return body


def create_recipe(client, body: dict) -> int:
    response = client.post("/api/recipes", json=body)
    assert response.status_code == 200
    return response.json()["id"]


def test_create_and_get_recipe(client):
    recipe_id = create_recipe(client, VALID_RECIPE)

    response = client.get(f"/api/recipes/{recipe_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Pancakes"
    assert body["servingsBase"] == 4
    assert len(body["ingredients"]) == 2
    assert len(body["steps"]) == 2
    assert body["steps"][0]["stepNumber"] == 1
    assert body["steps"][1]["stepNumber"] == 2
    assert len(body["tags"]) == 2
    assert body["createdAt"] is not None
    assert body["updatedAt"] is not None
    assert body["ingredients"][0]["amount"] == 200


def test_get_recipe_not_found(client):
    response = client.get("/api/recipes/999999")
    assert response.status_code == 404
    assert response.json() == {
        "title": "Not Found",
        "detail": "Recipe with id '999999' not found",
        "status": 404,
    }


def test_create_recipe_empty_ingredients_rejected(client):
    response = client.post(
        "/api/recipes",
        json={"title": "No Ingredients", "ingredients": [], "steps": [{"content": "Mix"}]},
    )
    assert response.status_code == 400


def test_create_recipe_empty_steps_rejected(client):
    response = client.post(
        "/api/recipes",
        json={
            "title": "No Steps",
            "ingredients": [{"name": "Flour", "amount": 100}],
            "steps": [],
        },
    )
    assert response.status_code == 400


def test_create_recipe_blank_title_rejected(client):
    response = client.post(
        "/api/recipes",
        json={
            "title": "",
            "ingredients": [{"name": "Flour", "amount": 100}],
            "steps": [{"content": "Mix"}],
        },
    )
    assert response.status_code == 400


def test_create_recipe_negative_timer_seconds_rejected(client):
    response = client.post(
        "/api/recipes",
        json={
            "title": "Bad Timer",
            "ingredients": [{"name": "Flour", "amount": 100}],
            "steps": [{"content": "Mix", "timerSeconds": -5}],
        },
    )
    assert response.status_code == 400


def test_update_recipe(client):
    recipe_id = create_recipe(client, VALID_RECIPE)

    response = client.put(
        f"/api/recipes/{recipe_id}",
        json={
            "title": "Pancakes v2",
            "ingredients": [{"name": "Egg", "amount": 2}],
            "steps": [{"content": "Whisk"}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Pancakes v2"
    assert len(body["ingredients"]) == 1
    assert len(body["steps"]) == 1


def test_update_recipe_not_found(client):
    response = client.put("/api/recipes/999999", json=VALID_RECIPE)
    assert response.status_code == 404


def test_delete_recipe(client):
    recipe_id = create_recipe(client, VALID_RECIPE)

    assert client.delete(f"/api/recipes/{recipe_id}").status_code == 204
    assert client.get(f"/api/recipes/{recipe_id}").status_code == 404


def test_delete_recipe_not_found(client):
    assert client.delete("/api/recipes/999999").status_code == 404


def test_search_recipes_pagination_reflected_in_response(client):
    create_recipe(client, recipe(title="Alpha"))
    create_recipe(client, recipe(title="Beta"))

    response = client.get("/api/recipes", params={"page": 0, "size": 1})
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["page"] == 0
    assert body["size"] == 1
    assert body["totalElements"] == 2
    assert body["totalPages"] == 2


def test_search_recipes_repeated_tag_param_requires_all_tags(client):
    create_recipe(client, recipe(title="Alpha"))
    create_recipe(client, recipe(title="Beta", tags=["breakfast"]))

    response = client.get("/api/recipes", params=[("tag", "breakfast"), ("tag", "sweet")])
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["title"] == "Alpha"
    assert body["totalElements"] == 1


def test_search_recipes_by_ingredient_name(client):
    create_recipe(client, recipe(title="Alpha"))

    response = client.get("/api/recipes", params={"search": "flour"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["totalElements"] >= 1


def test_search_recipes_size_is_clamped(client):
    create_recipe(client, recipe(title="Alpha"))

    assert client.get("/api/recipes", params={"size": 500}).json()["size"] == 100
    assert client.get("/api/recipes", params={"size": 0}).json()["size"] == 1
    assert client.get("/api/recipes", params={"page": -3}).json()["page"] == 0


def test_tag_reuse_visible_via_get_tags(client):
    create_recipe(client, recipe(title="Alpha"))
    create_recipe(client, recipe(title="Beta"))

    response = client.get("/api/tags")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_list_tags_empty(client):
    response = client.get("/api/tags")
    assert response.status_code == 200
    assert response.json() == []


def test_create_tag(client):
    response = client.post("/api/tags", json={"name": "dessert"})
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "dessert"
    assert body["id"] is not None


def test_create_tag_idempotent_no_duplicate_row(client):
    first = client.post("/api/tags", json={"name": "dessert"}).json()
    second = client.post("/api/tags", json={"name": "dessert"}).json()

    assert first["id"] == second["id"]
    assert len(client.get("/api/tags").json()) == 1


def test_create_tag_blank_name_rejected(client):
    assert client.post("/api/tags", json={"name": ""}).status_code == 400
