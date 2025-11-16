# Azure AD Authentication Implementation - Frontend

## Overview
This document describes the Azure Active Directory (Azure AD) authentication implementation for the DRAI Nexa Frontend application. The implementation provides secure authentication using Microsoft's MSAL (Microsoft Authentication Library) for React.

## Features

### 🔐 **Azure AD Authentication**
- **Microsoft Account Login**: Users can sign in with their Microsoft/Azure AD accounts
- **Single Sign-On (SSO)**: Seamless authentication experience
- **Token Management**: Automatic token refresh and management
- **User Profile**: Access to user profile information
- **Secure Logout**: Proper session cleanup

### 🎨 **User Interface**
- **Modern Design**: Clean and professional login interface
- **Responsive Layout**: Works on all device sizes
- **Loading States**: Visual feedback during authentication
- **Error Handling**: User-friendly error messages
- **User Info Display**: Shows logged-in user information

## Configuration

### Environment Variables
Create a `.env` file in the frontend directory with the following variables:

```env
# Azure AD Configuration
VITE_AZURE_CLIENT_ID="8a7b9508-7929-4ca9-bf28-8166c22a77f5"
VITE_AZURE_TENANT_ID="02f98226-2b37-483d-acf8-320c949b2e9d"
VITE_REDIRECT_URI="http://localhost:3000"
VITE_POST_LOGOUT_REDIRECT_URI="http://localhost:3000"

# Application Configuration
VITE_APP_NAME="DR.ai"
VITE_API_BASE_URL="http://localhost:4000"
```

### Azure AD App Registration Setup
1. **Create App Registration** in Azure Portal
2. **Configure Redirect URIs**:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
3. **Set API Permissions**:
   - `User.Read` (Microsoft Graph)
   - `openid`
   - `profile`
   - `email`
4. **Generate Client Secret** (if needed)

## File Structure

```
drai-nexa-frontend/src/
├── config/
│   └── azureConfig.js           # Azure AD configuration
├── components/
│   ├── AzureLoginButton.jsx     # Azure login component
│   └── AzureAuthProvider.jsx    # Authentication provider
├── screens/
│   └── LoginPage.jsx           # Updated login page
├── scss/
│   └── azure-login.scss        # Azure login styles
└── App.jsx                     # Updated main app component
```

## Implementation Details

### 1. Azure Configuration (`config/azureConfig.js`)
```javascript
export const msalConfig = {
  auth: {
    clientId: "your-client-id",
    authority: "https://login.microsoftonline.com/your-tenant-id",
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  }
};
```

### 2. Azure Login Button (`components/AzureLoginButton.jsx`)
- Handles login/logout functionality
- Shows user information when logged in
- Provides loading states and error handling
- Responsive design

### 3. Authentication Provider (`components/AzureAuthProvider.jsx`)
- Manages authentication state
- Handles authentication state changes
- Provides context for child components

### 4. Updated Login Page (`screens/LoginPage.jsx`)
- Integrated Azure login button
- Maintains existing email login option
- Handles authentication success/error

## Usage Examples

### Basic Authentication Flow
```javascript
import { useMsal } from '@azure/msal-react';

const MyComponent = () => {
  const { instance, accounts } = useMsal();
  
  const handleLogin = async () => {
    try {
      const response = await instance.loginPopup(loginRequest);
      console.log('Login successful:', response);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  return (
    <button onClick={handleLogin}>
      Sign in with Microsoft
    </button>
  );
};
```

### Using Azure Login Button
```javascript
import AzureLoginButton from '../components/AzureLoginButton';

const LoginPage = () => {
  const handleLoginSuccess = (user) => {
    console.log('User logged in:', user);
    // Redirect to dashboard
  };
  
  const handleLoginError = (error) => {
    console.error('Login error:', error);
    // Show error message
  };
  
  return (
    <AzureLoginButton
      onLoginSuccess={handleLoginSuccess}
      onLoginError={handleLoginError}
    />
  );
};
```

## Authentication States

### 1. **Not Authenticated**
- User sees login button
- No user information displayed
- Redirected to login page

### 2. **Authenticated**
- User information displayed
- Logout button available
- Access to protected routes

### 3. **Loading**
- Spinner shown during authentication
- Buttons disabled
- User feedback provided

### 4. **Error**
- Error message displayed
- User can retry authentication
- Fallback options available

## Security Features

