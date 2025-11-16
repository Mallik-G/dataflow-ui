// Add this import at the top of your file:
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';

require('dotenv').config();

// Replace with your actual values:
const REGION = process.env.VITE_AWS_REGION; // e.g., "us-west-2"
const BUCKET = process.env.VITE_AWS_S3_BUCKET; // e.g., "my-upload-bucket"

console.log(process.env.VITE_AWS_REGION);
console.log(process.env.VITE_AWS_S3_BUCKET);
console.log(process.env.VITE_AWS_ACCESS_KEY_ID);
console.log(process.env.VITE_AWS_SECRET_ACCESS_KEY);

// Configure AWS S3 client
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

// // Helper for browser ReadableStream to text
// async function readableStreamToText(stream) {
//   const reader = stream.getReader();
//   let result = "";
//   const decoder = new TextDecoder();
//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;
//     result += decoder.decode(value, { stream: true });
//   }
//   result += decoder.decode(); // flush
//   return result;
// }

export const uploadFileToS3 = async (file) => {
  const params = {
    Bucket: BUCKET,
    Key: file.name,
    Body: file,
    ContentType: file.type || 'application/octet-stream',
  };
  console.log(file); // Should show a File or Blob
  console.log(typeof file); // Should be "object"
  console.log(file instanceof Blob); // true
  try {
    await s3.send(new PutObjectCommand(params));
    return `Uploaded: ${file.name}`;
  } catch (err) {
    console.log(err);
    throw new Error('S3 upload failed: ' + err.message);
  }
};

export const downloadFileFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
  };

  try {
    const data = await s3.send(new GetObjectCommand(params));
    const body = await streamToString(data.Body);
    return body;
  } catch (err) {
    console.error(err);
    throw new Error('S3 download failed: ' + err.message);
  }
};

const streamToString = async (stream) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // flush remaining
  return result;
};
