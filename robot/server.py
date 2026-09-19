"""Loopback-only robot API with independent safety watchdog and real 50 Hz MuJoCo."""
import json, math, os, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
import mujoco
from controller import G1Controller, gravity

WAYPOINTS={'HOME':[-3,0],'PERSON':[3,0],'PLANTER':[2,1.2],'BACKPACK':[2,1.2],'BENCH':[-1,2.4],'DOOR':[4,-2]}
class Robot:
    def __init__(self):
        self.lock=threading.RLock(); self.sim=G1Controller(); self.speed=.55
        self.target=None; self.status='idle'; self.estop=False; self.expires=0; self.heartbeat=time.monotonic()
        self.personal_space=1.2; self.approach=.35; self.waypoint='HOME'; self.reason=''; self.command_id=None
        self.obstacle_ids=[mujoco.mj_name2id(self.sim.model,mujoco.mjtObj.mjOBJ_GEOM,name) for name in ['planter','bench','pool_edge','north_wall','south_boundary']]
        self.last_tick=time.time()*1000; self.running=True; self.hold=self.sim.data.qpos[:2].copy(); self.hold_yaw=self.yaw()
    def stop(self,reason='user stop'):
        self.estop=True; self.target=None; self.status='stopped'; self.reason=reason; self.hold=self.sim.data.qpos[:2].copy();self.hold_yaw=self.yaw()
    def state(self):
        with self.lock:
            d=self.sim.data
            return {'pose':{'x':float(d.qpos[0]),'y':float(d.qpos[1]),'yaw':self.yaw()},'velocity':float(np.linalg.norm(d.qvel[:2])), 'commandedSpeed':self.speed if self.target else 0,'qpos':d.qpos[:19].tolist(),'currentWaypoint':self.waypoint,'status':self.status,'timestamp':self.last_tick,'simTime':float(d.time),'backend':'MUJOCO','estop':self.estop,'reason':self.reason,'commandId':self.command_id,'height':float(d.qpos[2]),'contacts':int(d.ncon),'nearestObstacle':self.clearance()}
    def yaw(self):
        w,x,y,z=self.sim.data.qpos[3:7]
        return math.atan2(2*(w*z+x*y),1-2*(y*y+z*z))
    def clearance(self):
        x,y=self.sim.data.qpos[:2]
        def box(cx,cy,hx,hy):return math.hypot(max(abs(x-cx)-hx,0),max(abs(y-cy)-hy,0))-.25
        return float(min(box(*self.sim.model.geom_pos[i,:2],*self.sim.model.geom_size[i,:2]) for i in self.obstacle_ids))
    def command(self,path,b):
        with self.lock:
            if path=='/stop':self.stop(); return self.state()
            if path=='/heartbeat': self.heartbeat=time.monotonic(); return {'ok':True}
            if path=='/reset':
                self.sim.reset();self.estop=False;self.target=None;self.status='idle';self.reason='';self.waypoint='HOME';self.last_tick=time.time()*1000;self.hold=self.sim.data.qpos[:2].copy();self.hold_yaw=self.yaw()
                return self.state()
            if path=='/resume':
                if self.status=='error':raise ValueError('Reset after a fall')
                self.estop=False;self.status='idle';return self.state()
            if path=='/speed':
                speed=b.get('speed'); self.number(speed,0,10); self.speed=min(speed,.9);return self.state()
            if path=='/look-at':return {'supported':False,'reason':'12-DoF locomotion model has no actuated head'}
            if path!='/navigate':raise ValueError('Unknown command')
            if self.estop:raise ValueError('Emergency stop is latched; explicit resume or reset required')
            target=b.get('waypoint')
            if target not in WAYPOINTS:raise ValueError('Unknown waypoint')
            ttl=b.get('timeoutMs',20000);self.number(ttl,100,30000)
            issued=b.get('issuedAt');self.number(issued,0,1e15)
            if abs(time.time()*1000-issued)>2000:raise ValueError('Stale command')
            self.number(b.get('speed',.55),0,.9);self.number(b.get('personalSpaceMeters',1.2),1.2,3)
            self.number(b.get('approachSpeed',.35),0,.5)
            self.speed=b.get('speed',.55);self.personal_space=b.get('personalSpaceMeters',1.2);self.approach=b.get('approachSpeed',.35)
            self.target=WAYPOINTS[target];self.waypoint=target;self.status='moving';self.expires=time.monotonic()+ttl/1000
            self.heartbeat=time.monotonic();self.command_id=b.get('id');return self.state()
    @staticmethod
    def number(v,lo,hi):
        if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError('Invalid numeric command')
    def tick(self):
        with self.lock:
            now=time.monotonic();d=self.sim.data;cmd=[0.,0.,0.]
            if self.target:
                if now>self.expires:self.stop('Command expired')
                elif now-self.heartbeat>1.5:self.stop('Telemetry heartbeat timeout')
                elif self.clearance()<.32:self.stop('Obstacle clearance')
                else:
                    delta=np.array(self.target)-d.qpos[:2];distance=float(np.linalg.norm(delta))
                    radius=self.personal_space if self.waypoint=='PERSON' else .28
                    if distance<=radius:
                        self.target=None;self.status='idle';self.hold=d.qpos[:2].copy();self.hold_yaw=self.yaw()
                    else:
                        error=(math.atan2(delta[1],delta[0])-self.yaw()+math.pi)%(2*math.pi)-math.pi
                        speed=min(self.speed,self.approach if distance-radius<.9 else self.speed)
                        cmd=[speed*max(0,math.cos(error)),0,float(np.clip(error*1.8,-.8,.8))]
            if not self.target and not self.estop and self.status!='error':
                delta=self.hold-d.qpos[:2];yaw=self.yaw();c,s=math.cos(yaw),math.sin(yaw)
                cmd=[float(np.clip((c*delta[0]+s*delta[1])*.8,-.12,.12)),float(np.clip((-s*delta[0]+c*delta[1])*.8,-.12,.12)),float(np.clip((self.hold_yaw-yaw)*.8,-.2,.2))]
            self.sim.step(cmd)
            if d.qpos[2]<.48 or gravity(d.qpos[3:7])[2]>-.4:
                self.stop('Fall detected');self.status='error'
            self.last_tick=time.time()*1000
    def loop(self):
        while self.running:
            start=time.monotonic();self.tick();time.sleep(max(0,.02-(time.monotonic()-start)))

robot=None
class Handler(BaseHTTPRequestHandler):
    def reply(self,code,data):
        raw=json.dumps(data,allow_nan=False).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/state':self.reply(200,robot.state())
        else:self.reply(404,{'error':'Not found'})
    def do_POST(self):
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>8192:raise ValueError('Request too large')
            b=json.loads(self.rfile.read(size) or '{}')
            if not isinstance(b,dict):raise ValueError('Expected object')
            self.reply(200,robot.command(self.path,b))
        except (ValueError,TypeError,KeyError) as e:self.reply(400,{'error':str(e)})
    def log_message(self,*args):pass
if __name__=='__main__':
    robot=Robot();threading.Thread(target=robot.loop,daemon=True).start()
    print('CORTEX MuJoCo: http://127.0.0.1:8002',flush=True)
    ThreadingHTTPServer(('127.0.0.1',int(os.getenv('MUJOCO_PORT','8002'))),Handler).serve_forever()
