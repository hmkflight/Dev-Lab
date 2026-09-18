import '../studio-adapter/server-only';
import {StudioError} from '../studio-adapter/errors';
import {REAL_PROJECT} from './validation.server';
export interface ProjectAuthorization {project_id:string;slug:string;enabled:boolean;historically_denied:boolean;clean_room_required:boolean;}
/** Enrollment never overrides the protected namespace deny or this pass's disposable-only fence. */
export function authorizeRealProject(slug:string,projectId:string|undefined,enrollment:ProjectAuthorization|undefined,runMode?:string){
 if(/^eagleswings(?:-|$)/i.test(slug)||/^(?:rt|r-and-t|research-trading)(?:-|$)/i.test(slug))throw new StudioError('Protected project is denied.',403);
 if(slug!==REAL_PROJECT)throw new StudioError('Production fence remains enabled.',403);
 if(!projectId||!enrollment||enrollment.project_id!==projectId||enrollment.slug!==slug||!enrollment.enabled||enrollment.historically_denied)throw new StudioError('Authoritative project is not explicitly Studio-enabled.',403);
 if(enrollment.clean_room_required&&runMode&&runMode!=='CLEAN_ROOM')throw new StudioError('Clean-room authorization required.',403);
}
