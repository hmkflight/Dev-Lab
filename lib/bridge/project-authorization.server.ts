import '../studio-adapter/server-only';
import {StudioError} from '../studio-adapter/errors';
import {projectSlug} from './validation.server';
export interface ProjectAuthorization {project_id:string;slug:string;enabled:boolean;historically_denied:boolean;clean_room_required:boolean;}
/** Explicit enrollment never overrides the protected namespace deny. */
export function authorizeRealProject(slug:string,projectId:string|undefined,enrollment:ProjectAuthorization|undefined,runMode?:string){
 if(/^eagleswings(?:-|$)/i.test(slug)||/^(?:rt|r-and-t|research-trading)(?:-|$)/i.test(slug))throw new StudioError('Protected project is denied.',403);
 if(!projectSlug.safeParse(slug).success)throw new StudioError('Invalid project scope.',403);
 if(!projectId||!enrollment||enrollment.project_id!==projectId||enrollment.slug!==slug||!enrollment.enabled||enrollment.historically_denied)throw new StudioError('Authoritative project is not explicitly Studio-enabled.',403);
 if(enrollment.clean_room_required&&runMode&&runMode!=='CLEAN_ROOM')throw new StudioError('Clean-room authorization required.',403);
}
