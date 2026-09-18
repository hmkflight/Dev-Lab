import '../studio-adapter/server-only';
import {StudioError} from '../studio-adapter/errors';
export const artifactMimes=['application/json','text/html','image/png','image/jpeg'] as const;
export function validateArtifactBytes(bytes:Uint8Array,mime:string){
 if(!bytes.length||bytes.length>500000)throw new StudioError('Artifact size is outside the transport limit.',400);
 const ascii=new TextDecoder('latin1').decode(bytes);
 if(/\/(?:Users|home|private|tmp|var)\/|file:\/\/|Bearer\s|(?:api[_-]?key|service_role|access_token|shellCommand)\s*["':=]/i.test(ascii))throw new StudioError('Artifact contains private transport information.',400);
 if(/(?:sk-[\w-]{10,}|sb_secret_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)|outputs\/dev-lab\/|AI_COMMAND_CENTER|\.\/command\.sh/.test(ascii))throw new StudioError('Artifact contains private transport information.',400);
 if(mime==='image/png'){if(![137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))throw new StudioError('PNG MIME mismatch.',400);return;}
 if(mime==='image/jpeg'){if(bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)throw new StudioError('JPEG MIME mismatch.',400);return;}
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new StudioError('Invalid UTF-8 artifact.',400);}
 if(mime==='application/json'){try{JSON.parse(text);}catch{throw new StudioError('Invalid JSON artifact.',400);}return;}
 if(mime==='text/html'){
  if(!/^\s*<!doctype html>/i.test(text)||/<(?:script|iframe|object|embed|form|base|link|meta\s+http-equiv)\b|\bon\w+\s*=|(?:src|href)\s*=\s*["']?(?:https?:|\/\/|file:|javascript:)/i.test(text))throw new StudioError('HTML must be a passive, self-contained preview.',400);return;
 }
 throw new StudioError('Unsupported artifact MIME.',400);
}
