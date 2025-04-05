#!/usr/bin/env node

// This script starts the Memory Bank MCP Server.
// It imports the main server logic from the build directory.

import '../build/index.js';

// The server logic in build/index.js should handle initialization and startup.
console.log("Starting Memory Bank MCP Server via CLI...");