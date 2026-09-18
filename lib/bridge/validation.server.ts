import '../studio-adapter/server-only';
import { z } from 'zod';
import { StudioError } from '../studio-adapter/errors';
export const SYNTHETIC_PROJECT='bridge-smoke-test';
export const commandInput=z.object({
  projectId:z.literal(SYNTHETIC_PROJECT),mode:z.literal('MOCK'),
  type:z.enum(['CREATE_PROJECT','START_RUN','RESUME_RUN','APPROVE_GATE']),
  idempotencyKey:z.string().uuid(),
  payload:z.object({scenario:z.enum(['success','fail-once','always-fail']).default('success')}).strict().default({scenario:'success'}),
}).strict();
export function authorizedProject(project:string){if(project!==SYNTHETIC_PROJECT)throw new StudioError('Project is not authorized for bridge commands.',403);}
