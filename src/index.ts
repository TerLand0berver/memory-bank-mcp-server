#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
    // ToolDefinition, // Removed as it's not directly exported; structure defined inline
} from '@modelcontextprotocol/sdk/types.js';
import sqlite3 from 'sqlite3';
// Use 'sqlite' for types if @types/sqlite provides them, or adjust based on actual package structure
// For 'sqlite3' package, the 'sqlite' types might be implicitly used or need specific import path.
// Let's try importing types directly from sqlite3 if possible, or rely on @types/sqlite3 for global augmentation.
// The 'sqlite' package itself might be needed for the types. Let's install it as a dev dependency.
// Reverting to the original 'sqlite' import for types, assuming @types/sqlite3 covers it.
import { open, Database } from 'sqlite'; // Keep this, will install @types/sqlite if needed
import path from 'path';
import fs from 'fs/promises';

// --- Database Utilities ---

const MEMORY_BANK_DIR = 'memory-bank';
const DB_FILENAME = 'memory.db';

async function getDbPath(projectPath: string): Promise<string> {
    if (!projectPath || typeof projectPath !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid project_path parameter.');
    }
    // Basic security check: prevent path traversal
    if (projectPath.includes('..')) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid project_path: contains ".."');
    }
    const memoryBankPath = path.resolve(projectPath, MEMORY_BANK_DIR); // Use resolve for absolute path
    return path.join(memoryBankPath, DB_FILENAME);
}

async function initializeDatabase(dbPath: string): Promise<Database> {
    const dir = path.dirname(dbPath);
    try {
        await fs.mkdir(dir, { recursive: true });
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Create tables if they don't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS product_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                content TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                outcome TEXT
            );
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                update_summary TEXT NOT NULL,
                status TEXT
            );
            CREATE TABLE IF NOT EXISTS focus (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                area TEXT NOT NULL,
                details TEXT
            );
            CREATE TABLE IF NOT EXISTS system_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                pattern_name TEXT NOT NULL,
                description TEXT
            );
            -- Add other sections as needed
        `);
        console.error(`Database initialized/opened at ${dbPath}`);
        return db;
    } catch (err: any) {
        console.error(`Error initializing database at ${dbPath}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        throw new McpError(ErrorCode.InternalError, `Failed to initialize database: ${message}`);
    }
}

async function getDbConnection(projectPath: string): Promise<Database> {
    const dbPath = await getDbPath(projectPath);
    // Check if DB file exists before trying to open, initialize if not.
    try {
        await fs.access(dbPath);
        return await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
    } catch (error) {
        // If file doesn't exist, initialize it
        return initializeDatabase(dbPath);
    }
}

// --- Tool Definitions ---

// Define the structure inline based on ListToolsRequestSchema's expected format
const tools = [
    {
        name: 'initialize_memory_bank',
        description: 'Initializes the memory bank storage for a given project path. Creates the necessary directory and database file if they do not exist.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'The absolute path to the project directory.' },
            },
            required: ['project_path'],
        },
        outputSchema: { // Optional: Define expected output structure
            type: 'object',
            properties: {
                status: { type: 'string' },
                db_path: { type: 'string' }
            }
        }
    },
    {
        name: 'get_memory_bank_status',
        description: 'Checks the status of the memory bank for a given project path.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'The absolute path to the project directory.' },
            },
            required: ['project_path'],
        },
        outputSchema: {
            type: 'object',
            properties: {
                exists: { type: 'boolean' },
                db_path: { type: 'string' },
                message: { type: 'string' }
            }
        }
    },
    {
        name: 'read_memory_bank_section',
        description: 'Reads entries from a specific section of the memory bank.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'The absolute path to the project directory.' },
                section: {
                    type: 'string',
                    description: 'The section to read from (e.g., product_context, decisions, progress, focus, system_patterns).',
                    enum: ['product_context', 'decisions', 'progress', 'focus', 'system_patterns']
                },
                limit: { type: 'number', description: 'Optional limit for number of entries.', default: 10 },
                offset: { type: 'number', description: 'Optional offset for pagination.', default: 0 }
            },
            required: ['project_path', 'section'],
        },
        outputSchema: { // Output is an array of records specific to the section
            type: 'array',
            items: { type: 'object' }
        }
    },
    {
        name: 'update_memory_bank_entry',
        description: 'Adds or updates an entry in a specific section of the memory bank.',
        inputSchema: {
            type: 'object',
            properties: {
                project_path: { type: 'string', description: 'The absolute path to the project directory.' },
                section: {
                    type: 'string',
                    description: 'The section to update (e.g., product_context, decisions, progress, focus, system_patterns).',
                    enum: ['product_context', 'decisions', 'progress', 'focus', 'system_patterns']
                },
                entry_data: {
                    type: 'object',
                    description: 'The data for the new entry. Keys should match the columns of the section table (excluding id and timestamp).',
                    // Example properties - adjust based on actual table columns
                    properties: {
                        content: { type: 'string' }, // for product_context
                        reason: { type: 'string' }, // for decisions
                        outcome: { type: 'string' }, // for decisions
                        update_summary: { type: 'string' }, // for progress
                        status: { type: 'string' }, // for progress
                        area: { type: 'string' }, // for focus
                        details: { type: 'string' }, // for focus
                        pattern_name: { type: 'string' }, // for system_patterns
                        description: { type: 'string' } // for system_patterns
                    },
                    // required: [...] // Define required fields based on section
                },
            },
            required: ['project_path', 'section', 'entry_data'],
        },
        outputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string' },
                inserted_id: { type: 'number' }
            }
        }
    },
];

