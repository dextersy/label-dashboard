import { S3Client, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

// Configure S3 Client
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || ''
  }
});

export { s3Client };

/**
 * Upload a file to S3 using multipart upload (handles large files)
 */
export async function uploadToS3(params: {
  Bucket: string;
  Key: string;
  Body: Buffer | Readable | string;
  ContentType?: string;
  ACL?: string;
}): Promise<{ Location: string; Key: string; Bucket: string }> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: params.Bucket,
      Key: params.Key,
      Body: params.Body,
      ContentType: params.ContentType,
      ACL: params.ACL as any
    }
  });

  const result = await upload.done();
  return {
    Location: result.Location || `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`,
    Key: params.Key,
    Bucket: params.Bucket
  };
}

/**
 * Delete an object from S3
 */
export async function deleteFromS3(params: {
  Bucket: string;
  Key: string;
}): Promise<void> {
  await s3Client.send(new DeleteObjectCommand(params));
}

/**
 * Check if an object exists in S3 (head object)
 */
export async function headS3Object(params: {
  Bucket: string;
  Key: string;
}): Promise<{ ContentLength?: number; ContentType?: string; ETag?: string }> {
  const result = await s3Client.send(new HeadObjectCommand(params));
  return {
    ContentLength: result.ContentLength,
    ContentType: result.ContentType,
    ETag: result.ETag
  };
}

/**
 * Get an object from S3 as a readable stream
 */
export async function getS3ObjectStream(params: {
  Bucket: string;
  Key: string;
  Range?: string;
}): Promise<{
  Body: Readable;
  ContentLength?: number;
  ContentType?: string;
  ContentRange?: string;
  AcceptRanges?: string;
}> {
  const result = await s3Client.send(new GetObjectCommand(params));
  return {
    Body: result.Body as Readable,
    ContentLength: result.ContentLength,
    ContentType: result.ContentType,
    ContentRange: result.ContentRange,
    AcceptRanges: result.AcceptRanges
  };
}

/**
 * Simple put object (for smaller files without multipart)
 */
export async function putS3Object(params: {
  Bucket: string;
  Key: string;
  Body: Buffer | Readable | string;
  ContentType?: string;
  ACL?: string;
}): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: params.Bucket,
    Key: params.Key,
    Body: params.Body,
    ContentType: params.ContentType,
    ACL: params.ACL as any
  }));
}
