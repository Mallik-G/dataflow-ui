const axios = require('axios');
const { GitHubConnection } = require('../models');
const crypto = require('crypto');

class GitHubService {
  /**
   * Test GitHub connection using provided credentials
   * @param {Object} config - GitHub configuration
   * @param {string} config.repositoryUrl - Repository URL
   * @param {string} config.branch - Repository branch
   * @param {string} config.username - GitHub username or token
   * @param {string} config.password - GitHub password (if using username/password)
   * @returns {Promise<Object>} - Connection test result
   */
  static async testConnection(config) {
    try {
      const { repositoryUrl, branch, username, password } = config;

      // Extract owner and repo from repository URL
      const repoInfo = this.extractRepoInfo(repositoryUrl);
      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      // Determine authentication method
      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      // First, test authentication by accessing user info
      // This will fail with 401 if credentials are invalid
      try {
        const userResponse = await axios.get('https://api.github.com/user', {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        });
        console.log(
          'Authentication successful for user:',
          userResponse.data.login
        );
      } catch (authError) {
        if (authError.response && authError.response.status === 401) {
          throw new Error(
            'Authentication failed. Please check your credentials.'
          );
        }
        // If it's not a 401 error, continue with repository test
        console.log(
          'User info test failed, but continuing with repository test:',
          authError.message
        );
      }

      // Test API access to the specific repository
      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;
      const response = await axios.get(apiUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      });

      // Check if branch exists
      const branchUrl = `https://api.github.com/repos/${repoInfo.owner}/${
        repoInfo.repo
      }/branches/${encodeURIComponent(branch)}`;
      const branchResponse = await axios.get(branchUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      });

