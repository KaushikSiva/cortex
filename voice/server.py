"""Loopback Pipecat voice sidecar: Gradium STT/TTS + measured local acoustics.
SambaNova's structured mission planner remains in the TS safety runtime.
"""
import asyncio,base64,json,os,time
from dataclasses import dataclass
from pathlib import Path
from aiohttp import web,WSMsgType
from dotenv import load_dotenv
from pipecat.frames.frames import (Frame,InputAudioRawFrame,TTSAudioRawFrame,TTSStoppedFrame,TranscriptionFrame,InterimTranscriptionFrame,TTSSpeakFrame,InterruptionFrame,ErrorFrame,VADUserStartedSpeakingFrame,VADUserStoppedSpeakingFrame)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineWorker,PipelineParams
from pipecat.workers.runner import WorkerRunner
from pipecat.processors.frame_processor import FrameProcessor,FrameDirection
from pipecat.services.gradium.stt import GradiumSTTService
from pipecat.services.gradium.tts import GradiumTTSService
from pipecat.transcriptions.language import Language
from acoustics import AcousticWindow
ROOT=Path(__file__).resolve().parents[1]
load_dotenv(ROOT/'.env.local');load_dotenv(ROOT/'.env')

class AuditedSocket:
    def __init__(self,socket,emit):self.socket=socket;self.emit=emit
    def __getattr__(self,name):return getattr(self.socket,name)
    async def recv(self,*args,**kwargs):
        message=await self.socket.recv(*args,**kwargs)
        try:await self.emit({'type':'gradium_raw','event':json.loads(message),'receivedAt':time.time_ns()//1000000})
        except (json.JSONDecodeError,UnicodeDecodeError):pass
        return message
    def __aiter__(self):return self
    async def __anext__(self):
        from websockets.exceptions import ConnectionClosedOK
        try:return await self.recv()
        except ConnectionClosedOK:raise StopAsyncIteration

class AuditedSTT(GradiumSTTService):
    def __init__(self,emit,**kw):self.emit=emit;super().__init__(**kw)
    async def _websocket_connect(self,*args,**kwargs):
        return AuditedSocket(await super()._websocket_connect(*args,**kwargs),self.emit)
    async def _connect_websocket(self):
        await super()._connect_websocket()
        if self._websocket:await self.emit({'type':'voice_ready','engine':'Pipecat','provider':'Gradium'})

class VoiceObserver(FrameProcessor):
    def __init__(self,emit,features):super().__init__();self.emit=emit;self.features=features
    async def process_frame(self,frame:Frame,direction:FrameDirection):
        await super().process_frame(frame,direction)
        if isinstance(frame,(TranscriptionFrame,InterimTranscriptionFrame)):
            interim=isinstance(frame,InterimTranscriptionFrame)
            await self.emit({'type':'voice_turn','transcript':frame.text,'interim':interim,'acoustics':self.features.snapshot(),'source':'GRADIUM','timestamp':time.time_ns()//1000000})
            if not interim:self.features.clear()
            return  # Transcripts cannot directly reach TTS or motors.
        if isinstance(frame,ErrorFrame):await self.emit({'type':'error','message':frame.error})
        await self.push_frame(frame,direction)

@dataclass
class SpeechRequestFrame(TTSSpeakFrame):
    request_id:str=''

class CorrelatedTTS(GradiumTTSService):
    def __init__(self,requests,**kw):self.requests=requests;self.request_id='';super().__init__(**kw)
    async def process_frame(self,frame,direction):
        if isinstance(frame,SpeechRequestFrame):self.request_id=frame.request_id
        await super().process_frame(frame,direction)
    async def run_tts(self,text,context_id):
        self.requests[context_id]=self.request_id
        # Bound bookkeeping even if a provider fails without a stopped frame.
        if len(self.requests)>64:self.requests.pop(next(iter(self.requests)))
        async for frame in super().run_tts(text,context_id):yield frame

class AudioOutput(FrameProcessor):
    def __init__(self,emit,requests):super().__init__();self.emit=emit;self.requests=requests
    async def process_frame(self,frame,direction):
        await super().process_frame(frame,direction)
        if isinstance(frame,TTSAudioRawFrame):
            request_id=self.requests.get(frame.context_id)
            if request_id:await self.emit({'type':'voice_audio','audio':base64.b64encode(frame.audio).decode(),'sampleRate':frame.sample_rate,'requestId':request_id})
        elif isinstance(frame,TTSStoppedFrame):
            self.requests.pop(frame.context_id,None)
            await self.push_frame(frame,direction)
        elif not isinstance(frame,InputAudioRawFrame):await self.push_frame(frame,direction)

async def health(request):return web.json_response({'engine':'Pipecat','version':'1.11.0','gradiumConfigured':bool(os.getenv('GRADIUM_API_KEY')),'ttsConfigured':bool(os.getenv('GRADIUM_VOICE_ID'))})

async def voice(request):
    if request.headers.get('Origin'):return web.Response(status=403,text='Connect through the CORTEX runtime')
    if not os.getenv('GRADIUM_API_KEY'):return web.json_response({'error':'GRADIUM_API_KEY is not configured'},status=503)
    ws=web.WebSocketResponse(max_msg_size=350000);await ws.prepare(request)
    async def emit(event):
        if not ws.closed:await ws.send_json(event)
    features=AcousticWindow()
    stt=AuditedSTT(emit,api_key=os.environ['GRADIUM_API_KEY'],sample_rate=16000,settings=GradiumSTTService.Settings(language=Language.EN,delay_in_frames=8))
    requests={};processors=[stt,VoiceObserver(emit,features)]
    if os.getenv('GRADIUM_VOICE_ID'):
        processors.append(CorrelatedTTS(requests,api_key=os.environ['GRADIUM_API_KEY'],settings=GradiumTTSService.Settings(voice=os.environ['GRADIUM_VOICE_ID'])))
    processors.append(AudioOutput(emit,requests))
    task=PipelineWorker(Pipeline(processors),params=PipelineParams(audio_in_sample_rate=16000,audio_out_sample_rate=48000,enable_metrics=True),enable_rtvi=False,idle_timeout_secs=None)
    runner=WorkerRunner(handle_sigint=False);await runner.add_workers(task);running=asyncio.create_task(runner.run())
    try:
        async for msg in ws:
            if msg.type!=WSMsgType.TEXT:continue
            data=json.loads(msg.data);kind=data.get('type')
            if kind=='audio':
                pcm=base64.b64decode(data['data'],validate=True)
                if len(pcm)%2 or len(pcm)>32000:raise ValueError('Invalid PCM16 packet')
                features.add(pcm);await task.queue_frame(InputAudioRawFrame(audio=pcm,sample_rate=16000,num_channels=1))
            elif kind=='speech_start':
                await task.queue_frame(InterruptionFrame());await task.queue_frame(VADUserStartedSpeakingFrame());await emit({'type':'interruption'})
            elif kind=='speech_end':await task.queue_frame(VADUserStoppedSpeakingFrame())
            elif kind=='speak':
                if not os.getenv('GRADIUM_VOICE_ID'):raise ValueError('GRADIUM_VOICE_ID is required for speech playback')
                request_id=data.get('requestId')
                if not isinstance(request_id,str) or not request_id or len(request_id)>80:raise ValueError('Speech requestId is required')
                await task.queue_frame(SpeechRequestFrame(text=str(data['text'])[:500],request_id=request_id))
            elif kind=='interrupt':await task.queue_frame(InterruptionFrame())
    except Exception as e:await emit({'type':'error','message':str(e)})
    finally:
        await task.cancel();await asyncio.gather(running,return_exceptions=True)
    return ws

app=web.Application();app.router.add_get('/health',health);app.router.add_get('/voice',voice)
if __name__=='__main__':web.run_app(app,host='127.0.0.1',port=int(os.getenv('PIPECAT_PORT','8003')))
