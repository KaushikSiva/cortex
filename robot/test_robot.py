"""Physics and independent interlock regression tests; no web server required."""
import json, math, time, unittest
from server import Robot
class PhysicsTests(unittest.TestCase):
 def test_walk_stop_reset_watchdog(self):
  r=Robot();x=r.state()['pose']['x']
  r.command('/navigate',{'waypoint':'PERSON','issuedAt':time.time()*1000,'speed':.55})
  for _ in range(220):r.heartbeat=time.monotonic();r.tick()
  walked=r.state()['pose']['x']-x
  self.assertGreater(walked,1.4);self.assertGreater(r.state()['height'],.6)
  r.command('/stop',{})
  for _ in range(100):r.tick()
  self.assertLess(r.state()['velocity'],.15)
  with self.assertRaises(ValueError):r.command('/navigate',{'waypoint':'HOME','issuedAt':time.time()*1000})
  r.command('/reset',{});self.assertFalse(r.estop)
  r.command('/navigate',{'waypoint':'PERSON','issuedAt':time.time()*1000});r.heartbeat=time.monotonic()-2;r.tick()
  self.assertTrue(r.estop);self.assertEqual(r.reason,'Telemetry heartbeat timeout')
  print(json.dumps({'walkedMeters':walked,'postStopSpeed':r.state()['velocity'],'policy':'official frozen G1'}))
 def test_park_edge_clearance_uses_collision_model(self):
  r=Robot();r.sim.data.qpos[:2]=[5,4.1];self.assertLess(r.clearance(),.32)
  r.sim.data.qpos[:2]=[5,0];self.assertGreater(r.clearance(),.32)
 def test_malformed_stale_clamp(self):
  r=Robot()
  for speed in [float('nan'),float('inf'),True,-1,'fast']:
   with self.assertRaises(ValueError):r.command('/speed',{'speed':speed})
  r.command('/speed',{'speed':5});self.assertEqual(r.speed,.9)
  with self.assertRaises(ValueError):r.command('/navigate',{'waypoint':'PERSON','issuedAt':0})
  with self.assertRaises(ValueError):r.command('/navigate',{'waypoint':'UNKNOWN','issuedAt':time.time()*1000})
 def test_urgent_faster_than_calm(self):
  distances=[]
  for speed in [.55,.9]:
   r=Robot();x=r.state()['pose']['x'];r.command('/navigate',{'waypoint':'PERSON','issuedAt':time.time()*1000,'speed':speed,'approachSpeed':.5})
   for _ in range(200):r.heartbeat=time.monotonic();r.tick()
   self.assertGreater(r.state()['height'],.6);distances.append(r.state()['pose']['x']-x)
  self.assertGreater(distances[1],distances[0]*1.2);print('calm / urgent distance over 4 simulated seconds:',distances)
 def test_turn_then_walk_physically_changes_heading(self):
  for yaw in [math.pi/2,-math.pi/2,math.pi]:
   r=Robot();start=r.sim.data.qpos[:2].copy()
   r.command('/turn',{'yaw':yaw,'issuedAt':time.time()*1000})
   for _ in range(500):
    r.heartbeat=time.monotonic();r.tick()
    if r.status=='idle':break
   self.assertEqual(r.status,'idle');self.assertLess(abs(r.angle(r.yaw()-yaw)),.16)
   self.assertLess(float(((r.sim.data.qpos[:2]-start)**2).sum())**.5,.3)
   self.assertGreater(r.state()['height'],.6)
   # Forward locomotion is forbidden until the robot faces its requested heading.
   self.assertEqual(r.face_and_walk(r.yaw()+math.pi/2,.55)[0],0)
 def test_key_lease_expires_even_with_healthy_telemetry(self):
  r=Robot();r.command('/drive',{'yaw':0,'session':'keyboard-test','issuedAt':time.time()*1000})
  self.assertFalse(r.command('/renew',{'session':'wrong-key','issuedAt':time.time()*1000})['renewed'])
  r.manual_lease=time.monotonic()-1;r.heartbeat=time.monotonic();r.tick()
  self.assertIsNone(r.drive_heading);self.assertEqual(r.status,'idle');self.assertEqual(r.reason,'Key lease expired')
  r.command('/stop',{});r.command('/hold',{});self.assertTrue(r.estop)
  with self.assertRaises(ValueError):r.command('/drive',{'yaw':0,'session':'keyboard-test','issuedAt':time.time()*1000})
 def test_drive_requires_lease_and_bounds_personal_space(self):
  r=Robot()
  with self.assertRaises(ValueError):r.command('/drive',{'yaw':0,'issuedAt':time.time()*1000})
  with self.assertRaises(ValueError):r.command('/walk',{'yaw':math.pi,'meters':3,'issuedAt':time.time()*1000})
  r.sim.data.qpos[:2]=[1.6,0]
  r.command('/drive',{'yaw':0,'session':'keyboard-test','issuedAt':time.time()*1000});r.tick()
  self.assertTrue(r.estop);self.assertEqual(r.reason,'Personal space boundary')
if __name__=='__main__':unittest.main()
