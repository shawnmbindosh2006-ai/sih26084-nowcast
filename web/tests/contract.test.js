import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createServer} from 'vite';
import {artifactUrl, fetchForecastBundle, frameLabel, mapBounds, probabilityLabel, supportedFrames} from '../src/contract.js';

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
    const data=url.endsWith('/capabilities') ? {supported_lead_times_minutes:[15]}
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
  assert.deepEqual(JSON.parse(calls[2].options.body),{event_id:'synthetic-demo-001',lead_times_minutes:[15]});
});

test('dashboard renders a contract-valid API-shaped response',async t=>{
  const vite=await createServer({
    server:{middlewareMode:true},appType:'custom',
    optimizeDeps:{noDiscovery:true,include:[]},
    resolve:{alias:{'react-leaflet':fileURLToPath(new URL('./map-stub.js',import.meta.url))}},
  });
  t.after(()=>vite.close());
  const {App}=await vite.ssrLoadModule('/src/main.jsx');
  const html=renderToString(React.createElement(App,{initialBundle:apiBundle,apiBase:''}));
  assert.match(html,/SYNTHETIC/);
  assert.match(html,/FIXTURE/);
  assert.match(html,/\+15 min/);
  assert.match(html,/Not available/);
  assert.match(html,/Geography unknown/);
  assert.match(html,/illustrative-frame\.png/);
  const withUnsupported={...apiBundle,frames:[...apiBundle.frames,{lead_minutes:360,valid_time_utc:null}]};
  const filteredHtml=renderToString(React.createElement(App,{initialBundle:withUnsupported,apiBase:''}));
  assert.doesNotMatch(filteredHtml,/\+360 min/);
  const persistenceHtml=renderToString(React.createElement(App,{initialBundle:{...apiBundle,mode:'replay',forecast_method:'persistence'},apiBase:''}));
  assert.match(persistenceHtml,/REPLAY/);
  assert.match(persistenceHtml,/PERSISTENCE/);
  const mappedHtml=renderToString(React.createElement(App,{initialBundle:{...apiBundle,grid:{...apiBundle.grid,bounds_wgs84:[70,10,80,20]}},apiBase:''}));
  assert.match(mappedHtml,/Georeferenced bounds available/);
  assert.doesNotMatch(mappedHtml,/Geography unknown/);
});
