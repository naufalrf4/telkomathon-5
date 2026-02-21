from pydantic import BaseModel, ConfigDict


class ExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message: str
    syllabus_id: str
