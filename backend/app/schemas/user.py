from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str
    is_admin: bool = False


class UserOut(BaseModel):
    id: str
    username: str
    display_name: str
    is_admin: bool
    settings: dict = {}

    model_config = {"from_attributes": True}


class UserSelfUpdate(BaseModel):
    display_name: str | None = None
    settings: dict | None = None  # merged into the existing settings, one level deep
