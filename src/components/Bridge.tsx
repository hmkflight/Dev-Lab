import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api';
import type {BridgeSnapshot,BridgeCommand,CommandType} from '../../lib/bridge/types';
export function FactorySignal(){
  const [state,setState]=useState<BridgeSnapshot>();const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{let active=true;const load=()=>api.bridgeStatus().then(s=>{if(active){setState(s);setUnavailable(false);}}).catch(()=>{if(active)setUnavailable(true);});void load();const t=setInterval(load,10000);return()=>{active=false;clearInterval(t);};},[]);
  const runner=state?.runner;
  return <Link className={`factory-signal ${runner?.online&&!unavailable?'online':''}`} to="/bridge" title={runner?`Last seen ${runner.lastSeen}; ${runner.mode} executor`:'No runner heartbeat received'}><i />{unavailable?'FACTORY STATUS UNAVAILABLE':runner?.online?'FACTORY ONLINE':'FACTORY OFFLINE'}</Link>;
}
export function Bridge(){
  const [state,setState]=useState<BridgeSnapshot>();const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [type,setType]=useState<CommandType>('START_RUN');const [scenario,setScenario]=useState('success');
  const last=useRef<{projectId:string;type:CommandType;mode:'MOCK';idempotencyKey:string;payload:{scenario:string}}|undefined>(undefined);
  const [submitted,setSubmitted]=useState<BridgeCommand>();const [artifact,setArtifact]=useState<{previewUrl:string;downloadUrl:string}>();
  const load=()=>api.bridgeStatus().then(s=>{setState(s);setError('');}).catch(e=>setError(e.message));
  useEffect(()=>{void load();const t=setInterval(load,2500);return()=>clearInterval(t);},[]);
  async function submit(repeat=false){setBusy(true);setError('');const data=repeat&&last.current?last.current:{projectId:'bridge-smoke-test',type,mode:'MOCK' as const,idempotencyKey:crypto.randomUUID(),payload:{scenario}};last.current=data;try{setSubmitted(await api.bridgeSubmit(data));await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <>
    <div className="page-title"><div><span className="eyebrow">PASS 3 · FENCED CONTROL</span><h1>Factory bridge<span>.</span></h1><p>Real CPE observation and controls fenced to one disposable project. Other projects remain read-only.</p></div></div>
    <section className="panel bridge-presence"><h2>{state?.runner?.online?'FACTORY ONLINE':'FACTORY OFFLINE'}</h2><p>{state?.runner?`LAST SEEN ${new Date(state.runner.lastSeen).toLocaleString()} · ${state.runner.runnerId} · ${state.runner.mode}`:'No authenticated Mac runner heartbeat received.'}</p><small>Heartbeat expires after 45 seconds. Offline commands remain queued.</small></section>
    {error&&<div className="error-banner" role="alert">{error}</div>}
    {state?.real&&<RealControls state={state} refresh={load} />}
    <section className="panel bridge-controls"><h2>Mock command console</h2><p>Project: <code>bridge-smoke-test</code>. This console cannot address Eagle Wings or execute real CPE commands.</p>
      <div className="button-row"><label>Command <select aria-label="Bridge command" value={type} onChange={e=>setType(e.target.value as CommandType)}>{['START_RUN','CREATE_PROJECT','RESUME_RUN','APPROVE_GATE'].map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Test scenario <select aria-label="Test scenario" value={scenario} onChange={e=>setScenario(e.target.value)}><option value="success">Success</option><option value="fail-once">Fail once, then retry</option><option value="always-fail">Exhaust retries</option></select></label>
      <button className="button primary" disabled={busy||!state?.canSubmit} onClick={()=>void submit()}>Submit mock command</button>
      <button className="button secondary" disabled={busy||!last.current||!state?.canSubmit} onClick={()=>void submit(true)}>Repeat same request</button></div>
      {submitted&&<p role="status">Command ID: <code data-testid="submitted-command-id">{submitted.id}</code></p>}
      {!state?.canSubmit&&<p>Owner authentication is required to submit mock commands.</p>}
    </section>
    <section className="panel"><h2>Command history</h2><div className="bridge-jobs">{state?.commands.map(c=><article key={c.id} data-command-id={c.id}><div className="row"><strong>{c.command_type}</strong><span className="status">{c.status}</span></div><code>{c.id}</code><p>{c.project_id} · {c.mode} · attempt {c.attempt_count} · runner {c.claimed_by||'unclaimed'}</p>{c.execution_id&&<p>Execution <code>{c.execution_id}</code> · Last progress {c.progress_at?new Date(c.progress_at).toLocaleString():'not received'}{c.status==='RUNNING'&&(!c.progress_at||Date.now()-Date.parse(c.progress_at)>45000)?' · Progress stale; automatic replay blocked':''}</p>}{c.reconciliation&&<p>Reconciliation: <strong>{c.reconciliation}</strong> · {c.reconciled_at}</p>}{c.result&&<pre>{JSON.stringify(JSON.parse(c.result),null,2)}</pre>}<details><summary>Transport timeline</summary><pre>{JSON.stringify(JSON.parse(c.history),null,2)}</pre></details></article>)}{state?.commands.length===0&&<p>No commands have been submitted.</p>}</div></section>
    {state?.artifacts?.map(a=><section className="panel" key={a.id}><h2>Disposable CPE artifact</h2><p>{a.representation==='original'?'Original CPE output':'Rendered preview of authoritative CPE output'}</p>{a.thumbnailUrl&&<img style={{maxWidth:'100%'}} src={a.thumbnailUrl} alt="Rendered CPE report preview"/>}<p>Source <code>{a.sourceArtifactId}</code> · {a.mimeType} · {a.bytes} bytes</p><p>SHA-256 <code>{a.sha256}</code></p><a target="_blank" rel="noreferrer" href={a.previewUrl}>Preview real artifact</a>{' · '}<a href={a.downloadUrl}>Download real artifact</a></section>)}
    <section className="panel"><h2>Private artifact transport</h2><p>Publish a fixed synthetic image to verify authenticated R2 delivery. Disposable CPE artifacts and their report previews are delivered separately.</p><button className="button secondary" disabled={!state?.canSubmit} onClick={()=>void api.bridgeArtifact().then(setArtifact).catch(e=>setError(e.message))}>Publish synthetic artifact</button>{artifact&&<div className="bridge-artifact"><img src={artifact.previewUrl} alt="Synthetic bridge proof"/><a href={artifact.downloadUrl}>Download synthetic artifact</a></div>}</section>
  </>;
}

function RealControls({state,refresh}:{state:BridgeSnapshot;refresh:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const last=useRef<unknown>(undefined);const [submitted,setSubmitted]=useState<BridgeCommand>();const real=state.real!;
 async function send(type?:CommandType){setBusy(true);setError('');try{
  const payload=type==='APPROVE_GATE'?{runId:real.runId,expectedStage:real.stage,approvalType:real.gate,gate:real.gate}:type==='RESUME_RUN'?{runId:real.runId,expectedStage:real.stage}:{};
  const request=type?{projectId:real.projectSlug,mode:'REAL',type,idempotencyKey:crypto.randomUUID(),payload}:last.current;if(!request)throw Error('No request to repeat.');last.current=request;
  setSubmitted(await api.bridgeSubmit(request));await refresh();
 }catch(e){setError((e as Error).message);await refresh();}finally{setBusy(false);}}
 const online=!!state.runner?.online&&Date.now()-Date.parse(state.runner.lastSeen)<45000;
 const active=state.commands.some(c=>c.mode==='REAL'&&['QUEUED','CLAIMED','RUNNING'].includes(c.status));
 const enabled=(type:string)=>state.canSubmit&&online&&!busy&&!active&&real.allowed.includes(type)&&real.proven.includes(type);
 return <section className="panel bridge-controls"><span className="eyebrow">REAL · DISPOSABLE ACCEPTANCE ONLY</span><h2>Disposable factory control</h2><p>Only <code>{real.projectSlug}</code> is authorized. Every other project is blocked by the Worker and Mac runner.</p>
 <p>Project stage: <strong>{real.stage||'Not created'}</strong> · Run: <strong>{real.runStatus||'None'}</strong></p>{real.runId&&<p>Run ID <code>{real.runId}</code></p>}
 <p>Approval gate: {real.gate||'None'} · Proven commands: {real.proven.join(', ')||'None yet — acceptance testing'}</p>
 {real.projectId&&<p><Link to={'/projects/'+real.projectId}>Observe disposable project</Link></p>}
 <div className="button-row">
 <button className="button secondary" disabled={!enabled('CREATE_PROJECT')||!!real.projectId} onClick={()=>void send('CREATE_PROJECT')}>Create disposable project</button>
 <button className="button primary" disabled={!enabled('START_RUN')||!real.projectId||!!real.runId} onClick={()=>void send('START_RUN')}>START FACTORY</button>
 <button className="button primary" disabled={!enabled('APPROVE_GATE')||!['AWAITING_DIRECTION_APPROVAL','AWAITING_BUILD_APPROVAL','AWAITING_FINAL_APPROVAL'].includes(real.gate||'')||real.stage!==real.gate} onClick={()=>void send('APPROVE_GATE')}>{real.gate==='AWAITING_BUILD_APPROVAL'?'Approve Build':real.gate==='AWAITING_FINAL_APPROVAL'?'Final Approve':'Approve Direction'}</button>
 <button className="button primary" disabled={!enabled('RESUME_RUN')||!['EXPERIENCE_DESIGN','IMPLEMENTATION','COMPLETE'].includes(real.stage||'')||real.runStatus!=='AWAITING_HUMAN_APPROVAL'} onClick={()=>void send('RESUME_RUN')}>Resume disposable run</button>
 <button className="button secondary" disabled={busy||!last.current||!state.canSubmit||!online} onClick={()=>void send()}>Repeat real request</button></div>
 <p>Controls require a proven capability, current CPE state, and an online runner. Pause and cancellation are disabled.</p>
 {submitted&&<p role="status">Real command ID: <code data-testid="real-command-id">{submitted.id}</code></p>}{error&&<div role="alert">{error}</div>}
 </section>;
}
