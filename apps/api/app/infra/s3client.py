import boto3
from botocore.client import Config

from app.core.config import settings

s3client = boto3.client(
    "s3",
    region_name=settings.S3_REGION,
    aws_access_key_id=settings.S3_KEY,
    aws_secret_access_key=settings.S3_SECRET,
    endpoint_url=settings.S3_ENDPOINT,
    config=Config(
        signature_version="s3v4",
        connect_timeout=5,
        read_timeout=15,
        retries={"max_attempts": 2},
    ),
)
