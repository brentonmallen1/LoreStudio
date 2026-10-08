from app.services.color_slots import next_slot


def test_next_slot_is_the_least_used_lowest_first():
    assert next_slot([]) == 1
    assert next_slot([1, 2, 3]) == 4
    assert next_slot([1, 1, 2, 3, 4, 5, 6, 7, 8]) == 2
    assert next_slot([0, None, 1]) == 2
