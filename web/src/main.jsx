import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MapContainer, TileLayer, CircleMarker, GeoJSON, useMap} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import fixture from './fixture.json';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function utcNow(){ return Date.now(); }
function fmtUtc(iso){ if(!iso) return 'Unavailable'; return new Date(iso).toISOString().replace('T',' ').replace('.000Z','Z'); }
function fmtIst(iso){ if(!iso) return 'Unavailable'; return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+' IST'; }
function countdown(arrival, clock){
  if(!arrival) return null;
  const d = new Date(arrival).getTime() - clock;
  if(!Number.isFinite(d) || d < 0) return null;
  const total = Math.floor(d/1000), h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function MapResize(){ const map=useMap(); useEffect(()=>{setTimeout(()=>map.invalidateSize(),50)},[map]); return null; }

function App(){
  const [bundle,setBundle]=useState(fixture);
  const [mode,setMode]=useState('fixture');
  const [lead,setLead]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [replayClock,setReplayClock]=useState(new Date(fixture.replay?.clock_utc || fixture.issue_time_utc).getTime());
  const [apiState,setApiState]=useState(API_BASE ? 'loading' : 'offline');
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!API_BASE) return;
    const ctrl=new AbortController();
    fetch(`${API_BASE.replace(/\/$/,'')}/forecast`,{signal:ctrl.signal})
      .then(r=>{if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json()})
      .then(data=>{setBundle(data);setMode('api');setApiState('online');setError('')})
      .catch(e=>{if(e.name!=='AbortError'){setApiState('offline');setError('API unavailable — showing local fixture replay.')}});
    return ()=>ctrl.abort();
  },[]);

  useEffect(()=>{
    if(!playing) return;
    const id=setInterval(()=>setLead(v=>{
      const next=v+1;
      if(next>=bundle.leads.length){setPlaying(false);return v;}
      return next;
    }),1000);
    return ()=>clearInterval(id);
  },[playing,bundle.leads.length]);

  const selected=bundle.leads[lead] || bundle.leads[0];
  const hazards=selected?.hazards || {};
  const clock=mode==='fixture' ? replayClock : utcNow();
  const arrival=countdown(selected?.arrival_estimate_utc,clock);
  const stale=selected?.input?.stale === true;
  const validBounds=Array.isArray(selected?.bounds?.bbox) && selected.bounds.bbox.length===4;
  const center=validBounds ? [(selected.bounds.bbox[1]+selected.bounds.bbox[3])/2,(selected.bounds.bbox[0]+selected.bounds.bbox[2])/2] : [20,78];
  const unsupported=['hail','lightning','downburst','cloudburst'];
  const mapGeo=selected?.hazard_geojson || null;
  const leadOptions=bundle.leads.map((x,i)=>({i,label:x.lead_minutes===0?'Observed':`+${x.lead_minutes} min`,supported:x.supported!==false,reason:x.unsupported_reason}));

  return <div className="app">
    <header className="topbar">
      <div><div className="eyebrow">MoES / NCMRWF · SIH26084</div><h1>Convective Nowcast Dashboard</h1></div>
      <div className="mode-badge"><span className="dot"/> {mode==='api'?'MODEL/API MODE':'SYNTHETIC DEMO'}</div>
    </header>
    <main>
      <section className="status-row">
        <div className="status-card"><b>Mode</b><span>{mode==='api'?'API / integrated':'Synthetic fixture / replay'}</span></div>
        <div className="status-card"><b>Event time</b><span>{fmtUtc(bundle.event_time_utc)}</span></div>
        <div className="status-card"><b>Issue time</b><span>{fmtUtc(bundle.issue_time_utc)}</span></div>
        <div className="status-card"><b>Replay clock</b><span>{fmtUtc(new Date(clock).toISOString())}</span></div>
      </section>
      {error && <div className="banner warning">{error}</div>}
      {stale && <div className="banner danger">Stale input: this frame is retained for replay/demo only. Hazard countdowns are not presented as live.</div>}

      <section className="grid">
        <div className="card map-card">
          <div className="card-head"><div><h2>Observed / forecast scene</h2><p>{bundle.region?.name || 'Unknown region'} · {bundle.grid?.native_km ? `${bundle.grid.native_km} km native` : 'native spacing unknown'}{bundle.grid?.effective_km ? ` · ${bundle.grid.effective_km} km effective` : ''}</p></div><span className="pill">{leadOptions[lead]?.label}</span></div>
          {validBounds ? <MapContainer center={center} zoom={6} scrollWheelZoom className="map"><MapResize/><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{mapGeo && <GeoJSON data={mapGeo}/>} {(selected.points||[]).map((p,i)=><CircleMarker key={i} center={[p.lat,p.lon]} radius={6}></CircleMarker>)}</MapContainer> : <div className="neutral-map"><div><strong>Neutral coordinate frame</strong><p>Geography is unavailable or unverified. The dashboard will not invent an Indian overlay.</p><div className="fake-grid">{Array.from({length:36}).map((_,i)=><i key={i}/>)}</div></div></div>}
          <div className="map-caption">Map overlay is shown only when valid coordinates/bounds exist. Synthetic geography remains illustrative.</div>
        </div>

        <aside className="card hazard-card"><div className="card-head"><div><h2>Hazard status</h2><p>Only supplied/calibrated outputs are shown as probabilities.</p></div></div>
          {unsupported.map(k=><Hazard key={k} name={k} data={hazards[k]}/>) }
          <div className="proxy"><div><b>VIL proxy</b><span>Not rainfall (mm/h)</span></div><strong>{selected.vil_proxy?.value ?? '—'}</strong><small>{selected.vil_proxy?.method || 'Meaning unavailable'}</small></div>
          <div className="quality"><b>Input quality</b><span>{selected.input?.quality || 'Not supplied'}</span><small>{selected.input?.quality_method || 'No calibrated confidence method supplied.'}</small></div>
        </aside>
      </section>


      <section className="card controls">
        <div className="control-line"><div><h2>Supported lead</h2><p>Unsupported horizons stay disabled with a reason.</p></div><div className="lead-buttons">{leadOptions.map(o=><button key={o.i} disabled={!o.supported} className={o.i===lead?'active':''} onClick={()=>setLead(o.i)}>{o.label}{!o.supported && <small>disabled</small>}</button>)}</div></div>
        <div className="slider-row"><button className="play" onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><input type="range" min="0" max={Math.max(bundle.leads.length-1,0)} value={lead} onChange={e=>{setLead(Number(e.target.value));setPlaying(false)}}/><span>{selected?.valid_time_utc ? fmtUtc(selected.valid_time_utc) : 'Unavailable'}</span></div>
        {mode==='fixture' && <div className="replay-row"><label>Replay clock</label><input type="range" min={new Date(bundle.replay.start_utc).getTime()} max={new Date(bundle.replay.end_utc).getTime()} value={replayClock} onChange={e=>setReplayClock(Number(e.target.value))}/><span>{fmtUtc(new Date(replayClock).toISOString())}</span></div>}
      </section>

      <section className="bottom-grid">
        <div className="card"><h2>Arrival countdown</h2><div className="countdown">{arrival || 'Unavailable'}</div><p>{selected?.arrival_estimate_utc ? `Estimate: ${fmtUtc(selected.arrival_estimate_utc)} · ${fmtIst(selected.arrival_estimate_utc)}` : 'No valid estimated arrival supplied.'}</p></div>
        <div className="card"><h2>Data provenance</h2><ul className="meta"><li><b>Dataset:</b> {bundle.provenance?.dataset || 'Not supplied'}</li><li><b>Region:</b> {bundle.region?.name || 'Unknown'}</li><li><b>Source status:</b> {apiState==='online'?'API online':'Local fixture'}</li><li><b>Claims:</b> {bundle.provenance?.claims || 'Illustrative demo only'}</li></ul></div>
      </section>
    </main>
    <footer>Dashboard owned by Anamika · feature/anamika-dashboard · No live hazard claims are made by this fixture.</footer>
  </div>
}

function Hazard({name,data}){ const available=data?.status==='available' && data?.probability!=null; return <div className="hazard"><div><b>{name[0].toUpperCase()+name.slice(1)}</b><span>{data?.status || 'unavailable'}</span></div><strong>{available ? `${Math.round(data.probability*100)}%` : 'Not available'}</strong></div> }

createRoot(document.getElementById('root')).render(<App/>);
