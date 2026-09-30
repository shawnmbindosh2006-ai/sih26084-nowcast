import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';
import {
  artifactUrl,
  chooseDefaultMethod,
  discoverForecastOptions,
  fetchForecastBundle,
  frameLabel,
  mapBounds,
  probabilityLabel,
  requestNowcast,
  supportedFrames,
} from '../src/contract.js';

const apiBundle=JSON.parse(readFileSync(new URL('./api-bundle.json',import.meta.url),'utf8'));
const localFixture=JSON.parse(readFileSync(new URL('../src/fixture.json',import.meta.url),'utf8'));

test('ForecastBundle v1 keeps only supported frames and never invents geography',()=>{
  assert.equal(localFixture.schema_version,'1.0');
  assert.equal(localFixture.mode,'synthetic');
  assert.equal(localFixture.forecast_method,'fixture');
  assert.deepEqual(supportedFrames(localFixture).map(frame=>frame.lead_minutes),[0,30,60]);
  assert.deepEqual(supportedFrames(apiBundle).map(frame=>frame.lead_minutes),[15]);
  assert.equal(mapBounds(apiBundle.grid),null);
  assert.deepEqual(mapBounds({bounds_wgs84:[70,10,80,20]}),[[10,70],[20,80]]);
  assert.equal(mapBounds({bounds_wgs84:[70,10,200,20]}),null);
  assert.equal(artifactUrl(apiBundle.frames[0].image_url,'http://localhost:8000'),
    'http://localhost:8000/api/v1/artifacts/0123456789abcdef0123456789abcdef/illustrative-frame.png');
  assert.equal(frameLabel({mode:'synthetic'},{lead_minutes:0}),'Synthetic reference scene (t0)');
  const withUnsupported={...apiBundle,frames:[...apiBundle.frames,{lead_minutes:360,valid_time_utc:null}]};
  assert.deepEqual(supportedFrames(withUnsupported).map(frame=>frame.lead_minutes),[15]);
});

test('null and proxy probabilities stay unavailable; validated values can display',()=>{
  assert.equal(probabilityLabel(apiBundle.hazards.hail),'Not available');
  assert.equal(probabilityLabel({status:'proxy',probability:0.7}),'Not available');
  assert.equal(probabilityLabel({status:'validated',probability:null}),'Not available');
  assert.equal(probabilityLabel({status:'validated',probability:0.2}),'20%');
});

test('API flow uses documented events, capabilities, and nowcasts routes',async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    const data=url.endsWith('/capabilities') ? {
      forecast_methods:['fixture'],
      available_pipelines:{fixture:{event_id:'synthetic-demo-001',supported_lead_times_minutes:[15]}},
    }
      : url.endsWith('/events') ? {events:[{event_id:'synthetic-demo-001'}]}
      : apiBundle;
    return {ok:true,json:async()=>data};
  };
  const result=await fetchForecastBundle('http://localhost:8000',undefined,fetcher);
  assert.equal(result.run_id,apiBundle.run_id);
  assert.deepEqual(calls.map(call=>call.url),[
    'http://localhost:8000/api/v1/capabilities',
    'http://localhost:8000/api/v1/events',
    'http://localhost:8000/api/v1/nowcasts',
  ]);
  assert.equal(calls[2].options.method,'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body),{
    event_id:'synthetic-demo-001',lead_times_minutes:[15],forecast_method:'fixture',
  });
});

test('capability discovery exposes only callable method pipelines',async()=>{
  const fetcher=async url=>({ok:true,json:async()=>url.endsWith('/capabilities') ? {
    forecast_methods:['fixture','persistence','optical_flow'],
    available_pipelines:{
      fixture:{event_id:'fixture-event',supported_lead_times_minutes:[15]},
      persistence:{event_id:'observed-event',supported_lead_times_minutes:[30,60]},
      optical_flow:{event_id:'observed-event',supported_lead_times_minutes:[30,60]},
    },
  } : {events:[{event_id:'fixture-event'},{event_id:'observed-event'}]}});
  const result=await discoverForecastOptions('http://localhost:8000',undefined,fetcher);
  assert.deepEqual(Object.keys(result.availablePipelines),['fixture','persistence','optical_flow']);
  assert.equal(chooseDefaultMethod(result),'persistence');
  assert.deepEqual(result.availablePipelines.optical_flow.supported_lead_times_minutes,[30,60]);
});

test('optical flow stays hidden without a valid advertised pipeline',async()=>{
  const fetcher=async url=>({ok:true,json:async()=>url.endsWith('/capabilities') ? {
    forecast_methods:['fixture','optical_flow'],
    available_pipelines:{fixture:{event_id:'fixture-event',supported_lead_times_minutes:[15]}},
  } : {events:[{event_id:'fixture-event'}]}});
  const result=await discoverForecastOptions('http://localhost:8000',undefined,fetcher);
  assert.deepEqual(Object.keys(result.availablePipelines),['fixture']);
});

test('nowcast requests send the selected method, event, and lead exactly',async()=>{
  let payload;
  const fetcher=async(_url,options)=>{
    payload=JSON.parse(options.body);
    return {ok:true,json:async()=>({...apiBundle,forecast_method:'optical_flow',supported_lead_times_minutes:[30],frames:[{...apiBundle.frames[0],lead_minutes:30}]})};
  };
  const result=await requestNowcast('http://localhost:8000',{
    eventId:'persistence:event-1',leadTimesMinutes:[30],forecastMethod:'optical_flow',
  },undefined,fetcher);
  assert.deepEqual(payload,{event_id:'persistence:event-1',lead_times_minutes:[30],forecast_method:'optical_flow'});
  assert.equal(result.forecast_method,'optical_flow');
});

test('dashboard renders a contract-valid API-shaped response',async t=>{
  const vite=await createServer({
    server:{middlewareMode:true},appType:'custom',
    optimizeDeps:{noDiscovery:true,include:[]},
    resolve:{alias:{'react-leaflet':fileURLToPath(new URL('./map-stub.js',import.meta.url))}},
  });
  t.after(()=>vite.close());
  const {App}=await vite.ssrLoadModule('/src/main.jsx');
  const renderBundle=bundle=>renderToString(React.createElement(App,{initialBundle:bundle,apiBase:'http://localhost:8000'}));
  const html=renderBundle(apiBundle);
  assert.match(html,/SYNTHETIC/);
  assert.match(html,/Fixture/);
  assert.match(html,/\+15 min/);
  assert.match(html,/Not available/);
  assert.match(html,/GEOGRAPHY NOT PROVIDED FOR CURRENT EVENT/);
  assert.match(html,/illustrative-frame\.png/);
  const withUnsupported={...apiBundle,frames:[...apiBundle.frames,{lead_minutes:360,valid_time_utc:null}]};
  const filteredHtml=renderBundle(withUnsupported);
  assert.doesNotMatch(filteredHtml,/\+360 min/);
  const persistenceHtml=renderBundle({...apiBundle,mode:'replay',forecast_method:'persistence'});
  assert.match(persistenceHtml,/REPLAY/);
  assert.match(persistenceHtml,/Persistence/);
  const mappedHtml=renderBundle({...apiBundle,grid:{...apiBundle.grid,bounds_wgs84:[70,10,80,20]}});
  assert.doesNotMatch(mappedHtml,/GEOGRAPHY NOT PROVIDED FOR CURRENT EVENT/);
});
