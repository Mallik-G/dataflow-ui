import { GitHubConfig } from '../../types/settings';

export class GitHubAPI {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Test GitHub connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Repository not accessible');
      }

      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }

  /**
   * Create or update file in repository
   */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string
  ): Promise<{ success: boolean; sha?: string; message: string }> {
    try {
      const fullPath = this.config.basePath
        ? `${this.config.basePath}/${path}`
        : path;

      // Check if file exists
      const existingFile = await this.getFile(fullPath);

      const encodedContent = btoa(unescape(encodeURIComponent(content)));

      const requestBody: any = {
        message,
        content: encodedContent,
        branch: this.config.branch,
      };

      if (existingFile) {
        requestBody.sha = existingFile.sha;
      }

      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${fullPath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'File commit failed');
      }

      const data = await response.json();
      return {
        success: true,
        sha: data.content.sha,
        message: 'File committed successfully',
      };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }

  /**
   * Get file from repository
   */
  async getFile(path: string): Promise<{ sha: string; content: string } | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      const data = await response.json();
      const decodedContent = decodeURIComponent(escape(atob(data.content)));

      return {
        sha: data.sha,
        content: decodedContent,
      };
    } catch (error) {
      console.error('GitHub getFile error:', error);
      return null;
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    title: string,
    body: string,
    head: string,
    base: string = 'main'
  ): Promise<{ success: boolean; prUrl?: string; message: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/pulls`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            body,
            head,
            base,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'PR creation failed');
      }

      const data = await response.json();
      return {
        success: true,
        prUrl: data.html_url,
        message: 'Pull request created successfully',
      };
    } catch (error) {
      return { success: false, message: `Failed: ${error}` };
    }
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath: string = ''): Promise<string[]> {
    try {
      const fullPath = this.config.basePath
        ? `${this.config.basePath}/${dirPath}`
        : dirPath;

      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${fullPath}?ref=${this.config.branch}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      const data = await response.json();
      return Array.isArray(data) ? data.map((item) => item.name) : [];
    } catch (error) {
      console.error('GitHub listFiles error:', error);
      return [];
    }
  }
}
