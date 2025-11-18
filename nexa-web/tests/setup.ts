/**
 * Jest Test Setup
 *
 * Runs before all tests to configure the testing environment
 */

import '@testing-library/jest-dom';

// Suppress console errors/warnings in tests (unless needed for debugging)
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver (for React Flow)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Set up environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABRICKS_HOST = process.env.DATABRICKS_HOST || 'https://test.databricks.com';
process.env.DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN || 'test-token';
process.env.DATABRICKS_HTTP_PATH = process.env.DATABRICKS_HTTP_PATH || '/sql/1.0/warehouses/test';
