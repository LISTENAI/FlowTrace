export const coordinatedOperationTypes = [
  'update_requirement',
  'add_stage',
  'update_stage',
  'update_stage_status',
  'reschedule_stage',
  'supersede_stage',
  'add_dependency',
  'remove_dependency',
  'update_project_handoff',
] as const;

export const flowTraceCapabilities = {
  apiVersion: '0.6',
  skill: { name: 'flowtrace', version: '0.6.0' },
  features: [
    'event_context',
    'version_fix_scope',
    'changes_cursor',
    'scoped_search',
    'current_identity',
    'mutation_receipts',
    'source_references',
  ],
  coordinatedOperations: coordinatedOperationTypes,
  limits: { changes: 300, search: 50, coordinatedOperations: 100 },
  writes: {
    requestIdHeader: 'X-FlowTrace-Request-Id',
    receiptHeader: 'X-FlowTrace-Result: receipt',
    receiptLookup: '/api/operations/:requestId',
    idempotencyScope: 'authenticated_user',
    excludedPaths: ['/api/changes/preview', '/api/batch'],
  },
};
