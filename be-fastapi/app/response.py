from typing import Any


def success_response(data: Any, message: str = "Success") -> dict[str, Any]:
    return {"data": data, "message": message, "status": "success"}


def error_response(detail: str, code: str = "ERROR") -> dict[str, Any]:
    return {"detail": detail, "status": "error", "code": code}
