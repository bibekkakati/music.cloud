class AppException(Exception):
    """Base domain exception for the application."""

    def __init__(self, message: str = "An application error occurred") -> None:
        self.message = message
        super().__init__(self.message)


class InvalidCredentialsError(AppException):
    """Raised when provided credentials or secret code are invalid."""

    def __init__(self, message: str = "Invalid secret code or credentials") -> None:
        super().__init__(message)


class UserNotFoundError(AppException):
    """Raised when a requested user is not found."""

    def __init__(self, message: str = "User not found") -> None:
        super().__init__(message)


class SessionExpiredOrInvalidError(AppException):
    """Raised when a session is missing, invalid, or expired."""

    def __init__(self, message: str = "Session has expired or is invalid") -> None:
        super().__init__(message)
