from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class NotFoundException(AppException):
    def __init__(self, resource: str, resource_id: str = "") -> None:
        super().__init__(
            message=f"{resource}{' ' + resource_id if resource_id else ''} not found",
            code="NOT_FOUND",
            status_code=404,
        )


class ValidationException(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=422,
        )


class AIServiceException(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code="AI_SERVICE_ERROR",
            status_code=503,
        )


class FileParseException(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code="FILE_PARSE_ERROR",
            status_code=422,
        )


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "status": "error", "code": exc.code},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "status": "error",
                "code": "INTERNAL_ERROR",
            },
        )
