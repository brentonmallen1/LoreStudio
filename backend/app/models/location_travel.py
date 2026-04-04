import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class LocationTravel(Base):
    """Travel information between two locations."""

    __tablename__ = "location_travel"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    from_location_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False)
    to_location_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False)
    travel_time: Mapped[str] = mapped_column(String, default="")  # "3 days", "2 hours"
    travel_method: Mapped[str] = mapped_column(String, default="")  # "on foot", "by ship"
    condition: Mapped[str] = mapped_column(String, default="")  # "at opposition", "via jump gate"
    notes: Mapped[str] = mapped_column(Text, default="")
    bidirectional: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    from_location: Mapped["Location"] = relationship(
        "Location", foreign_keys=[from_location_id]
    )
    to_location: Mapped["Location"] = relationship(
        "Location", foreign_keys=[to_location_id]
    )