      // Additional test: Try to access repository contents to ensure we have proper access
      try {
        const contentsUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents`;
        await axios.get(contentsUrl, {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        });
      } catch (contentsError) {
        if (contentsError.response && contentsError.response.status === 403) {
          throw new Error(
            'Access denied. You do not have sufficient permissions to access this repository.'
          );
        }
        // If it's a 404, the repository might be empty, which is okay
        if (contentsError.response && contentsError.response.status !== 404) {
          console.log('Contents access test failed:', contentsError.message);
        }
      }

      return {
        success: true,
        message: 'GitHub connection successful',
        data: {
          repository: response.data.full_name,
          branch: branchResponse.data.name,
          defaultBranch: response.data.default_branch,
          private: response.data.private,
          permissions: response.data.permissions,
          lastCommit: branchResponse.data.commit.sha.substring(0, 7),
        },
      };
    } catch (error) {
      console.error('GitHub connection test failed:', error.message);

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || 'Unknown error';

        switch (status) {
          case 401:
            throw new Error(
              'Authentication failed. Please check your credentials.'
            );
          case 403:
            throw new Error(
              'Access denied. Please check your repository permissions.'
            );
          case 404:
            throw new Error(
              'Repository or branch not found. Please verify the URL and branch name.'
            );
          case 422:
            throw new Error('Invalid repository or branch name.');
          default:
            throw new Error(`GitHub API error: ${message}`);
        }
      } else if (error.code === 'ENOTFOUND') {
        throw new Error(
          'Unable to reach GitHub. Please check your internet connection.'
        );
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Connection timeout. Please try again.');
      } else {
        throw new Error(`Connection failed: ${error.message}`);
      }
    }
  }

  /**
   * Save GitHub connection configuration to database
   * @param {Object} config - GitHub configuration
   * @returns {Promise<Object>} - Save result
   */
  static async saveConnection(config) {
    try {
      const { repositoryUrl, branch, username, password } = config;

      // Extract repository info
      const repoInfo = this.extractRepoInfo(repositoryUrl);
      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      // Test connection first
      const testResult = await this.testConnection(config);

      if (!testResult.success) {
        throw new Error('Connection test failed');
      }

      // Determine authentication method
      const authMethod =
        !password || password.trim() === '' ? 'token' : 'password';

      // Encrypt password if provided
      let encryptedPassword = null;
      if (password && password.trim() !== '') {
        encryptedPassword = this.encryptPassword(password);
      }

      // Deactivate any existing active connections
      await GitHubConnection.update(
        { isActive: false },
        { where: { isActive: true } }
      );

      // Save new connection
      const connection = await GitHubConnection.create({
        repositoryUrl,
        repositoryOwner: repoInfo.owner,
        repositoryName: repoInfo.repo,
        branch,
        username,
        password: encryptedPassword,
        authMethod,
        isActive: true,
        lastTestedAt: new Date(),
        lastTestResult: testResult.data,
        testCount: 1,
        successCount: 1,
        failureCount: 0,
        metadata: {
          defaultBranch: testResult.data.defaultBranch,
          private: testResult.data.private,
          permissions: testResult.data.permissions,
        },
        createdBy: 'system',
        updatedBy: 'system',
        notes: 'GitHub connection created via settings',
      });

      return {
        success: true,
        message: 'GitHub connection saved successfully',
        data: {
          ...testResult.data,
          id: connection.id,
          savedAt: connection.createdAt,
        },
      };
    } catch (error) {
      console.error('Failed to save GitHub connection:', error.message);
      throw error;
    }
  }

  /**
   * Update existing GitHub connection
   * @param {Object} config - GitHub configuration
   * @param {string} connectionId - Connection ID to update
   * @returns {Promise<Object>} - Update result
   */
  static async updateConnection(config, connectionId) {
    try {
      const { repositoryUrl, branch, username, password } = config;

      // Extract repository info
      const repoInfo = this.extractRepoInfo(repositoryUrl);
      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      // Get existing connection to preserve password if not changed
      const existingConnection = await GitHubConnection.findByPk(connectionId);
      if (!existingConnection) {
        throw new Error('Connection not found');
      }

      // Test connection with new config
      const testResult = await this.testConnection(config);

      if (!testResult.success) {
        throw new Error('Connection test failed');
      }

      // Determine authentication method
      const authMethod =
        !password || password.trim() === '' ? 'token' : 'password';

      // Handle password update
      let encryptedPassword = existingConnection.password; // Keep existing by default
      if (password && password.trim() !== '') {
        // Only encrypt if a new password is provided
        encryptedPassword = this.encryptPassword(password);
      }

      // Update the connection
      await GitHubConnection.update(
        {
          repositoryUrl,
          repositoryOwner: repoInfo.owner,
          repositoryName: repoInfo.repo,
          branch,
          username,
          password: encryptedPassword,
          authMethod,
          lastTestedAt: new Date(),
          lastTestResult: testResult.data,
          metadata: {
            defaultBranch: testResult.data.defaultBranch,
            private: testResult.data.private,
            permissions: testResult.data.permissions,
          },
          updatedBy: 'system',
          notes: 'GitHub connection updated via settings',
        },
        {
          where: { id: connectionId },
        }
      );

      return {
        success: true,
        message: 'GitHub connection updated successfully',
        data: {
          ...testResult.data,
          id: connectionId,
          updatedAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Failed to update GitHub connection:', error.message);
      throw error;
    }
  }

  /**
   * Get the currently active GitHub connection
   * @returns {Promise<Object|null>} - Active connection or null
   */
  static async getActiveConnection() {
    try {
      const connection = await GitHubConnection.findOne({
        where: { isActive: true },
        order: [['createdAt', 'DESC']],
      });

      if (!connection) {
        return null;
      }

      // Decrypt password if it exists
      let decryptedPassword = null;
      if (connection.password) {
        decryptedPassword = this.decryptPassword(connection.password);
      }

      return {
        id: connection.id,
        repositoryUrl: connection.repositoryUrl,
        repositoryOwner: connection.repositoryOwner,
        repositoryName: connection.repositoryName,
        branch: connection.branch,
        username: connection.username,
        password: decryptedPassword,
        authMethod: connection.authMethod,
        lastTestedAt: connection.lastTestedAt,
        lastTestResult: connection.lastTestResult,
        testCount: connection.testCount,
        successCount: connection.successCount,
        failureCount: connection.failureCount,
        metadata: connection.metadata,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      };
    } catch (error) {
      console.error('Failed to get active GitHub connection:', error.message);
      throw error;
    }
  }

  /**
   * Delete/Reset the active GitHub connection
   * @returns {Promise<Object>} - Delete result
   */
  static async resetConnection() {
    try {
      const result = await GitHubConnection.update(
        { isActive: false },
        { where: { isActive: true } }
      );

      return {
        success: true,
        message: 'GitHub connection reset successfully',
        deletedCount: result[0],
      };
    } catch (error) {
      console.error('Failed to reset GitHub connection:', error.message);
      throw error;
    }
  }

  /**
   * Update connection test results
   * @param {string} connectionId - Connection ID
   * @param {boolean} success - Whether test was successful
   * @param {Object} testResult - Test result data
   * @param {string} error - Error message if failed
   */
  static async updateTestResult(
    connectionId,
    success,
    testResult = null,
    error = null
  ) {
    try {
      const updateData = {
        lastTestedAt: new Date(),
        testCount: GitHubConnection.literal('test_count + 1'),
      };

      if (success) {
        updateData.successCount = GitHubConnection.literal('success_count + 1');
        updateData.lastTestResult = testResult;
        updateData.lastError = null;
      } else {
        updateData.failureCount = GitHubConnection.literal('failure_count + 1');
        updateData.lastError = error;
      }

      await GitHubConnection.update(updateData, {
        where: { id: connectionId },
      });
    } catch (error) {
      console.error('Failed to update test result:', error.message);
    }
  }

  /**
   * Encrypt password for storage
   * @param {string} password - Plain text password
   * @returns {string} - Encrypted password
   */
  static encryptPassword(password) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'default-key',
      'salt',
      32
    );
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt password from storage
   * @param {string} encryptedPassword - Encrypted password
   * @returns {string} - Decrypted password
   */
  static decryptPassword(encryptedPassword) {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(
        process.env.ENCRYPTION_KEY || 'default-key',
        'salt',
        32
      );
      const parts = encryptedPassword.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt password:', error.message);
      return null;
    }
  }

  /**
   * Extract owner and repository name from GitHub URL
   * @param {string} url - Repository URL
   * @returns {Object|null} - { owner, repo } or null if invalid
   */
  static extractRepoInfo(url) {
    try {
      // Handle different GitHub URL formats
      let match;

      // https://github.com/owner/repo.git
      // https://github.com/owner/repo
      // git@github.com:owner/repo.git
      match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);

      if (match) {
        return {
          owner: match[1],
          repo: match[2],
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get repository information
   * @param {Object} config - GitHub configuration
   * @returns {Promise<Object>} - Repository information
   */
  static async getRepositoryInfo(config) {
    try {
      const { repositoryUrl, username, password } = config;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;
      const response = await axios.get(apiUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      console.error('Failed to get repository info:', error.message);
      throw error;
    }
  }

  /**
   * List branches for a repository
   * @param {Object} config - GitHub configuration
   * @returns {Promise<Object>} - List of branches
   */
  static async listBranches(config) {
    try {
      const { repositoryUrl, username, password } = config;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/branches`;
      const response = await axios.get(apiUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      return {
        success: true,
        data: response.data.map((branch) => ({
          name: branch.name,
          commit: branch.commit.sha.substring(0, 7),
          protected: branch.protected,
        })),
      };
    } catch (error) {
      console.error('Failed to list branches:', error.message);
      throw error;
    }
  }

