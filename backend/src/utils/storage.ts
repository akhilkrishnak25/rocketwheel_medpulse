import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const bucketName = process.env.NEON_STORAGE_BUCKET || 'medpulse-documents';
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'ap-southeast-1';

const isConfigured = Boolean(endpoint && accessKeyId && secretAccessKey);

export const s3Client = isConfigured
  ? new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
      forcePathStyle: true, // Required by Neon Object Storage
    })
  : null;

/**
 * Uploads a file (Buffer) to Neon Object Storage
 * Returns the public URL or S3 key
 */
export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<string | null> {
  if (!s3Client) {
    return null;
  }

  try {
    const cleanKey = key.replace(/^\/+/, '');
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      })
    );

    // With public_read access in Neon, URL is: ${endpoint}/${bucket}/${cleanKey}
    const publicUrl = `${endpoint}/${bucketName}/${cleanKey}`;
    return publicUrl;
  } catch (err) {
    console.warn(`[Neon Storage] Failed to upload ${key}:`, err);
    return null;
  }
}

/**
 * Downloads a file from Neon Object Storage as a Buffer
 */
export async function downloadFromStorage(key: string): Promise<Buffer | null> {
  if (!s3Client) return null;

  try {
    const cleanKey = key.replace(/^\/+/, '');
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
      })
    );

    if (!res.Body) return null;
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  } catch (err) {
    return null;
  }
}
