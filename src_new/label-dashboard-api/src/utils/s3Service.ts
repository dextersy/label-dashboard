import { S3Client, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

// Configure S3 Client
const s3ClientConfig: ConstructorParameters<typeof S3Client>[0] = {
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || ''
  }
};

if (process.env.S3_ENDPOINT) {
  s3ClientConfig.endpoint = process.env.S3_ENDPOINT;
  s3ClientConfig.forcePathStyle = true;
}

const s3Client = new S3Client(s3ClientConfig);

export { s3Client };

/**
 * Build the public URL for an S3 object, respecting S3_ENDPOINT for custom/local endpoints.
 */
export function getS3PublicUrl(bucket: string, key: string): string {
  if (process.env.S3_ENDPOINT) {
    // Path-style URL for custom endpoints (e.g. MinIO, local S3)
    const base = process.env.S3_ENDPOINT.replace(/\/$/, '');
    return `${base}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

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
    Location: result.Location || getS3PublicUrl(params.Bucket, params.Key),
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
