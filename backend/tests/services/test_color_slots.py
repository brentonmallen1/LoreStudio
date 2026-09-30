from app.services.color_slots import next_slot, slot_for_hex


def test_next_slot_is_the_least_used_lowest_first():
    assert next_slot([]) == 1
    assert next_slot([1, 2, 3]) == 4
    assert next_slot([1, 1, 2, 3, 4, 5, 6, 7, 8]) == 2
    assert next_slot([0, None, 1]) == 2


def test_old_preset_hexes_map_to_slots():
    assert slot_for_hex("#3b82f6", 5) == 1
    assert slot_for_hex("#EF4444", 5) == 2
    assert slot_for_hex("#6b7280", 5) == 8
    assert slot_for_hex("#123456", 5) == 5
    assert slot_for_hex(None, 3) == 3
