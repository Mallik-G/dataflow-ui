import { PublicClientApplication } from '@azure/msal-browser';

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "8a7b9508-7929-4ca9-bf28-8166c22a77f5",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "02f98226-2b37-483d-acf8-320c949b2e9d"}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI || window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0:
            return;
          case 1:
            return;
          case 2:
            return;
          case 3:
            return;
          default:
            return;
        }
      }
    }
  }
};

export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"],
  prompt: "select_account",
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};

export const azureScopes = {
  userRead: "User.Read",
  openId: "openid",
  profile: "profile",
  email: "email",
  offlineAccess: "offline_access"
};

export const azureErrorMessages = {
  userCancelled: "User cancelled the login process",
  networkError: "Network error occurred during authentication",
  invalidCredentials: "Invalid credentials provided",
  accountLocked: "Account is locked",
  passwordExpired: "Password has expired",
  consentRequired: "Admin consent is required",
  unknownError: "An unknown error occurred during authentication"
};

export const getAzureConfig = () => {
  return {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "8a7b9508-7929-4ca9-bf28-8166c22a77f5",
    tenantId: import.meta.env.VITE_AZURE_TENANT_ID || "02f98226-2b37-483d-acf8-320c949b2e9d",
    redirectUri: import.meta.env.VITE_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI || window.location.origin,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "02f98226-2b37-483d-acf8-320c949b2e9d"}`,
    scopes: ["User.Read", "openid", "profile", "email"]
  };
};

export const msalInstance = new PublicClientApplication(msalConfig);

export default msalConfig;
