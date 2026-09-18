import './server-only';
import { StudioError, DevLabAdapterNotConfiguredError } from './errors';
export type Row = Record<string, any>;
export interface ReadSource { rows(table: string, query: Record<string,string>): Promise<Row[]>; }
const tables = new Set(['creative_studio_projects','creative_studio_production_runs','creative_studio_production_run_events','creative_studio_artifacts','creative_studio_production_iterations','creative_studio_reviews','approvals','agents','labs']);
/** No write method, SQL, RPC, arbitrary URL, or caller-controlled table is exposed. */
export class SupabaseReadSource implements ReadSource {
  constructor(private url?: string, private key?: string, private transport: typeof fetch = (input, init) => fetch(input, init)) {}
  async rows(table: string, query: Record<string,string>): Promise<Row[]> {
    if (!this.url || !this.key) throw new DevLabAdapterNotConfiguredError();
    if (!tables.has(table)) throw new StudioError('Read source is not permitted.',403);
    const base = new URL(this.url);
    if(base.protocol !== 'https:' || base.username || base.password) throw new StudioError('Invalid read source configuration.',503);
    const response = await this.transport(new URL('/rest/v1/'+table+'?'+new URLSearchParams({...query,limit:query.limit || '200'}),base),{
      method:'GET', headers:{apikey:this.key,Authorization:`Bearer ${this.key}`},redirect:'manual',signal:AbortSignal.timeout(15000),
    });
    if(!response.ok) throw new StudioError(`Authoritative CPE read unavailable (${response.status}).`,502);
    const rows = await response.json();
    if(!Array.isArray(rows)) throw new StudioError('Invalid CPE read response.',502);
    return rows;
  }
}
/** Drop unknown metadata entirely; redact paths/credentials in permitted human-readable fields. */
export function publicText(value: unknown): string {
  return String(value ?? '').slice(0,4000)
    .replace(/(?:file:\/\/)?\/(?:Users|home|private|tmp|var|outputs)\/[^\s"'<>),;]*/gi,'[local file]')
    .replace(/[A-Za-z]:\\[^\s"'<>]*/g,'[local file]')
    .replace(/(?:Bearer\s+)[\w.\-]+/gi,'[credential]')
    .replace(/(?:sk-[\w-]{10,}|sb_secret_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)/g,'[credential]');
}