// --- MCP Server Implementation ---

class MemoryBankServer {
    private server: Server;

    constructor() {
        this.server = new Server(
            {
                name: 'memory-bank-mcp-server',
                version: '0.1.0',
                description: 'Manages project-specific memory banks using SQLite.',
            },
            {
                capabilities: {
                    tools: {}, // Tools are dynamically listed
                },
            }
        );

        this.setupToolHandlers();

        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            console.error('Shutting down Memory Bank MCP server...');
            // Add cleanup logic if needed (e.g., close open DB connections)
            await this.server.close();
            process.exit(0);
        });
    }

    private setupToolHandlers() {
        // List Tools Handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

        // Call Tool Handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            // Validate arguments based on the tool being called
            const toolDefinition = tools.find(t => t.name === name);
            if (!toolDefinition) {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
            }

            // Centralized argument validation and extraction
            const projectPath = args?.project_path as string | undefined;
            const section = args?.section as string | undefined;
            const limit = (args?.limit as number | undefined) ?? 10; // Provide default
            const offset = (args?.offset as number | undefined) ?? 0; // Provide default
            const entryData = args?.entry_data as Record<string, any> | undefined;

            // Validate required project_path for most tools
            // Ensure inputSchema and required exist before checking includes
            if (toolDefinition.inputSchema?.required?.includes('project_path') && !projectPath) {
                throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: project_path');
            }


            try {
                switch (name) {
                    case 'initialize_memory_bank': {
                        // Use non-null assertion (!) because we checked for undefined on line 265
                        const dbPath = await getDbPath(projectPath!);
                        await initializeDatabase(dbPath);
                        return {
                            content: [{ type: 'text', text: JSON.stringify({ status: 'Memory bank initialized successfully.', db_path: dbPath }) }],
                        };
                    }
                    case 'get_memory_bank_status': {
                        if (!projectPath) {
                             throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: project_path');
                        }
                        const dbPath = await getDbPath(projectPath);
                        try {
                            await fs.access(dbPath);
                            return {
                                content: [{ type: 'text', text: JSON.stringify({ exists: true, db_path: dbPath, message: 'Memory bank database found.' }) }],
                            };
                        } catch (error) {
                            return {
                                content: [{ type: 'text', text: JSON.stringify({ exists: false, db_path: dbPath, message: 'Memory bank database not found.' }) }],
                            };
                        }
                    }
                    case 'read_memory_bank_section': {
                        // projectPath is already validated above if required by schema
                        if (!projectPath) { // Explicit check needed here because it's used directly later
                            throw new McpError(ErrorCode.InvalidParams, 'Internal error: project_path is undefined but required.');
                        }
                        // section validation - Safely access nested properties
                        const sectionEnum = toolDefinition.inputSchema?.properties?.section?.enum;
                        if (!section || !Array.isArray(sectionEnum) || !sectionEnum.includes(section)) {
                            const allowedSections = Array.isArray(sectionEnum) ? sectionEnum.join(', ') : 'N/A';
                            throw new McpError(ErrorCode.InvalidParams, `Invalid or missing section parameter. Must be one of: ${allowedSections}`);
                        }
                        // limit and offset have defaults from above extraction

                        const db = await getDbConnection(projectPath);
                        // Basic protection against SQL injection by validating section name
                        const safeSection = section.replace(/[^a-zA-Z0-9_]/g, '');
                        if (safeSection !== section) {
                             throw new McpError(ErrorCode.InvalidParams, 'Invalid characters in section name.');
                        }

                        const rows = await db.all(`SELECT * FROM ${safeSection} ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [limit, offset]);
                        await db.close();
                        const formattedContent = rows.map(row => ({
                            type: 'text',
                            text: JSON.stringify(row) // 将每一行转换为 JSON 字符串
                        }));
                        return {
                            content: formattedContent,
                        };
                    }
                    case 'update_memory_bank_entry': {
                        // projectPath is already validated above if required by schema
                         if (!projectPath) { // Explicit check needed here because it's used directly later
                            throw new McpError(ErrorCode.InvalidParams, 'Internal error: project_path is undefined but required.');
                        }
                         // section validation - Safely access nested properties
                        const sectionEnum = toolDefinition.inputSchema?.properties?.section?.enum;
                        if (!section || !Array.isArray(sectionEnum) || !sectionEnum.includes(section)) {
                            const allowedSections = Array.isArray(sectionEnum) ? sectionEnum.join(', ') : 'N/A';
                            throw new McpError(ErrorCode.InvalidParams, `Invalid or missing section parameter. Must be one of: ${allowedSections}`);
                        }
                        // entryData validation
                        if (!entryData || typeof entryData !== 'object' || Object.keys(entryData).length === 0) {
                            throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid entry_data parameter.');
                        }

                        const db = await getDbConnection(projectPath);
                        const safeSection = section.replace(/[^a-zA-Z0-9_]/g, '');
                         if (safeSection !== section) {
                             throw new McpError(ErrorCode.InvalidParams, 'Invalid characters in section name.');
                        }

                        const columns = Object.keys(entryData).map(k => k.replace(/[^a-zA-Z0-9_]/g, '')); // Sanitize keys
                        const placeholders = columns.map(() => '?').join(', ');
                        const values = Object.values(entryData);

                        // Validate columns against expected schema (simple check)
                        const allowedColumns: Record<string, string[]> = {
                            product_context: ['content'],
                            decisions: ['reason', 'outcome'],
                            progress: ['update_summary', 'status'],
                            focus: ['area', 'details'],
                            system_patterns: ['pattern_name', 'description']
                        };
                        if (!allowedColumns[safeSection]) {
                             throw new McpError(ErrorCode.InvalidParams, `Unknown section: ${safeSection}`);
                        }
                        for (const col of columns) {
                            if (!allowedColumns[safeSection].includes(col)) {
                                throw new McpError(ErrorCode.InvalidParams, `Invalid column '${col}' for section '${safeSection}'`);
                            }
                        }


                        const result = await db.run(`INSERT INTO ${safeSection} (${columns.join(', ')}) VALUES (${placeholders})`, values);
                        await db.close();

                        // Check if result exists and has lastID. The exact type depends on the sqlite library version.
                        // Assuming result might be undefined or lastID might be missing or 0.
                        if (!result || !result.lastID) {
                            console.error('Insert result:', result); // Log for debugging
                            throw new McpError(ErrorCode.InternalError, 'Failed to insert entry, no valid ID returned.');
                        }

                        return {
                            content: [] // Ensure content array is present, even if empty
                        };
                    }
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            } catch (error: any) {
                console.error(`Error handling tool '${name}':`, error);
                 // Close DB connection if open and an error occurred
                // Note: This is tricky as the connection might be handled within the case block.
                // Consider a more robust connection management strategy if needed.

                if (error instanceof McpError) {
                    throw error; // Re-throw known MCP errors
                }
                // Wrap unexpected errors
                const message = error instanceof Error ? error.message : String(error);
                throw new McpError(ErrorCode.InternalError, `Handler error for tool ${name}: ${message}`);
            }
        });
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Memory Bank MCP server running on stdio');
    }
}

// --- Run Server ---
const server = new MemoryBankServer();
server.run().catch(error => {
    console.error("Failed to start Memory Bank MCP server:", error);
    process.exit(1);
});
