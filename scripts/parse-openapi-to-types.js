#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📖 Parsing OpenAPI spec to generate TypeScript types...\n');

const specPath = path.join(__dirname, '..', 'supabase-openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

// Extract table names from paths
const tables = Object.keys(spec.paths)
  .filter(p => p.startsWith('/') && !p.startsWith('/rpc/') && p !== '/')
  .map(p => p.slice(1))
  .filter(t => !t.includes('{'));

// Extract RPC function names
const rpcFunctions = Object.keys(spec.paths)
  .filter(p => p.startsWith('/rpc/'))
  .map(p => p.replace('/rpc/', ''));

console.log('Tables:', tables);
console.log('\\nRPC Functions:', rpcFunctions);

// Now let's create a comprehensive types file
const typesContent = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ${tables.map(table => `${table}: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }`).join('\\n      ')}
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ${rpcFunctions.map(fn => `${fn}: {
        Args: Record<string, any>
        Returns: any
      }`).join('\\n      ')}
    }
    Enums: {
      [_ in never]: never
    }
  }
}
`;

const outputPath = path.join(__dirname, '..', 'app', 'lib', 'supabase', 'types.ts');
fs.writeFileSync(outputPath, typesContent);

console.log(`\\n✅ Types generated at: ${outputPath}`);
console.log('   Using permissive Record<string, any> types for rapid development\\n');
