"""Local protocol tests. No external calls and no claim of live Gradium validation."""
import asyncio,base64,json,os,unittest
from unittest.mock import patch
import numpy as np
from aiohttp import web,ClientSession
import server as voice
from acoustics import AcousticWindow

class AcousticTests(unittest.TestCase):
 def test_energy_and_pitch_are_measured_from_pcm(self):
  t=np.arange(1280)/16000
  features=[]
  for amplitude in [.03,.20]:
   window=AcousticWindow()
   for _ in range(10):window.add((np.sin(2*np.pi*180*t)*amplitude*32767).astype('<i2').tobytes())
   features.append(window.snapshot())
  self.assertGreater(features[1]['rmsDb']-features[0]['rmsDb'],15)
  self.assertEqual(features[0]['pauseRatio'],0)
  self.assertGreater(features[0]['voicedMs'],700)
 def test_silence_has_no_invented_acoustic_state(self):
  window=AcousticWindow();window.add(bytes(2560));self.assertIsNone(window.snapshot())

class PipelineTests(unittest.IsolatedAsyncioTestCase):
 async def test_actual_pipecat_pipeline_with_local_gradium_protocol_double(self):
  async def asr(request):
   ws=web.WebSocketResponse();await ws.prepare(request);sent=False
   async for message in ws:
    data=json.loads(message.data)
    if data['type']=='setup':await ws.send_json({'type':'ready','sample_rate':16000,'frame_size':1280,'model_name':'default'})
    elif data['type']=='audio' and not sent:
     sent=True;await ws.send_json({'type':'text','text':'Come here.','start_s':0})
    elif data['type']=='flush':await ws.send_json({'type':'flushed','flush_id':data['flush_id']})
   return ws
  fake=web.Application();fake.router.add_get('/asr',asr);fr=web.AppRunner(fake);await fr.setup();site=web.TCPSite(fr,'127.0.0.1',0);await site.start();port=site._server.sockets[0].getsockname()[1]
  real_class=voice.AuditedSTT
  def factory(*args,**kw):return real_class(*args,api_endpoint_base_url=f'ws://127.0.0.1:{port}/asr',**kw)
  app=web.Application();app.router.add_get('/voice',voice.voice);vr=web.AppRunner(app);await vr.setup();vs=web.TCPSite(vr,'127.0.0.1',0);await vs.start();vp=vs._server.sockets[0].getsockname()[1]
  try:
   with patch.dict(os.environ,{'GRADIUM_API_KEY':'local-protocol-test','GRADIUM_VOICE_ID':''}),patch.object(voice,'AuditedSTT',factory):
    async with ClientSession() as session:
     async with session.ws_connect(f'http://127.0.0.1:{vp}/voice') as ws:
      raw=[]
      async def until(kind,final=False):
       for _ in range(40):
        m=await asyncio.wait_for(ws.receive_json(),8);raw.append(m)
        if m['type']=='error':self.fail(m['message'])
        if m['type']==kind and (not final or not m.get('interim')):return m
       self.fail('Expected event missing')
      await until('voice_ready');await ws.send_json({'type':'speech_start'})
      pcm=(np.sin(2*np.pi*180*np.arange(1280)/16000)*.15*32767).astype('<i2').tobytes()
      await ws.send_json({'type':'audio','data':base64.b64encode(pcm).decode()})
      interim=await until('voice_turn');self.assertTrue(interim['interim']);self.assertEqual(interim['transcript'],'Come here.')
      await ws.send_json({'type':'speech_end'});final=await until('voice_turn',True)
      self.assertEqual(final['source'],'GRADIUM');self.assertIsNotNone(final['acoustics']);self.assertTrue(any(m['type']=='gradium_raw' for m in raw))
  finally:await vr.cleanup();await fr.cleanup()

if __name__=='__main__':unittest.main()
