from app.auth.utils import create_access_token, decode_token, hash_password, verify_password

LONG = "lighthouse-keeper-" * 6  # 108 bytes: past bcrypt's 72
# Made by bcrypt 4, which dropped everything past 72 bytes without a word.
LONG_HASH_FROM_BCRYPT_4 = "$2b$04$obrbu13LeKJ.1x4YNVPG0.aS9e4A7WVgNKv/2YtqSCpifvrG7jWu2"


def test_a_password_round_trips():
    hashed = hash_password("qa-pass")
    assert verify_password("qa-pass", hashed)
    assert not verify_password("qa-pas", hashed)


def test_a_long_password_hashes_and_verifies():
    assert verify_password(LONG, hash_password(LONG))


def test_a_long_password_hashed_by_bcrypt_4_still_signs_in():
    assert verify_password(LONG, LONG_HASH_FROM_BCRYPT_4)


def test_a_token_names_its_user_and_a_forged_one_names_nobody():
    token = create_access_token("user-1")
    assert decode_token(token) == "user-1"
    assert decode_token(token[:-2] + "xx") is None
    assert decode_token("not a token") is None
