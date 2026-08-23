#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createFlowTraceMcpServer } from './server.js';

const server = createFlowTraceMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