  /**
   * Push artifacts to GitHub repository
   * @param {Object} artifacts - Generated artifacts
   * @param {Object} githubConfig - GitHub configuration
   * @returns {Promise<Object>} - Push result
   */
  static async pushArtifactsToRepository(
    artifacts,
    githubConfig,
    folderPath = 'curated'
  ) {
    try {
      const { repositoryUrl, branch, username, password } = githubConfig;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      console.log(
        `Pushing artifacts for ${artifacts.entityName} to ${repoInfo.owner}/${repoInfo.repo} on branch ${branch}`
      );

      // Get the latest commit SHA for the branch
      const branchUrl = `https://api.github.com/repos/${repoInfo.owner}/${
        repoInfo.repo
      }/branches/${encodeURIComponent(branch)}`;
      const branchResponse = await axios.get(branchUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+3+json',
        },
      });

      const baseTree = branchResponse.data.commit.sha;

      // Create a new tree with the artifacts in the new folder structure
      const treeItems = [];

      // Add DDL artifacts (SQL and PySpark) to ddl folder
      if (artifacts.artifacts.sql) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/sql/${artifacts.entityName}_transform.sql`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.sql,
        });
      }

      if (artifacts.artifacts.pyspark) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/pyspark/${artifacts.entityName}_transform.py`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.pyspark,
        });
      }

      // Add NLP artifacts to transformations folder if they exist
      if (artifacts.artifacts.nlpSql) {
        treeItems.push({
          path: `${folderPath}/transformations/${artifacts.entityName}/sql/${artifacts.entityName}_nlp_transform.sql`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.nlpSql,
        });
      }

      if (artifacts.artifacts.nlpPySpark) {
        treeItems.push({
          path: `${folderPath}/transformations/${artifacts.entityName}/pyspark/${artifacts.entityName}_nlp_transform.py`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.nlpPySpark,
        });
      }

      // Add DML artifacts to dml folder if they exist
      if (artifacts.artifacts.dmlSql) {
        treeItems.push({
          path: `${folderPath}/dml/${artifacts.entityName}/sql/${artifacts.entityName}_dml.sql`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.dmlSql,
        });
      }

      if (artifacts.artifacts.dmlPySpark) {
        treeItems.push({
          path: `${folderPath}/dml/${artifacts.entityName}/pyspark/${artifacts.entityName}_dml.py`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.dmlPySpark,
        });
      }

      // Add configuration files to ddl folder
      if (artifacts.artifacts.config) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/config/${artifacts.entityName}_config.yaml`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.config,
        });
      }

      if (artifacts.artifacts.requirements) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/config/requirements.txt`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.requirements,
        });
      }

      // Add documentation to ddl folder
      if (artifacts.artifacts.documentation) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/docs/${artifacts.entityName}_README.md`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.documentation,
        });
      }

      // Add CI/CD pipeline to ddl folder
      if (artifacts.artifacts.cicd) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/.github/workflows/${artifacts.entityName}_pipeline.yml`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.cicd,
        });
      }

      // Add Dockerfile to ddl folder
      if (artifacts.artifacts.dockerfile) {
        treeItems.push({
          path: `${folderPath}/ddl/${artifacts.entityName}/Dockerfile`,
          mode: '100644',
          type: 'blob',
          content: artifacts.artifacts.dockerfile,
        });
      }

      if (treeItems.length === 0) {
        throw new Error('No artifacts to push');
      }

      console.log(
        `Created tree with ${treeItems.length} files for ${artifacts.entityName}`
      );

      // Create the tree
      const createTreeUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees`;
      const treeResponse = await axios.post(
        createTreeUrl,
        {
          base_tree: baseTree,
          tree: treeItems,
        },
        {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // Create a commit with the changes
      const createCommitUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/commits`;
      const commitMessage = `Add data pipeline artifacts for ${artifacts.entityName} in ${folderPath}/ddl, ${folderPath}/transformations, and ${folderPath}/dml folders`;

      const commitResponse = await axios.post(
        createCommitUrl,
        {
          message: commitMessage,
          tree: treeResponse.data.sha,
          parents: [baseTree],
        },
        {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // Update the branch with the new commit
      const updateBranchUrl = `https://api.github.com/repos/${repoInfo.owner}/${
        repoInfo.repo
      }/git/refs/heads/${encodeURIComponent(branch)}`;
      await axios.patch(
        updateBranchUrl,
        {
          sha: commitResponse.data.sha,
        },
        {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      console.log(
        `Successfully pushed artifacts for ${artifacts.entityName} to ${repoInfo.owner}/${repoInfo.repo}`
      );

      return {
        success: true,
        commit_sha: commitResponse.data.sha,
        commit_url: commitResponse.data.html_url,
        message: 'Artifacts pushed successfully',
      };
    } catch (error) {
      console.error('Failed to push artifacts to GitHub:', error.message);

      // Provide more detailed error information
      let errorMessage = 'Failed to push to GitHub';

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 401:
            errorMessage =
              'Authentication failed. Please check your GitHub credentials.';
            break;
          case 403:
            errorMessage =
              'Access denied. Please check:\n' +
              '1. Your GitHub token has write access to the repository\n' +
              '2. The repository is not private or you have access to it\n' +
              '3. The branch is not protected or you have permission to push to it';
            break;
          case 404:
            errorMessage =
              'Repository or branch not found. Please check the repository URL and branch name.';
            break;
          case 422:
            errorMessage =
              'Invalid request. This might be due to:\n' +
              '1. Trying to create a file that already exists\n' +
              '2. Invalid file content or path\n' +
              '3. Repository constraints';
            break;
          default:
            errorMessage = `GitHub API error (${status}): ${
              data?.message || error.message
            }`;
        }

        console.error('GitHub API Error Details:', {
          status,
          data,
          url: error.config?.url,
          method: error.config?.method,
        });
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Push all artifacts to GitHub repository in a single commit
   * @param {Array} artifactsArray - Array of artifacts objects
   * @param {Object} githubConfig - GitHub configuration
   * @param {string} newBranchName - Optional new branch name to create
   * @param {boolean} createPR - Whether to create a pull request
   * @param {string} targetBranch - Target branch for PR (default: main)
   * @returns {Promise<Object>} - Push result
   */
  static async pushAllArtifactsToRepository(
    artifactsArray,
    githubConfig,
    newBranchName = null,
    createPR = false,
    targetBranch = 'main',
    folderPath
  ) {
    try {
      const { repositoryUrl, branch, username, password } = githubConfig;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      // Determine the branch to use
      const sourceBranch = newBranchName || branch;
      const baseBranch = newBranchName ? targetBranch : branch;

      console.log(
        `Pushing ${artifactsArray.length} entities to ${repoInfo.owner}/${repoInfo.repo} on branch ${sourceBranch}`
      );

      // Get the latest commit SHA for the base branch
      const branchUrl = `https://api.github.com/repos/${repoInfo.owner}/${
        repoInfo.repo
      }/branches/${encodeURIComponent(baseBranch)}`;
      const branchResponse = await axios.get(branchUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const baseTree = branchResponse.data.commit.sha;

      // Create a new tree with all the artifacts
      const treeItems = [];
      const entityNames = [];

      // Add all artifacts to the tree
      for (const artifactData of artifactsArray) {
        const { entityName, artifacts } = artifactData;
        entityNames.push(entityName);

        console.log(`Adding artifacts for entity: ${entityName}`);

        // Add DDL artifacts (SQL and PySpark) to ddl folder
        if (artifacts.sql) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/sql/${entityName}_transform.sql`,
            mode: '100644',
            type: 'blob',
            content: artifacts.sql,
          });
        }

        if (artifacts.pyspark) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/pyspark/${entityName}_transform.py`,
            mode: '100644',
            type: 'blob',
            content: artifacts.pyspark,
          });
        }

        // Add Transformations artifacts to transformations folder if they exist
        if (artifacts.nlpSql) {
          treeItems.push({
            path: `${folderPath}/transformations/${entityName}/sql/${entityName}_transform.sql`,
            mode: '100644',
            type: 'blob',
            content: artifacts.nlpSql,
          });
        }

        if (artifacts.nlpPySpark) {
          treeItems.push({
            path: `${folderPath}/transformations/${entityName}/pyspark/${entityName}_transform.py`,
            mode: '100644',
            type: 'blob',
            content: artifacts.nlpPySpark,
          });
        }

        // Add DML artifacts to dml folder if they exist
        if (artifacts.dmlSql) {
          treeItems.push({
            path: `${folderPath}/dml/${entityName}/sql/${entityName}_dml.sql`,
            mode: '100644',
            type: 'blob',
            content: artifacts.dmlSql,
          });
        }

        if (artifacts.dmlPySpark) {
          treeItems.push({
            path: `${folderPath}/dml/${entityName}/pyspark/${entityName}_dml.py`,
            mode: '100644',
            type: 'blob',
            content: artifacts.dmlPySpark,
          });
        }

        // Add configuration files to ddl folder
        if (artifacts.config) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/config/${entityName}_config.yaml`,
            mode: '100644',
            type: 'blob',
            content: artifacts.config,
          });
        }

        if (artifacts.requirements) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/config/requirements.txt`,
            mode: '100644',
            type: 'blob',
            content: artifacts.requirements,
          });
        }

        // Add documentation to ddl folder
        if (artifacts.documentation) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/docs/${entityName}_README.md`,
            mode: '100644',
            type: 'blob',
            content: artifacts.documentation,
          });
        }

        // Add CI/CD pipeline to ddl folder
        if (artifacts.cicd) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/.github/workflows/${entityName}_pipeline.yml`,
            mode: '100644',
            type: 'blob',
            content: artifacts.cicd,
          });
        }

        // Add Dockerfile to ddl folder
        if (artifacts.dockerfile) {
          treeItems.push({
            path: `${folderPath}/ddl/${entityName}/Dockerfile`,
            mode: '100644',
            type: 'blob',
            content: artifacts.dockerfile,
          });
        }
      }

      console.log(
        `Created tree with ${treeItems.length} files for ${entityNames.length} entities`
      );

      // Create the tree
      const createTreeUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees`;
      const treeResponse = await axios.post(
        createTreeUrl,
        {
          base_tree: baseTree,
          tree: treeItems,
        },
        {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // Create a commit with all changes
      const createCommitUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/commits`;
      const commitMessage = `Add data pipeline artifacts for ${
        entityNames.length
      } entities: ${entityNames.join(', ')}`;

      const commitResponse = await axios.post(
        createCommitUrl,
        {
          message: commitMessage,
          tree: treeResponse.data.sha,
          parents: [baseTree],
        },
        {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      // Create new branch if specified
      if (newBranchName) {
        console.log(`Creating new branch: ${newBranchName}`);
        const createBranchUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/refs`;
        await axios.post(
          createBranchUrl,
          {
            ref: `refs/heads/${newBranchName}`,
            sha: commitResponse.data.sha,
          },
          {
            headers: {
              ...auth,
              'User-Agent': 'DR.ai-Application',
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
        console.log(`Successfully created branch: ${newBranchName}`);
      } else {
        // Update the existing branch reference
        const updateRefUrl = `https://api.github.com/repos/${repoInfo.owner}/${
          repoInfo.repo
        }/git/refs/heads/${encodeURIComponent(sourceBranch)}`;
        await axios.patch(
          updateRefUrl,
          {
            sha: commitResponse.data.sha,
          },
          {
            headers: {
              ...auth,
              'User-Agent': 'DR.ai-Application',
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );
      }

      const commitUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${commitResponse.data.sha}`;
      let prUrl = null;

      // Create pull request if requested
      if (createPR && newBranchName) {
        console.log(
          `Creating pull request from ${newBranchName} to ${targetBranch}`
        );
        const createPRUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/pulls`;
        const prTitle = `Add data pipeline artifacts for ${entityNames.length} entities`;
        const prBody = `## Summary
This PR adds data pipeline artifacts for ${
          entityNames.length
        } entities: ${entityNames.join(', ')}

## Changes
- Generated SQL transformations for all entities
- Generated PySpark transformations for all entities
- All artifacts follow the standard pipeline structure

## Files Added
${treeItems.map((item) => `- \`${item.path}\``).join('\n')}

## Branch
- Source: \`${newBranchName}\`
- Target: \`${targetBranch}\`

## Commit
${commitMessage}

---
*Generated by DR.ai Application*`;

        const prResponse = await axios.post(
          createPRUrl,
          {
            title: prTitle,
            body: prBody,
            head: newBranchName,
            base: targetBranch,
          },
          {
            headers: {
              ...auth,
              'User-Agent': 'DR.ai-Application',
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        prUrl = prResponse.data.html_url;
        console.log(`Successfully created pull request: ${prUrl}`);
      }

      console.log(
        `Successfully pushed all artifacts in single commit: ${commitUrl}`
      );

      return {
        success: true,
        message: `Successfully pushed artifacts for ${
          entityNames.length
        } entities${newBranchName ? ` to new branch ${newBranchName}` : ''}${
          createPR ? ' and created pull request' : ''
        }`,
        data: {
          commit_url: commitUrl,
          commit_sha: commitResponse.data.sha,
          commit_message: commitMessage,
          entities: entityNames,
          files_count: treeItems.length,
          branch: sourceBranch,
          pr_url: prUrl,
        },
      };
    } catch (error) {
      console.error('Failed to push all artifacts to GitHub:', error.message);
      throw error;
    }
  }

  /**
   * Check existing files in repository for a specific entity
   * @param {Object} githubConfig - GitHub configuration
   * @param {string} entityName - Entity name to check
   * @returns {Promise<Object>} - Existing files information
   */
  static async checkExistingFiles(githubConfig, entityName, folderPath) {
    try {
      const { repositoryUrl, branch, username, password } = githubConfig;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      // Get the latest commit SHA for the branch
      const branchUrl = `https://api.github.com/repos/${repoInfo.owner}/${
        repoInfo.repo
      }/branches/${encodeURIComponent(branch)}`;
      const branchResponse = await axios.get(branchUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const baseTree = branchResponse.data.commit.sha;

      // Get the tree contents
      const treeUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${baseTree}?recursive=1`;
      const treeResponse = await axios.get(treeUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const existingFiles = {};

      // Define the subfolder paths where artifacts are stored
      const subfolderPaths = [
        `${folderPath}/ddl/${entityName}`,
        `${folderPath}/dml/${entityName}`,
        `${folderPath}/transformations/${entityName}`,
        `${folderPath}/ddl/${entityName}/sql`,
        `${folderPath}/ddl/${entityName}/pyspark`,
        `${folderPath}/ddl/${entityName}/config`,
        `${folderPath}/ddl/${entityName}/docs`,
        `${folderPath}/ddl/${entityName}/.github/workflows`,
        `${folderPath}/dml/${entityName}/sql`,
        `${folderPath}/dml/${entityName}/pyspark`,
        `${folderPath}/transformations/${entityName}/sql`,
        `${folderPath}/transformations/${entityName}/pyspark`,
      ];

      console.log(
        `Looking for files in subfolder paths for entity: ${entityName}`
      );
      console.log(`Subfolder paths to check:`, subfolderPaths);
      console.log(`Total files in tree: ${treeResponse.data.tree.length}`);

      // Filter files for this entity in all subfolder paths
      treeResponse.data.tree.forEach((item) => {
        // Check if the file path starts with any of the subfolder paths
        const isEntityFile = subfolderPaths.some(
          (subfolderPath) =>
            item.path.startsWith(subfolderPath) && item.type === 'blob'
        );

        if (isEntityFile) {
          console.log(`Found existing file: ${item.path} (size: ${item.size})`);
          existingFiles[item.path] = {
            sha: item.sha,
            size: item.size,
            url: item.url,
          };
        }
      });

      console.log(
        `Total existing files for entity: ${Object.keys(existingFiles).length}`
      );
      console.log(`Existing file paths:`, Object.keys(existingFiles));

      return {
        success: true,
        data: {
          existingFiles,
          totalFiles: Object.keys(existingFiles).length,
          subfolderPaths,
        },
      };
    } catch (error) {
      console.error('Failed to check existing files:', error.message);
      throw new Error(`Failed to check existing files: ${error.message}`);
    }
  }

  /**
   * Get file content from GitHub
   * @param {string} fileUrl - GitHub file URL
   * @param {Object} auth - Authentication headers
   * @returns {Promise<string>} - File content
   */
  static async getFileContent(fileUrl, auth) {
    try {
      console.log(`Fetching file content from: ${fileUrl}`);
      const response = await axios.get(fileUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      console.log('GitHub API Response Status:', response.status);
      console.log('GitHub API Response Headers:', response.headers);
      console.log('GitHub API Response Data Keys:', Object.keys(response.data));

      if (!response.data.content) {
        console.log('No content field in response:', response.data);
        return null;
      }

      // GitHub returns content in base64
      const content = Buffer.from(response.data.content, 'base64').toString(
        'utf-8'
      );
      console.log(`Retrieved content length: ${content.length}`);
      console.log(`Content preview: ${content.substring(0, 100)}...`);

      return content;
    } catch (error) {
      console.error('Failed to get file content:', error.message);
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * Generate diff between existing and new artifacts
   * @param {Object} artifacts - New artifacts
   * @param {Object} githubConfig - GitHub configuration
   * @returns {Promise<Object>} - Diff information
   */
  static async generateArtifactsDiff(artifacts, githubConfig, folderPath) {
    try {
      const { repositoryUrl, branch, username, password } = githubConfig;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      // Check existing files (but don't fail if authentication fails)
      let existingFiles = {};
      try {
        const existingFilesResult = await this.checkExistingFiles(
          githubConfig,
          artifacts.entityName,
          folderPath
        );
        existingFiles = existingFilesResult.data.existingFiles;
      } catch (error) {
        console.log(
          `Could not check existing files for ${artifacts.entityName}: ${error.message}`
        );
        console.log(
          'Proceeding with diff generation assuming all files are new'
        );
        existingFiles = {};
      }

      // Define new artifact files with the new folder structure
      const newArtifacts = {};

      // Add DDL artifacts (SQL and PySpark) to ddl folder
      if (artifacts.artifacts.sql) {
        newArtifacts[
          `${folderPath}/ddl/${artifacts.entityName}/sql/${artifacts.entityName}_transform.sql`
        ] = artifacts.artifacts.sql;
      }

      if (artifacts.artifacts.pyspark) {
        newArtifacts[
          `${folderPath}/ddl/${artifacts.entityName}/pyspark/${artifacts.entityName}_transform.py`
        ] = artifacts.artifacts.pyspark;
      }

      // Add Transformations artifacts to transformations folder if they exist
      console.log(
        `Checking transformation artifacts for ${artifacts.entityName}:`,
        {
          hasNlpSql: !!artifacts.artifacts.nlpSql,
          nlpSqlLength: artifacts.artifacts.nlpSql?.length || 0,
          hasNlpPySpark: !!artifacts.artifacts.nlpPySpark,
          nlpPySparkLength: artifacts.artifacts.nlpPySpark?.length || 0,
        }
      );

      if (artifacts.artifacts.nlpSql) {
        newArtifacts[
          `${folderPath}/transformations/${artifacts.entityName}/sql/${artifacts.entityName}_nlp_transform.sql`
        ] = artifacts.artifacts.nlpSql;
        console.log(
          `Added transformation SQL to: ${folderPath}/transformations/${artifacts.entityName}/sql/${artifacts.entityName}_nlp_transform.sql`
        );
      }

      if (artifacts.artifacts.nlpPySpark) {
        newArtifacts[
          `${folderPath}/transformations/${artifacts.entityName}/pyspark/${artifacts.entityName}_nlp_transform.py`
        ] = artifacts.artifacts.nlpPySpark;
        console.log(
          `Added transformation PySpark to: ${folderPath}/transformations/${artifacts.entityName}/pyspark/${artifacts.entityName}_nlp_transform.py`
        );
      }

      // Add DML artifacts to dml folder if they exist
      if (artifacts.artifacts.dmlSql) {
        newArtifacts[
          `${folderPath}/dml/${artifacts.entityName}/sql/${artifacts.entityName}_dml.sql`
        ] = artifacts.artifacts.dmlSql;
      }

      if (artifacts.artifacts.dmlPySpark) {
        newArtifacts[
          `${folderPath}/dml/${artifacts.entityName}/pyspark/${artifacts.entityName}_dml.py`
        ] = artifacts.artifacts.dmlPySpark;
      }

      // Add configuration files to ddl folder
      if (artifacts.artifacts.config) {
        newArtifacts[
          `${folderPath}/ddl/${artifacts.entityName}/config/${artifacts.entityName}_config.yaml`
        ] = artifacts.artifacts.config;
      }

      if (artifacts.artifacts.requirements) {
        newArtifacts[
          `${folderPath}/ddl/${artifacts.entityName}/config/requirements.txt`
        ] = artifacts.artifacts.requirements;
      }

      // Add documentation to ddl folder
      if (artifacts.artifacts.documentation) {
        newArtifacts[
          `${folderPath}/ddl/${artifacts.entityName}/docs/${artifacts.entityName}_README.md`
        ] = artifacts.artifacts.documentation;
      }

      // Add CI/CD pipeline to ddl folder
      if (artifacts.artifacts.cicd) {
        newArtifacts[
          `${folderPath}/ddl/${artifacts.entityName}/.github/workflows/${artifacts.entityName}_pipeline.yml`
        ] = artifacts.artifacts.cicd;
      }

      // Add Dockerfile to ddl folder
      if (artifacts.artifacts.dockerfile) {
        newArtifacts[`${folderPath}/ddl/${artifacts.entityName}/Dockerfile`] =
          artifacts.artifacts.dockerfile;
      }

      console.log(`Entity name: ${artifacts.entityName}`);
      console.log(`New artifacts to compare:`, Object.keys(newArtifacts));
      console.log(`Artifacts object:`, artifacts.artifacts);
      console.log(
        `SQL content length: ${artifacts.artifacts.sql?.length || 0}`
      );
      console.log(
        `PySpark content length: ${artifacts.artifacts.pyspark?.length || 0}`
      );
      console.log(
        `Transformations SQL content length: ${
          artifacts.artifacts.nlpSql?.length || 0
        }`
      );
      console.log(
        `Transformations PySpark content length: ${
          artifacts.artifacts.nlpPySpark?.length || 0
        }`
      );
      console.log(
        `DML SQL content length: ${artifacts.artifacts.dmlSql?.length || 0}`
      );
      console.log(
        `DML PySpark content length: ${
          artifacts.artifacts.dmlPySpark?.length || 0
        }`
      );

      const diff = {
        newFiles: [],
        modifiedFiles: [],
        unchangedFiles: [],
        deletedFiles: [],
        summary: {
          total: Object.keys(newArtifacts).length,
          new: 0,
          modified: 0,
          unchanged: 0,
          deleted: 0,
        },
      };

      // Store previous versions for frontend display - separate by file type
      const previousVersions = {
        // DDL files
        sql: null, // DDL SQL
        pyspark: null, // DDL PySpark

        // DML files
        dmlSql: null, // DML SQL
        dmlPySpark: null, // DML PySpark

        // Transformations files
        nlpSql: null, // Transformations SQL
        nlpPySpark: null, // Transformations PySpark
      };

      // Compare files
      for (const [filePath, newContent] of Object.entries(newArtifacts)) {
        console.log(`Comparing file: ${filePath}`);
        console.log(`New content length: ${newContent.length}`);

        if (existingFiles[filePath]) {
          console.log(`File exists in repository: ${filePath}`);
          // File exists, check if content is different
          const existingContent = await this.getFileContent(
            existingFiles[filePath].url,
            auth
          );

          console.log(
            `Existing content length: ${existingContent?.length || 0}`
          );

          // Store previous version for frontend display - categorize by file type and folder
          if (filePath.includes('/ddl/') && filePath.includes('/sql/')) {
            // DDL SQL file
            previousVersions.sql = existingContent;
          } else if (
            filePath.includes('/ddl/') &&
            filePath.includes('/pyspark/')
          ) {
            // DDL PySpark file
            previousVersions.pyspark = existingContent;
          } else if (filePath.includes('/dml/') && filePath.includes('/sql/')) {
            // DML SQL file
            previousVersions.dmlSql = existingContent;
          } else if (
            filePath.includes('/dml/') &&
            filePath.includes('/pyspark/')
          ) {
            // DML PySpark file
            previousVersions.dmlPySpark = existingContent;
          } else if (
            filePath.includes('/transformations/') &&
            filePath.includes('/sql/')
          ) {
            // Transformations SQL file
            previousVersions.nlpSql = existingContent;
          } else if (
            filePath.includes('/transformations/') &&
            filePath.includes('/pyspark/')
          ) {
            // Transformations PySpark file
            previousVersions.nlpPySpark = existingContent;
          }

          // Normalize content for comparison (trim whitespace and normalize line endings)
          const normalizedNewContent = newContent
            .trim()
            .replace(/\r\n/g, '\n')
            .replace(/\s+/g, ' ');
          const normalizedExistingContent = (existingContent || '')
            .trim()
            .replace(/\r\n/g, '\n')
            .replace(/\s+/g, ' ');

          console.log(
            `Normalized new content length: ${normalizedNewContent.length}`
          );
          console.log(
            `Normalized existing content length: ${normalizedExistingContent.length}`
          );
          console.log(
            `Content is identical: ${
              normalizedNewContent === normalizedExistingContent
            }`
          );

          if (normalizedNewContent === normalizedExistingContent) {
            console.log(`File unchanged: ${filePath}`);
            diff.unchangedFiles.push({
              path: filePath,
              size: existingFiles[filePath].size,
            });
            diff.summary.unchanged++;
          } else {
            console.log(`File modified: ${filePath}`);
            console.log(`Content difference detected:`);
            console.log(
              `- New content starts with: ${normalizedNewContent.substring(
                0,
                200
              )}`
            );
            console.log(
              `- Existing content starts with: ${normalizedExistingContent.substring(
                0,
                200
              )}`
            );

            diff.modifiedFiles.push({
              path: filePath,
              existingSize: existingFiles[filePath].size,
              newSize: newContent.length,
              existingSha: existingFiles[filePath].sha,
            });
            diff.summary.modified++;
          }
        } else {
          console.log(`New file: ${filePath}`);
          // New file
          diff.newFiles.push({
            path: filePath,
            size: newContent.length,
          });
          diff.summary.new++;
        }
      }

      // Check for deleted files (files that exist in repo but not in new artifacts)
      for (const filePath of Object.keys(existingFiles)) {
        if (!newArtifacts[filePath]) {
          diff.deletedFiles.push({
            path: filePath,
            size: existingFiles[filePath].size,
            sha: existingFiles[filePath].sha,
          });
          diff.summary.deleted++;
        }
      }

      console.log('Returning diff with previous versions:', {
        sql: !!previousVersions.sql,
        pyspark: !!previousVersions.pyspark,
        sqlLength: previousVersions.sql?.length || 0,
        pysparkLength: previousVersions.pyspark?.length || 0,
      });

      return {
        success: true,
        data: {
          ...diff,
          previousVersions: previousVersions,
        },
      };
    } catch (error) {
      console.error('Failed to generate diff:', error.message);

      // Provide more detailed error information
      let errorMessage = 'Failed to generate diff';

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 401:
            errorMessage =
              'Authentication failed. Please check your GitHub credentials.';
            break;
          case 403:
            errorMessage =
              'Access denied. Please check:\n' +
              '1. Your GitHub token has read access to the repository\n' +
              '2. The repository is not private or you have access to it';
            break;
          case 404:
            errorMessage =
              'Repository or branch not found. Please check the repository URL and branch name.';
            break;
          default:
            errorMessage = `GitHub API error (${status}): ${
              data?.message || error.message
            }`;
        }

        console.error('GitHub Diff API Error Details:', {
          status,
          data,
          url: error.config?.url,
          method: error.config?.method,
        });
      } else if (error.request) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Test write permissions to repository
   * @param {Object} config - GitHub configuration
   * @returns {Promise<Object>} - Write permission test result
   */
  static async testWritePermissions(config) {
    try {
      const { repositoryUrl, branch, username, password } = config;
      const repoInfo = this.extractRepoInfo(repositoryUrl);

      if (!repoInfo) {
        throw new Error('Invalid repository URL format');
      }

      const isToken = !password || password.trim() === '';
      const auth = isToken
        ? { Authorization: `token ${username}` }
        : {
            Authorization: `Basic ${Buffer.from(
              `${username}:${password}`
            ).toString('base64')}`,
          };

      // Test repository access and permissions
      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}`;
      const response = await axios.get(apiUrl, {
        headers: {
          ...auth,
          'User-Agent': 'DR.ai-Application',
          Accept: 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      });

      const permissions = response.data.permissions;

      if (!permissions) {
        throw new Error('Unable to determine repository permissions');
      }

      const hasWriteAccess = permissions.push || permissions.admin;

      if (!hasWriteAccess) {
        throw new Error(
          'No write access to repository. Required permissions: push or admin'
        );
      }

      // Test branch access
      const branchUrl = `https://api.github.com/repos/${repoInfo.owner}/${
        repoInfo.repo
      }/branches/${encodeURIComponent(branch)}`;

      let branchData;
      try {
        const branchResponse = await axios.get(branchUrl, {
          headers: {
            ...auth,
            'User-Agent': 'DR.ai-Application',
            Accept: 'application/vnd.github.v3+json',
          },
          timeout: 10000,
        });
        branchData = branchResponse.data;
      } catch (branchError) {
        if (branchError.response && branchError.response.status === 404) {
          throw new Error(`Branch '${branch}' not found in repository`);
        }
        throw branchError;
      }

      // Test Git tree creation (this is what actually fails with 403)
      const testTreeUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees`;
      try {
        await axios.post(
          testTreeUrl,
          {
            base_tree: branchData.commit.sha,
            tree: [
              {
                path: 'test-write-permission.txt',
                mode: '100644',
                type: 'blob',
                content:
                  'Test write permission - this file will be deleted immediately',
              },
            ],
          },
          {
            headers: {
              ...auth,
              'User-Agent': 'DR.ai-Application',
              Accept: 'application/vnd.github.v3+json',
            },
            timeout: 10000,
          }
        );
      } catch (treeError) {
        if (treeError.response && treeError.response.status === 403) {
          throw new Error(
            'Git tree creation failed (403). This usually means:\n' +
              '1. Your token lacks the "repo" scope for private repositories\n' +
              '2. Your token lacks the "public_repo" scope for public repositories\n' +
              '3. The repository has branch protection rules\n' +
              '4. You need to be a collaborator with write access'
          );
        }
        throw treeError;
      }

      return {
        success: true,
        message:
          'Write permissions verified successfully - Git operations tested',
        data: {
          repository: `${repoInfo.owner}/${repoInfo.repo}`,
          branch: branch,
          permissions: permissions,
          private: response.data.private,
          defaultBranch: response.data.default_branch,
          gitOperationsTested: true,
        },
      };
    } catch (error) {
      console.error('Write permission test failed:', error.message);
      throw error;
    }
  }
}

module.exports = GitHubService;
