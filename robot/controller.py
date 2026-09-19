"""Frozen official Unitree G1 LSTM policy. No root animation or gait training."""
from pathlib import Path
import numpy as np
import mujoco
import yaml
from numpy_gait import NumpyGait
ROOT = Path(__file__).resolve().parents[1]
CONFIG = yaml.safe_load((ROOT/'robot/g1.yaml').read_text())

def gravity(q):
    w,x,y,z=q
    return np.array([2*(-z*x+w*y),-2*(z*y+w*x),1-2*(w*w+z*z)])

class G1Controller:
    def __init__(self):
        self.model=mujoco.MjModel.from_xml_path(str(ROOT/'robot/scene.xml'))
        self.data=mujoco.MjData(self.model)
        self.policy=NumpyGait(ROOT/'vendor/gait.npz')
        self.default=np.array(CONFIG['default_angles'])
        self.kp=np.array(CONFIG['kps']); self.kd=np.array(CONFIG['kds'])
        self.reset()
    def reset(self):
        mujoco.mj_resetData(self.model,self.data)
        self.data.qpos[:2]=[-3,0]
        self.data.qpos[7:19]=self.default
        self.policy.reset_memory(); self.action=np.zeros(12,dtype=np.float32)
        self.target=self.default.copy(); self.counter=0
        mujoco.mj_forward(self.model,self.data)
        for _ in range(50): self.step([0,0,0])
    def step(self,cmd):
        for _ in range(10):
            self.data.ctrl[:]=(self.target-self.data.qpos[7:19])*self.kp-self.data.qvel[6:18]*self.kd
            mujoco.mj_step(self.model,self.data); self.counter+=1
            if self.counter%10==0:
                phase=(self.counter*.002%.8)/.8
                obs=np.concatenate([self.data.qvel[3:6]*.25,gravity(self.data.qpos[3:7]),np.array(cmd)*CONFIG['cmd_scale'],self.data.qpos[7:19]-self.default,self.data.qvel[6:18]*.05,self.action,[np.sin(2*np.pi*phase),np.cos(2*np.pi*phase)]]).astype(np.float32)
                self.action=self.policy(obs).copy(); self.target=self.action*.25+self.default
