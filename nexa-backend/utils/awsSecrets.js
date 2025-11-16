// utils/awsSecrets.js
const { 
  SecretsManagerClient, 
  CreateSecretCommand, 
  PutSecretValueCommand, 
  GetSecretValueCommand 
} = require("@aws-sdk/client-secrets-manager");

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Save authentication credentials in AWS Secrets Manager.
 * If the secret already exists, update it.
 */
async function saveConnectorSecret(connectorName, authConfig) {
  const newString = connectorName.replace(/ /g, "-");
  const secretName = `connector/${newString}/authConfig`;
  const secretValue = JSON.stringify(authConfig);

  try {
    // Try creating new secret
    const createCommand = new CreateSecretCommand({
      Name: secretName,
      SecretString: secretValue,
    });
    const response = await client.send(createCommand);
    console.log("✅ Secret created:", response.ARN);
    return response.ARN;
  } catch (err) {
    if (err.name === "ResourceExistsException") {
      // Secret already exists → update instead
      const updateCommand = new PutSecretValueCommand({
        SecretId: secretName,
        SecretString: secretValue,
      });
      const response = await client.send(updateCommand);
      console.log("🔄 Secret updated:", response.ARN);
      return response.ARN;
    }
    console.error("❌ Error saving secret:", err);
    throw err;
  }
}

/**
 * Retrieve the secret value (credentials) when needed.
 */
async function getConnectorSecret(secretArn) {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);
    return JSON.parse(response.SecretString);
  } catch (err) {
    console.error("❌ Error retrieving secret:", err);
    throw err;
  }
}
module.exports = { saveConnectorSecret, getConnectorSecret };
