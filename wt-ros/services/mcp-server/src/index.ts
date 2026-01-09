#!/usr/bin/env node
/**
 * WT-ROS MCP Server
 * Exposes work tracking functionality via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import {
  MCP_TOOLS,
  MCPToolName,
  validateGetWorkItemsInput,
  validateUpdateWorkStatusInput,
  validateCreateWorkUpdateInput,
  validateLinkArtifactInput,
  validateGetStaleItemsInput,
} from './tools/WorkItemTools.js';

import {
  workItemHandler,
  GetWorkItemsInput,
  UpdateWorkStatusInput,
  CreateWorkUpdateInput,
  LinkArtifactInput,
  GetStaleItemsInput,
} from './handlers/WorkItemHandler.js';

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'wt-ros-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: MCP_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name as MCPToolName) {
        case 'get_work_items': {
          const validation = validateGetWorkItemsInput(args);
          if (!validation.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid input: ${validation.error.message}`
            );
          }
          const result = await workItemHandler.getWorkItems(validation.data as GetWorkItemsInput);
          if (!result.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: result.error }, null, 2),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    count: result.data?.length || 0,
                    items: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'update_work_status': {
          const validation = validateUpdateWorkStatusInput(args);
          if (!validation.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid input: ${validation.error.message}`
            );
          }
          const result = await workItemHandler.updateWorkStatus(
            validation.data as UpdateWorkStatusInput
          );
          if (!result.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: result.error }, null, 2),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: 'Work item status updated successfully',
                    item: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'create_work_update': {
          const validation = validateCreateWorkUpdateInput(args);
          if (!validation.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid input: ${validation.error.message}`
            );
          }
          const result = await workItemHandler.createWorkUpdate(
            validation.data as CreateWorkUpdateInput
          );
          if (!result.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: result.error }, null, 2),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: 'Work update created successfully',
                    update: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'link_artifact': {
          const validation = validateLinkArtifactInput(args);
          if (!validation.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid input: ${validation.error.message}`
            );
          }
          const result = await workItemHandler.linkArtifact(validation.data as LinkArtifactInput);
          if (!result.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: result.error }, null, 2),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    message: 'Artifact linked successfully',
                    artifact: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'get_stale_items': {
          const validation = validateGetStaleItemsInput(args || {});
          if (!validation.success) {
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid input: ${validation.error.message}`
            );
          }
          const result = await workItemHandler.getStaleItems(
            validation.data as GetStaleItemsInput
          );
          if (!result.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: result.error }, null, 2),
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    count: result.data?.length || 0,
                    threshold: (validation.data as GetStaleItemsInput).threshold || 7,
                    items: result.data,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      console.error(`Error executing tool ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  console.error('Starting WT-ROS MCP Server...');
  console.error('Available tools:', MCP_TOOLS.map((t) => t.name).join(', '));

  await server.connect(transport);

  console.error('WT-ROS MCP Server is running');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down WT-ROS MCP Server...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Shutting down WT-ROS MCP Server...');
    await server.close();
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
