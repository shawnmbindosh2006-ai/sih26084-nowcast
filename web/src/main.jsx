import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MapContainer, TileLayer, GeoJSON, ImageOverlay, useMap} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import fixture from './fixture.json';
import {HAZARD_NAMES, artifactUrl, fetchForecastBundle, frameLabel, mapBounds, probabilityLabel, supportedFrames} from './contract.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function fmtUtc(iso){ if(!iso) return 'Unavailable'; return new Date(iso).toISOString().replace('T',' ').replace('.000Z','Z'); }
function fmtIst(iso){ if(!iso) return 'Unavailable'; return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+' IST'; }
function countdown(arrival, clock){
  if(!arrival) return null;
  const d = new Date(arrival).getTime() - clock;
  if(!Number.isFinite(d) || d < 0) return null;
  const total = Math.floor(d/1000), h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function MapResize(){ const map=useMap(); useEffect(()=>{const id=setTimeout(()=>map.invalidateSize(),50);return ()=>clearTimeout(id)},[map]); return null; }

export function App({initialBundle=fixture, apiBase=API_BASE}){
  const [bundle,setBundle]=useState(initialBundle);
  const [source,setSource]=useState('fixture');
  const [lead,setLead]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [now,setNow]=useState(Date.now());
  const [apiState,setApiState]=useState(apiBase ? 'loading' : 'offline');
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!apiBase) return;
    const ctrl=new AbortController();
    async function loadNowcast(){
      try {
        const data=await fetchForecastBundle(apiBase,ctrl.signal);
        if(ctrl.signal.aborted) return;
        setBundle(data);setLead(0);setPlaying(false);setSource('api');setApiState('online');setError('');
      } catch(e) {
        if(!ctrl.signal.aborted){setApiState('offline');setError(`API unavailable (${e.message}) — showing local synthetic fixture.`);}
      }
    }
    loadNowcast();
    return ()=>ctrl.abort();
  },[apiBase]);

  const frames=useMemo(()=>supportedFrames(bundle),[bundle]);
  useEffect(()=>{
    if(!playing) return;
    const id=setInterval(()=>setLead(value=>{
      if(value+1>=frames.length){setPlaying(false);return value;}
      return value+1;
    }),1000);
    return ()=>clearInterval(id);
  },[playing,frames.length]);
  useEffect(()=>{
    if(bundle.mode!=='live') return;
    const id=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(id);
  },[bundle.mode]);

  const selected=frames[lead] || frames[0];
  const hazards=bundle.hazards || {};
  const bounds=mapBounds(bundle.grid);
  const frameUrl=artifactUrl(selected?.image_url,source==='api'?apiBase:'');
  const zones={type:'FeatureCollection',features:HAZARD_NAMES.flatMap(name=>hazards[name]?.zones?.features || [])};
  const clock=bundle.mode==='live' ? now : new Date(bundle.issued_at_utc).getTime();
  const arrivalEstimate=HAZARD_NAMES.map(name=>hazards[name]).find(hazard=>hazard?.status!=='unavailable' && hazard?.estimated_arrival_utc)?.estimated_arrival_utc;
  const arrival=countdown(arrivalEstimate,clock);
  const badge=`${bundle.mode?.toUpperCase() || 'UNKNOWN'} · ${bundle.forecast_method?.toUpperCase() || 'UNKNOWN'} · ${source==='api'?'API':'LOCAL DEMO'}`;
  const provenance=bundle.sources?.map(item=>item.provenance || item.id).filter(Boolean).join('; ') || 'Not supplied';

  return <div className="app">
    <header className="topbar">
      <div><div className="eyebrow">MoES / NCMRWF · SIH26084</div><h1>Convective Nowcast Dashboard</h1></div>
      <div className="mode-badge"><span className="dot"/> {badge}</div>
    </header>
    <main>
      <section className="status-row">
        <div className="status-card"><b>Mode / method</b><span>{bundle.mode} / {bundle.forecast_method}</span></div>
        <div className="status-card"><b>Event time</b><span>{fmtUtc(bundle.event_time_utc)}</span></div>
        <div className="status-card"><b>Issue time</b><span>{fmtUtc(bundle.issued_at_utc)}</span></div>
        <div className="status-card"><b>{bundle.mode==='live'?'Live clock':'Issue-time clock'}</b><span>{fmtUtc(new Date(clock).toISOString())}</span></div>
      </section>
      {error && <div className="banner warning">{error}</div>}
      {bundle.warnings?.map((warning,index)=><div className="banner warning" key={index}>{warning}</div>)}

      <section className="grid">
        <div className="card map-card">
          <div className="card-head"><div><h2>Forecast frame / illustrative scene</h2><p>{bounds?'Georeferenced bounds available':'Geography unknown'} · {bundle.grid?.native_spacing_km != null ? `${bundle.grid.native_spacing_km} km native` : 'native spacing unknown'}{bundle.grid?.effective_spacing_km != null ? ` · ${bundle.grid.effective_spacing_km} km effective` : ''}</p></div><span className="pill">{selected ? frameLabel(bundle,selected) : 'No frame'}</span></div>
          {bounds ? <MapContainer bounds={bounds} scrollWheelZoom className="map"><MapResize/><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{frameUrl && <ImageOverlay url={frameUrl} bounds={bounds}/>}{zones.features.length>0 && <GeoJSON data={zones}/>}</MapContainer>
            : <div className="neutral-map">{frameUrl ? <img src={frameUrl} alt={`${selected?.variable || 'Illustrative'} frame without verified geography`} style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/> : <div><strong>Image unavailable</strong><p>Geography is unknown. No map placement or weather image is inferred.</p><div className="fake-grid">{Array.from({length:36}).map((_,index)=><i key={index}/>)}</div></div>}</div>}
          <div className="map-caption">{selected?.variable || 'Variable unavailable'} · {selected?.units || 'units unavailable'}. Map placement requires valid grid.bounds_wgs84.</div>
        </div>

        <aside className="card hazard-card"><div className="card-head"><div><h2>Hazard status</h2><p>Probabilities appear only for validated, calibrated outputs.</p></div></div>
          {HAZARD_NAMES.filter(name=>name!=='storm_intensity_proxy').map(name=><Hazard key={name} name={name} data={hazards[name]}/>) }
          <div className="proxy"><div><b>VIL / storm-intensity proxy</b><span>Not rainfall (mm/h)</span></div><strong>{hazards.storm_intensity_proxy?.status || 'unavailable'}</strong><small>{hazards.storm_intensity_proxy?.method || hazards.storm_intensity_proxy?.reason || 'Meaning unavailable'}</small></div>
        </aside>
      </section>

      <section className="card controls">
        <div className="control-line"><div><h2>Supported lead</h2><p>Only frames listed in supported_lead_times_minutes can be selected or played.</p></div><div className="lead-buttons">{frames.map((frame,index)=><button key={frame.lead_minutes} className={index===lead?'active':''} onClick={()=>setLead(index)}>{frameLabel(bundle,frame)}</button>)}</div></div>
        <div className="slider-row"><button className="play" disabled={frames.length<2} onClick={()=>setPlaying(value=>!value)}>{playing?'Pause':'Play'}</button><input type="range" min="0" max={Math.max(frames.length-1,0)} value={lead} onChange={event=>{setLead(Number(event.target.value));setPlaying(false)}}/><span>{selected?.valid_time_utc ? fmtUtc(selected.valid_time_utc) : 'Unavailable'}</span></div>
      </section>

      <section className="bottom-grid">
        <div className="card"><h2>Arrival countdown</h2><div className="countdown">{arrival || 'Unavailable'}</div><p>{arrivalEstimate ? `Estimate: ${fmtUtc(arrivalEstimate)} · ${fmtIst(arrivalEstimate)}` : 'No valid estimated arrival supplied.'}</p></div>
        <div className="card"><h2>Data provenance</h2><ul className="meta"><li><b>Sources:</b> {provenance}</li><li><b>Event:</b> {bundle.event_id || 'Not supplied'}</li><li><b>Source status:</b> {apiState==='online'?'API online':'Local fixture'}</li><li><b>Run:</b> {bundle.run_id || 'Not supplied'}</li></ul></div>
      </section>
    </main>
    <footer>Dashboard owned by Anamika · contract compatibility fix · Synthetic fixtures are not live forecasts.</footer>
  </div>;
}

function Hazard({name,data}){ return <div className="hazard"><div><b>{name[0].toUpperCase()+name.slice(1)}</b><span>{data?.status || 'unavailable'}</span></div><strong>{probabilityLabel(data)}</strong></div> }

if(typeof document!=='undefined' && document.getElementById('root')) createRoot(document.getElementById('root')).render(<App/>);
