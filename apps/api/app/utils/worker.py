import logging

from bullmq import Job

from app.services.song_processor import SongProcessor

logger = logging.getLogger("uvicorn.error")


class JobProcessor:
    def __init__(self):
        pass

    async def process_song(self, job: Job):
        song_processor = SongProcessor()
        await song_processor.start_processing_pipeline(
            job.data["song_id"], job.data["trim_start_sec"]
        )


async def process_job(job: Job, job_token: str):
    job_name = job.name
    logger.info(
        "Processing job %s",
        job_name,
        extra={
            "job_id": job.id,
            "data": job.data,
            "job_name": job_name,
        },
    )

    job_processor = JobProcessor()
    if job.name == "process-song":
        await job_processor.process_song(job)
