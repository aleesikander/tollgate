"""Encryption utilities for sensitive data storage.

This module provides Fernet symmetric encryption for storing sensitive
data like Slack bot tokens. The encryption key is loaded from the
ENCRYPTION_KEY environment variable.

Security notes:
- Never log decrypted tokens, even at debug level
- The encryption key must be kept secret and rotated periodically
- Tokens are encrypted at rest in the database
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from tollgate.config import get_settings


class EncryptionError(Exception):
    """Raised when encryption/decryption fails."""

    pass


@lru_cache
def _get_fernet() -> Fernet | None:
    """Get the Fernet instance for encryption/decryption.

    Returns None if no encryption key is configured.
    """
    settings = get_settings()
    if not settings.encryption_key:
        return None
    return Fernet(settings.encryption_key.encode())


def encrypt(plaintext: str) -> str:
    """Encrypt a string value.

    Args:
        plaintext: The value to encrypt

    Returns:
        The encrypted value as a base64-encoded string

    Raises:
        EncryptionError: If encryption key is not configured
    """
    fernet = _get_fernet()
    if fernet is None:
        raise EncryptionError("ENCRYPTION_KEY not configured")
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt an encrypted value.

    Args:
        ciphertext: The encrypted value (base64-encoded)

    Returns:
        The decrypted plaintext

    Raises:
        EncryptionError: If decryption fails or key is not configured
    """
    fernet = _get_fernet()
    if fernet is None:
        raise EncryptionError("ENCRYPTION_KEY not configured")
    try:
        return fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken as e:
        raise EncryptionError("Failed to decrypt: invalid token or wrong key") from e


def is_configured() -> bool:
    """Check if encryption is configured."""
    return _get_fernet() is not None