### 1. **Token Management**
- Automatic token refresh
- Secure token storage
- Session management

### 2. **CSRF Protection**
- State parameter validation
- Nonce verification
- Secure redirect handling

### 3. **Session Security**
- Automatic session timeout
- Secure logout
- Session cleanup

## Styling

### CSS Classes
- `.azure-login-container` - Main container
- `.azure-user-info` - User information display
- `.azure-avatar` - User avatar circle
- `.azure-login-success` - Success animation
- `.azure-login-error` - Error animation

### Responsive Design
- Mobile-friendly layout
- Touch-friendly buttons
- Adaptive sizing

## Error Handling

### Common Errors
1. **User Cancelled**: User closed login popup
2. **Network Error**: Connection issues
3. **Invalid Credentials**: Wrong username/password
4. **Consent Required**: Admin consent needed
5. **Account Locked**: Account security issues

### Error Messages
```javascript
const azureErrorMessages = {
  userCancelled: "User cancelled the login process",
  networkError: "Network error occurred during authentication",
  invalidCredentials: "Invalid credentials provided",
  consentRequired: "Admin consent is required",
  unknownError: "An unknown error occurred"
};
```

## Testing

### Manual Testing
1. **Login Flow**:
   - Click "Continue with Microsoft Azure"
   - Complete authentication
   - Verify user information display
   - Test logout functionality

2. **Error Scenarios**:
   - Cancel login popup
   - Test with invalid credentials
   - Test network connectivity issues

3. **Session Management**:
   - Test automatic logout after timeout
   - Test session persistence
   - Test logout cleanup

### Automated Testing
```javascript
// Example test for Azure login
describe('Azure Login', () => {
  it('should show login button when not authenticated', () => {
    render(<AzureLoginButton />);
    expect(screen.getByText('Continue with Microsoft Azure')).toBeInTheDocument();
  });
  
  it('should handle login success', async () => {
    const mockUser = { name: 'Test User', username: 'test@example.com' };
    const onSuccess = jest.fn();
    
    render(<AzureLoginButton onLoginSuccess={onSuccess} />);
    // Simulate successful login
    // Verify onSuccess callback called
  });
});
```

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"**
   - Check redirect URI in Azure AD app registration
   - Ensure URI matches exactly (including protocol and port)

2. **"Client ID not found"**
   - Verify client ID in environment variables
   - Check Azure AD app registration status

3. **"Consent required"**
   - Admin needs to grant consent for the application
   - Check API permissions in Azure AD

4. **"Token expired"**
   - Tokens are automatically refreshed
   - Check token refresh configuration

### Debug Mode
Enable debug logging by setting:
```javascript
system: {
  loggerOptions: {
    loggerCallback: (level, message, containsPii) => {
      console.log(message);
    }
  }
}
```

## Production Deployment

### 1. **Update Configuration**
- Change redirect URIs to production URLs
- Update client ID if using different app registration
- Configure proper CORS settings

### 2. **Security Considerations**
- Use HTTPS in production
- Implement proper CSP headers
- Regular security audits

### 3. **Monitoring**
- Monitor authentication success rates
- Track error patterns
- Set up alerts for failures

## Integration with Backend

### 1. **Token Validation**
- Backend validates Azure AD tokens
- User information extracted from tokens
- Session management on backend

### 2. **API Authentication**
- Include Azure AD tokens in API requests
- Backend validates tokens with Azure AD
- User context passed to backend

### 3. **Logging Integration**
- Authentication events logged to Azure Application Insights
- User actions tracked
- Security events monitored

## Best Practices

### 1. **User Experience**
- Provide clear error messages
- Show loading states
- Maintain session state

### 2. **Security**
- Never store sensitive data in localStorage
- Use secure token storage
- Implement proper logout

### 3. **Performance**
- Lazy load authentication components
- Minimize token requests
- Cache user information appropriately

## Support and Maintenance

### Regular Tasks
1. Monitor authentication success rates
2. Update Azure AD app registration settings
3. Review and update API permissions
4. Test authentication flow regularly

### Updates
Keep MSAL packages updated:
```bash
npm update @azure/msal-browser @azure/msal-react
```

## Conclusion

The Azure AD authentication implementation provides a secure, user-friendly authentication experience for the DRAI Nexa Frontend application. It integrates seamlessly with Microsoft's identity platform and provides comprehensive security features.

For additional support or questions, refer to the Microsoft MSAL documentation or contact the development team.
