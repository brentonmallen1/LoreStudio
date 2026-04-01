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

    model_config = {"from_attributes": True}
