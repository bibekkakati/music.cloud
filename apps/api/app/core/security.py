import secrets
import string
import bcrypt


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt using a distinct 12-round salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Validate a plaintext password against a bcrypt hash in constant time."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def generate_secure_password(length: int = 10) -> str:
    """Generate a high-entropy 8-12 character password with guaranteed complexity."""
    if not (8 <= length <= 12):
        length = 10
    special_chars = "!@#$%*?"
    categories = [
        string.ascii_uppercase,
        string.ascii_lowercase,
        string.digits,
        special_chars,
    ]
    # Guarantee at least one from each character category
    password = [secrets.choice(cat) for cat in categories]
    all_chars = string.ascii_letters + string.digits + special_chars
    password += [
        secrets.choice(all_chars) for _ in range(length - len(categories))
    ]

    rng = secrets.SystemRandom()
    rng.shuffle(password)
    return "".join(password)
