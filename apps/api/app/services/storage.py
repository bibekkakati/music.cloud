import io
import logging
from collections.abc import Iterator

from botocore.exceptions import ClientError

from app.core.config import settings
from app.infra.s3client import s3client

logger = logging.getLogger("uvicorn.error")


class Storage:
    def __init__(self, client, bucket: str):
        self.client = client
        self.bucket = bucket

    def generate_presigned_upload_url(
        self,
        key: str,
        expires_in: int = 3600,
        content_type: str | None = None,
    ) -> str:
        """Presigned PUT URL for uploading to `key`."""
        params = {"Bucket": self.bucket, "Key": key}
        if content_type:
            params["ContentType"] = content_type

        return self.client.generate_presigned_url(
            ClientMethod="put_object",
            Params=params,
            ExpiresIn=expires_in,
        )

    def generate_presigned_download_url(
        self,
        key: str,
        expires_in: int = 3600,
    ) -> str:
        """Presigned GET URL for downloading `key`. Optionally forces a download filename."""
        params = {"Bucket": self.bucket, "Key": key}

        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=expires_in,
        )

    def download_file(self, key: str, chunk_size: int = 8192) -> Iterator[bytes]:
        """Stream file contents from S3 in chunks."""
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key)
        except ClientError as e:
            raise FileNotFoundError(f"Could not fetch key '{key}': {e}") from e

        body = response["Body"]
        try:
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            body.close()

    def upload_file(
        self, key: str, file_buffer: io.BytesIO, content_type: str | None
    ) -> None:
        """
        Uploads a file from a buffer to S3.
        """
        try:
            if content_type:
                self.client.put_object(
                    Bucket=self.bucket,
                    Key=key,
                    Body=file_buffer,
                    ContentType=content_type,
                )
            else:
                self.client.put_object(Bucket=self.bucket, Key=key, Body=file_buffer)
        except ClientError as e:
            raise FileNotFoundError(f"Could not upload file '{key}': {e}") from e

    def does_exists(self, key: str) -> bool:
        """Check if a key exists in the bucket."""
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise

    def delete_file(self, key: str) -> None:
        """Delete an object from S3/R2."""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError:
            pass

    def delete_prefix(self, prefix: str) -> None:
        """
        Idempotently deletes all objects in the bucket matching the given prefix.
        Paginates using list_objects_v2 and batches deletions using delete_objects.
        """
        if not prefix:
            return

        try:
            paginator = self.client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                objects = page.get("Contents")
                if not objects:
                    continue

                delete_keys = [{"Key": obj["Key"]} for obj in objects]
                self.client.delete_objects(
                    Bucket=self.bucket,
                    Delete={"Objects": delete_keys, "Quiet": True},
                )
        except ClientError as e:
            logger.warning("Error deleting prefix '%s' from storage: %s", prefix, e)
            raise


storage = Storage(s3client, settings.S3_BUCKET)

