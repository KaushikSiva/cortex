"""Measured PCM cues, not emotion recognition. No external model or fabricated scores."""
import math
from collections import deque
import numpy as np

class AcousticWindow:
    def __init__(self):
        self.frames=deque(maxlen=500)  # 40 seconds at 80 ms chunks
    def add(self,pcm:bytes,rate:int=16000):
        x=np.frombuffer(pcm,dtype='<i2').astype(np.float32)/32768
        if not len(x):return
        rms=float(np.sqrt(np.mean(x*x)));peak=float(np.max(np.abs(x)))
        pitch=None
        if rms>.012:
            y=x[::2];y=y-y.mean();corr=np.correlate(y,y,'full')[len(y)-1:]
            lo,hi=int(rate/2/400),min(len(corr),int(rate/2/70))
            if hi>lo and corr[0]>0:
                lag=lo+int(np.argmax(corr[lo:hi]))
                if corr[lag]/corr[0]>.35:pitch=rate/2/lag
        self.frames.append((rms,peak,pitch,len(x)/rate))
    def snapshot(self):
        frames=list(self.frames);voiced=[i for i,f in enumerate(frames) if f[0]>.012]
        if not voiced:return None
        frames=frames[voiced[0]:voiced[-1]+1];speech=[f for f in frames if f[0]>.012]
        duration=sum(f[3] for f in frames);spoken=sum(f[3] for f in speech)
        pitches=[f[2] for f in speech if f[2] is not None]
        db=lambda v:max(-100,min(0,20*math.log10(max(v,1e-5))))
        return dict(rmsDb=db(math.sqrt(sum(f[0]**2*f[3] for f in speech)/spoken)),peakDb=db(max(f[1] for f in speech)),pitchVariation=min(2,float(np.std(pitches)/np.mean(pitches))) if len(pitches)>2 else 0,pauseRatio=max(0,1-spoken/duration),voicedMs=min(120000,spoken*1000))
    def clear(self):self.frames.clear()
