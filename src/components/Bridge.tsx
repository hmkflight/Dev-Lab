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
  const load=()=>api.bridgeStatus().then(setState).catch(e=>setError(e.message));
  useEffect(()=>{void load();const t=setInterval(load,2500);return()=>clearInterval(t);},[]);
  async function submit(repeat=false){setBusy(true);setError('');const data=repeat&&last.current?last.current:{projectId:'bridge-smoke-test',type,mode:'MOCK' as const,idempotencyKey:crypto.randomUUID(),payload:{scenario}};last.current=data;try{setSubmitted(await api.bridgeSubmit(data));await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <>
    <div className="page-title"><div><span className="eyebrow">PASS 1 · SHADOW EXECUTION</span><h1>Factory bridge<span>.</span></h1><p>Real CPE observation. Synthetic command testing. Production controls remain disabled.</p></div></div>
    <section className="panel bridge-presence"><h2>{state?.runner?.online?'FACTORY ONLINE':'FACTORY OFFLINE'}</h2><p>{state?.runner?`LAST SEEN ${new Date(state.runner.lastSeen).toLocaleString()} · ${state.runner.runnerId} · ${state.runner.mode}`:'No authenticated Mac runner heartbeat received.'}</p><small>Heartbeat expires after 45 seconds. Offline commands remain queued.</small></section>
    {error&&<div className="error-banner" role="alert">{error}</div>}
    <section className="panel bridge-controls"><h2>Mock command console</h2><p>Project: <code>bridge-smoke-test</code>. This console cannot address Eagle Wings or execute real CPE commands.</p>
      <div className="button-row"><label>Command <select aria-label="Bridge command" value={type} onChange={e=>setType(e.target.value as CommandType)}>{['START_RUN','CREATE_PROJECT','RESUME_RUN','APPROVE_GATE'].map(t=><option key={t}>{t}</option>)}</select></label>
      <label>Test scenario <select aria-label="Test scenario" value={scenario} onChange={e=>setScenario(e.target.value)}><option value="success">Success</option><option value="fail-once">Fail once, then retry</option><option value="always-fail">Exhaust retries</option></select></label>
      <button className="button primary" disabled={busy||!state?.canSubmit} onClick={()=>void submit()}>Submit mock command</button>
      <button className="button secondary" disabled={busy||!last.current||!state?.canSubmit} onClick={()=>void submit(true)}>Repeat same request</button></div>
      {submitted&&<p role="status">Command ID: <code data-testid="submitted-command-id">{submitted.id}</code></p>}
      {!state?.canSubmit&&<p>Owner authentication is required to submit mock commands.</p>}
    </section>
    <section className="panel"><h2>Command history</h2><div className="bridge-jobs">{state?.commands.map(c=><article key={c.id} data-command-id={c.id}><div className="row"><strong>{c.command_type}</strong><span className="status">{c.status}</span></div><code>{c.id}</code><p>{c.project_id} · {c.mode} · attempt {c.attempt_count} · runner {c.claimed_by||'unclaimed'}</p>{c.result&&<pre>{JSON.stringify(JSON.parse(c.result),null,2)}</pre>}<details><summary>Transport timeline</summary><pre>{JSON.stringify(JSON.parse(c.history),null,2)}</pre></details></article>)}{state?.commands.length===0&&<p>No commands have been submitted.</p>}</div></section>
    <section className="panel"><h2>Private artifact transport</h2><p>Publish a fixed synthetic image to verify authenticated R2 delivery. No CPE files are uploaded.</p><button className="button secondary" disabled={!state?.canSubmit} onClick={()=>void api.bridgeArtifact().then(setArtifact).catch(e=>setError(e.message))}>Publish synthetic artifact</button>{artifact&&<div className="bridge-artifact"><img src={artifact.previewUrl} alt="Synthetic bridge proof"/><a href={artifact.downloadUrl}>Download synthetic artifact</a></div>}</section>
  </>;
}
