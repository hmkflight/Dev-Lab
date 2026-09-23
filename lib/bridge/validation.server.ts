import '../studio-adapter/server-only';
import {z} from 'zod';
import {StudioError} from '../studio-adapter/errors';
export const SYNTHETIC_PROJECT='bridge-smoke-test';
export const REAL_PROJECT='bridge-disposable-pass2';
export const realTypes=['CREATE_PROJECT','START_RUN','RESUME_RUN','APPROVE_GATE'] as const;
export const projectSlug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).refine(s=>! /^(?:eagleswings|rt|r-and-t|research-trading)(?:-|$)/i.test(s),'Protected project');
const base={idempotencyKey:z.uuid()};
const empty=z.object({}).strict();
const fence={runId:z.uuid(),expectedStage:z.string().regex(/^[A-Z_]+$/).max(80)};
export const commandInput=z.union([
 z.object({...base,projectId:z.literal(SYNTHETIC_PROJECT),mode:z.literal('MOCK'),type:z.enum(realTypes),payload:z.object({scenario:z.enum(['success','fail-once','always-fail']).default('success')}).strict().default({scenario:'success'})}).strict(),
 z.object({...base,projectId:projectSlug,mode:z.literal('REAL'),type:z.enum(['CREATE_PROJECT','START_RUN']),payload:empty.default({})}).strict(),
 z.object({...base,projectId:projectSlug,mode:z.literal('REAL'),type:z.literal('RESUME_RUN'),payload:z.object(fence).strict()}).strict(),
 z.object({...base,projectId:projectSlug,mode:z.literal('REAL'),type:z.literal('APPROVE_GATE'),payload:z.object({...fence,approvalType:z.enum(['AWAITING_DIRECTION_APPROVAL','AWAITING_BUILD_APPROVAL','AWAITING_FINAL_APPROVAL']),gate:z.enum(['AWAITING_DIRECTION_APPROVAL','AWAITING_BUILD_APPROVAL','AWAITING_FINAL_APPROVAL'])}).strict()}).strict(),
]);
export type CommandInput=z.infer<typeof commandInput>;
export function authorizedProject(project:string,mode='MOCK',allowedProject=REAL_PROJECT){if(!projectSlug.safeParse(project).success||project!==(mode==='REAL'?allowedProject:SYNTHETIC_PROJECT))throw new StudioError('Project is not authorized for bridge commands.',403);}
export function semanticKey(d:CommandInput){if(d.mode==='MOCK')return null;const p=d.payload as {runId?:string;expectedStage?:string};return [d.projectId,d.type,p.runId||'',p.expectedStage||''].join(':');}
export const outcomeSchema=z.object({ok:z.boolean(),retryable:z.boolean(),code:z.enum(['MOCK_COMPLETED','MOCK_TRANSIENT_FAILURE','MOCK_PERMANENT_FAILURE','EXECUTION_UNCERTAIN','REAL_COMPLETED','REAL_FAILED','FENCE_REJECTED']),executionCount:z.number().int().min(0).max(1),executionId:z.uuid().optional(),processId:z.number().int().positive().optional(),stdout:z.string().max(4000).optional(),stderr:z.string().max(4000).optional(),projectId:z.uuid().optional(),runId:z.uuid().optional()}).strict().refine(b=>b.ok?(['MOCK_COMPLETED','REAL_COMPLETED'].includes(b.code)&&b.executionCount===1&&!b.retryable):!['MOCK_COMPLETED','REAL_COMPLETED'].includes(b.code),'Invalid executor result');
export type ExecutorResult=z.infer<typeof outcomeSchema>;
