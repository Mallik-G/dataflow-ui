const GitHubService = require('../services/githubService');

/**
 * Test GitHub connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testGitHubConnection = async (req, res) => {
  try {
    const { repositoryUrl, branch, username, password } = req.body;

    // Validate required fields
    if (!repositoryUrl || !branch || !username) {
      return res.status(400).json({
        success: false,
        message: 'Repository URL, branch, and username/token are required',
      });
    }

    // Test the connection
    const result = await GitHubService.testConnection({
      repositoryUrl,
      branch,
      username,
      password,
    });

    res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('GitHub connection test error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Save GitHub connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const saveGitHubConnection = async (req, res) => {
  try {
    const { repositoryUrl, branch, username, password } = req.body;

    // Validate required fields
    if (!repositoryUrl || !branch || !username) {
      return res.status(400).json({
        success: false,
        message: 'Repository URL, branch, and username/token are required',
      });
    }

    // Save the connection
    const result = await GitHubService.saveConnection({
      repositoryUrl,
      branch,
      username,
      password,
    });

    res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('GitHub connection save error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update GitHub connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateGitHubConnection = async (req, res) => {
  try {
    const { repositoryUrl, branch, username, password, connectionId } =
      req.body;

    // Validate required fields
    if (!repositoryUrl || !branch || !username || !connectionId) {
      return res.status(400).json({
        success: false,
        message:
          'Repository URL, branch, username/token, and connection ID are required',
      });
    }

    // Update the connection
    const result = await GitHubService.updateConnection(
      { repositoryUrl, branch, username, password },
      connectionId
    );

    res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('GitHub connection update error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get repository information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRepositoryInfo = async (req, res) => {
  try {
    const { repositoryUrl, username, password } = req.body;

    // Validate required fields
    if (!repositoryUrl || !username) {
      return res.status(400).json({
        success: false,
        message: 'Repository URL and username/token are required',
      });
    }

    // Get repository info
    const result = await GitHubService.getRepositoryInfo({
      repositoryUrl,
      username,
      password,
    });

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('Get repository info error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * List repository branches
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const listBranches = async (req, res) => {
  try {
    const { repositoryUrl, username, password } = req.body;

    // Validate required fields
    if (!repositoryUrl || !username) {
      return res.status(400).json({
        success: false,
        message: 'Repository URL and username/token are required',
      });
    }

    // List branches
    const result = await GitHubService.listBranches({
      repositoryUrl,
      username,
      password,
    });

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('List branches error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Test GitHub write permissions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testWritePermissions = async (req, res) => {
  try {
    const { repositoryUrl, branch, username, password } = req.body;

    // Validate required fields
    if (!repositoryUrl || !branch || !username) {
      return res.status(400).json({
        success: false,
        message: 'Repository URL, branch, and username/token are required',
      });
    }

    // Test write permissions
    const result = await GitHubService.testWritePermissions({
      repositoryUrl,
      branch,
      username,
      password,
    });

    res.json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.error('GitHub write permission test error:', error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get the currently active GitHub connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getActiveConnection = async (req, res) => {
  try {
    const connection = await GitHubService.getActiveConnection();

    if (!connection) {
      return res.json({
        success: true,
        data: null,
        message: 'No active GitHub connection found',
      });
    }

    res.json({
      success: true,
      data: connection,
    });
  } catch (error) {
    console.error('Get active connection error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Reset/Delete the active GitHub connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetConnection = async (req, res) => {
  try {
    const result = await GitHubService.resetConnection();

    res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error('Reset connection error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  testGitHubConnection,
  saveGitHubConnection,
  updateGitHubConnection,
  getRepositoryInfo,
  listBranches,
  getActiveConnection,
  resetConnection,
  testWritePermissions,
};
