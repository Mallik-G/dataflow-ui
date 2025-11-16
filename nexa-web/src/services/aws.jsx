// Add this import at the top of your file:
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import axios from "axios";

// Replace with your actual values:
const REGION = import.meta.env.VITE_AWS_REGION; // e.g., "us-west-2"
const BUCKET = import.meta.env.VITE_AWS_S3_BUCKET; // e.g., "my-upload-bucket"
const IDENTITY_POOL_ID = "us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"; // e.g., "us-east-1:xxxx..."

// // const s3Client = new S3Client({
//   region: REGION,
//   credentials: fromCognitoIdentityPool({
//     client: new CognitoIdentityClient({ region: REGION }),
//     identityPoolId: IDENTITY_POOL_ID,
//   }),
// });

// Configure AWS S3 client
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
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
    ContentType: file.type || "application/octet-stream",
  };
  console.log(file); // Should show a File or Blob
  console.log(typeof file); // Should be "object"
  console.log(file instanceof Blob); // true
  try {
    await s3.send(new PutObjectCommand(params));
    return `Uploaded: ${file.name}`;
  } catch (err) {
    console.log(err);
    throw new Error("S3 upload failed: " + err.message);
  }
};

export const downloadFileFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
  };

  console.log("params:", params);

  try {
    const data = await s3.send(new GetObjectCommand(params));
    const body = await streamToString(data.Body);
    return body;
  } catch (err) {
    console.error(err);
    throw new Error("S3 download failed: " + err.message);
  }
};

const streamToString = async (stream) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode(); // flush remaining
  return result;
};

// export async function uploadFileToS3Presigned(file) {
//   // 1. Get a pre-signed URL from your backend
//   const res = await fetch(
//     `/api/presign?filename=${encodeURIComponent(file.name)}`
//   );
//   if (!res.ok) throw new Error("Failed to get presigned URL");
//   const { url } = await res.json();

//   // 2. Upload the file directly to S3
//   const uploadRes = await fetch(url, {
//     method: "PUT",
//     body: file,
//     headers: {
//       "Content-Type": file.type,
//     },
//   });
//   if (!uploadRes.ok) throw new Error("Failed to upload to S3");
//   return "Uploaded!";
// }

// export async function uploadFileToS3Cognito(file) {
//   const params = {
//     Bucket: BUCKET,
//     Key: file.name,
//     Body: file,
//     ContentType: file.type,
//   };
//   try {
//     await s3Client.send(new PutObjectCommand(params));
//     return `Uploaded: ${file.name}`;
//   } catch (err) {
//     console.log(err);
//     throw new Error("S3 upload failed: " + err.message);
//   }
// }

// // Example backend (Node.js/Express) for generating pre-signed URLs:
// //
// // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// // const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
// //
// // app.get('/api/presign', async (req, res) => {
// //   const { filename } = req.query;
// //   const command = new PutObjectCommand({
// //     Bucket: process.env.AWS_S3_BUCKET,
// //     Key: filename,
// //     ContentType: req.headers['content-type'] || 'application/octet-stream',
// //   });
// //   const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
// //   res.json({ url });
// // });

// import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// const region = import.meta.env.VITE_AWS_REGION; // e.g., "us-west-2"
// const BUCKET = import.meta.env.VITE_AWS_S3_BUCKET; // e.g., "my-upload-bucket"
// const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
// const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

// if (!accessKeyId || !secretAccessKey || !region) {
//   throw new Error("Missing AWS credentials or region in environment variables");
// }

// // Configure AWS S3 client
// const s3 = new S3Client({
//   region,
//   credentials: {
//     accessKeyId,
//     secretAccessKey,
//   },
// });

// //   const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/neuronimbus-projects/${finalFileName}`;

// export const putS3Object = async (file) => {
//   try {
//     const uploadParams = {
//       Bucket: BUCKET,
//       Key: file.name,
//       Body: file.buffer,
//       ContentType: file.type,
//     };
//     const result = await s3.send(new PutObjectCommand(uploadParams));
//     console.log("result:", result);
//     return result;
//   } catch (err) {
//     console.log("err:", err);
//   }
// };

// Fetch list of uploaded documents from backend
export async function fetchUploadedDocuments() {
  const response = await axios.get("/api/documents");
  return response.data;
}
