from app.config import Settings


def test_insecure_defaults_detected():
    s = Settings(_env_file=None)
    assert set(s.insecure_defaults()) == {"SECRET_KEY", "ADMIN_PASSWORD"}
    assert s.is_dev


def test_secure_values_pass():
    s = Settings(_env_file=None, env="prod", secret_key="x" * 40, admin_password="a-real-password")
    assert s.insecure_defaults() == []
    assert not s.is_dev


def test_cors_origin_list_parses():
    s = Settings(_env_file=None, cors_origins=" http://a , http://b,")
    assert s.cors_origin_list == ["http://a", "http://b"]
